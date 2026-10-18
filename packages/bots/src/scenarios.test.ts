import { describe, expect, it } from 'vitest';

type TeamId = 'home' | 'away';
type Vec3 = { x: number; y: number; z: number };

type Player = {
  id: string;
  team: TeamId;
  position: Vec3;
  velocity: Vec3;
  facingYaw: number;
  goalkeeper: boolean;
};

type World = {
  tick: number;
  timeSeconds: number;
  field: { halfWidth: number; halfLength: number; goalHalfWidth: number };
  ball: { position: Vec3; velocity: Vec3 };
  players: Player[];
  possessionTeam: TeamId | null;
  possessionPlayerId: string | null;
};

const FIELD = Object.freeze({ halfWidth: 12, halfLength: 18, goalHalfWidth: 3.66 });

function player(
  id: string,
  team: TeamId,
  x: number,
  z: number,
  options: Partial<Pick<Player, 'goalkeeper' | 'facingYaw' | 'velocity'>> = {},
): Player {
  return {
    id,
    team,
    position: { x, y: 0, z },
    velocity: options.velocity ?? { x: 0, y: 0, z: 0 },
    facingYaw: options.facingYaw ?? (team === 'home' ? 0 : Math.PI),
    goalkeeper: options.goalkeeper ?? false,
  };
}

function world(
  players: Player[],
  ball: Vec3,
  possessionTeam: TeamId | null,
  possessionPlayerId: string | null,
): World {
  return {
    tick: 120,
    timeSeconds: 4,
    field: FIELD,
    ball: { position: { ...ball }, velocity: { x: 0, y: 0, z: 0 } },
    players,
    possessionTeam,
    possessionPlayerId,
  };
}

async function load<T>(relativePath: string): Promise<T> {
  const loaded = await import(relativePath).catch(() => null);
  expect(loaded, `Stage 06 module ${relativePath} must exist`).not.toBeNull();
  return loaded as T;
}

interface RolesModule {
  assignTeamRoles: (
    snapshot: World,
    team: TeamId,
    previous?: unknown,
  ) => {
    assignments: Array<{ playerId: string; role: string; targetPosition: Vec3 }>;
    switchCount: number;
  };
}

interface PassingModule {
  evaluatePassLane: (snapshot: World, passerId: string, receiverId: string) => {
    openness: number;
    interceptionMarginSeconds: number;
    mostDangerousDefenderId: string | null;
  };
  planPassChain: (snapshot: World, team: TeamId, maxPasses: number) => Array<{
    fromPlayerId: string;
    toPlayerId: string;
    target: Vec3;
    score: number;
  }>;
}

interface UtilityModule {
  chooseCarrierAction: (snapshot: World, carrierId: string) => {
    kind: string;
    targetPlayerId: string | null;
    score: number;
  };
  chooseDefensiveAction: (snapshot: World, defenderId: string) => {
    kind: string;
    targetPosition: Vec3;
    score: number;
  };
}

interface GoalkeeperModule {
  computeGoalkeeperDecision: (snapshot: World, goalkeeperId: string) => {
    kind: string;
    targetPosition: Vec3;
    distributionTargetId: string | null;
  };
}

function distance(a: Vec3, b: Vec3): number {
  return Math.hypot(a.x - b.x, a.z - b.z);
}

describe('Stage 06 tactical bot scenarios', () => {
  it('support role leaves the carrier lane instead of forming a ball swarm', async () => {
    const { assignTeamRoles } = await load<RolesModule>('./roles');
    const snapshot = world([
      player('h-gk', 'home', 0, -16.5, { goalkeeper: true }),
      player('h-1', 'home', 0, -2),
      player('h-2', 'home', 0.2, -2.8),
      player('a-gk', 'away', 0, 16.5, { goalkeeper: true }),
      player('a-1', 'away', -1, 4),
      player('a-2', 'away', 2, 5),
    ], { x: 0, y: 0.11, z: -2 }, 'home', 'h-1');

    const result = assignTeamRoles(snapshot, 'home');
    const carrier = result.assignments.find((item) => item.role === 'ball-carrier');
    const support = result.assignments.find((item) => item.role === 'immediate-support');
    expect(carrier?.playerId).toBe('h-1');
    expect(support).toBeDefined();
    expect(Math.abs((support?.targetPosition.x ?? 0) - (carrier?.targetPosition.x ?? 0))).toBeGreaterThanOrEqual(2.5);
    expect(distance(support!.targetPosition, carrier!.targetPosition)).toBeGreaterThanOrEqual(3.5);
  });

  it('turnover makes a defender recover goal-side rather than continue attacking', async () => {
    const { chooseDefensiveAction } = await load<UtilityModule>('./utility');
    const snapshot = world([
      player('h-gk', 'home', 0, -16.5, { goalkeeper: true }),
      player('h-1', 'home', 1, 6),
      player('h-2', 'home', -4, 8),
      player('a-gk', 'away', 0, 16.5, { goalkeeper: true }),
      player('a-1', 'away', 0, 4),
      player('a-2', 'away', 4, 6),
    ], { x: 0, y: 0.11, z: 4 }, 'away', 'a-1');

    const action = chooseDefensiveAction(snapshot, 'h-2');
    expect(['recover-goal-side', 'cover']).toContain(action.kind);
    expect(action.targetPosition.z).toBeLessThan(4);
    expect(action.targetPosition.z).toBeLessThan(snapshot.players.find((p) => p.id === 'h-2')!.position.z);
  });

  it('trapped carrier passes to the open teammate instead of dribbling into pressure', async () => {
    const { chooseCarrierAction } = await load<UtilityModule>('./utility');
    const snapshot = world([
      player('h-gk', 'home', 0, -16.5, { goalkeeper: true }),
      player('h-1', 'home', 0, 0),
      player('h-2', 'home', 5, 5),
      player('a-gk', 'away', 0, 16.5, { goalkeeper: true }),
      player('a-1', 'away', 0.5, 0.8),
      player('a-2', 'away', -0.8, 1.2),
    ], { x: 0, y: 0.11, z: 0 }, 'home', 'h-1');

    const action = chooseCarrierAction(snapshot, 'h-1');
    expect(action.kind).toBe('pass');
    expect(action.targetPlayerId).toBe('h-2');
    expect(action.score).toBeGreaterThan(0.5);
  });

  it('obviously blocked passing lane is rejected in favor of an open lane', async () => {
    const { evaluatePassLane } = await load<PassingModule>('./passing');
    const snapshot = world([
      player('h-gk', 'home', 0, -16.5, { goalkeeper: true }),
      player('h-1', 'home', 0, 0),
      player('h-blocked', 'home', 0, 10),
      player('h-open', 'home', 6, 7),
      player('a-gk', 'away', 0, 16.5, { goalkeeper: true }),
      player('a-1', 'away', 0, 4.7),
      player('a-2', 'away', -4, 7),
    ], { x: 0, y: 0.11, z: 0 }, 'home', 'h-1');

    const blocked = evaluatePassLane(snapshot, 'h-1', 'h-blocked');
    const open = evaluatePassLane(snapshot, 'h-1', 'h-open');
    expect(blocked.openness).toBeLessThan(0.35);
    expect(blocked.mostDangerousDefenderId).toBe('a-1');
    expect(open.openness).toBeGreaterThan(blocked.openness + 0.35);
    expect(open.interceptionMarginSeconds).toBeGreaterThan(blocked.interceptionMarginSeconds);
  });

  it('goalkeeper home position follows ball angle but never abandons the goal', async () => {
    const { computeGoalkeeperDecision } = await load<GoalkeeperModule>('./goalkeeper');
    const players = [
      player('h-gk', 'home', 0, -16.4, { goalkeeper: true }),
      player('h-1', 'home', -2, -4),
      player('h-2', 'home', 3, 0),
      player('a-gk', 'away', 0, 16.5, { goalkeeper: true }),
      player('a-1', 'away', 7, -1),
      player('a-2', 'away', 2, 3),
    ];
    const right = computeGoalkeeperDecision(world(players, { x: 8, y: 0.11, z: -1 }, 'away', 'a-1'), 'h-gk');
    const left = computeGoalkeeperDecision(world(players, { x: -8, y: 0.11, z: -1 }, 'away', 'a-1'), 'h-gk');
    expect(right.targetPosition.x).toBeGreaterThan(0.25);
    expect(left.targetPosition.x).toBeLessThan(-0.25);
    expect(Math.abs(right.targetPosition.x)).toBeLessThanOrEqual(FIELD.goalHalfWidth - 0.25);
    expect(Math.abs(left.targetPosition.x)).toBeLessThanOrEqual(FIELD.goalHalfWidth - 0.25);
    expect(right.targetPosition.z).toBeLessThan(-13.5);
    expect(left.targetPosition.z).toBeLessThan(-13.5);
  });

  it('small state perturbations do not thrash dynamic roles', async () => {
    const { assignTeamRoles } = await load<RolesModule>('./roles');
    const players = [
      player('h-gk', 'home', 0, -16.5, { goalkeeper: true }),
      player('h-1', 'home', -1, 0),
      player('h-2', 'home', 2.5, 1),
      player('a-gk', 'away', 0, 16.5, { goalkeeper: true }),
      player('a-1', 'away', 0, 6),
      player('a-2', 'away', -3, 8),
    ];
    const first = assignTeamRoles(world(players, { x: -0.8, y: 0.11, z: 0.2 }, 'home', 'h-1'), 'home');
    const perturbed = players.map((p) => p.id === 'h-2' ? { ...p, position: { ...p.position, x: p.position.x - 0.08 } } : p);
    const second = assignTeamRoles(
      { ...world(perturbed, { x: -0.7, y: 0.11, z: 0.26 }, 'home', 'h-1'), timeSeconds: 4.08 },
      'home',
      first,
    );
    const firstRoles = new Map(first.assignments.map((entry) => [entry.playerId, entry.role]));
    const secondRoles = new Map(second.assignments.map((entry) => [entry.playerId, entry.role]));
    expect(second.switchCount).toBe(0);
    expect(secondRoles).toEqual(firstRoles);
  });

  it('scripted attack can build a three-pass chain through useful space', async () => {
    const { planPassChain } = await load<PassingModule>('./passing');
    const snapshot = world([
      player('h-gk', 'home', -3, -16.5, { goalkeeper: true }),
      player('h-1', 'home', -5, -5),
      player('h-2', 'home', 4, 1),
      player('h-3', 'home', -3, 8),
      player('a-gk', 'away', 0, 16.5, { goalkeeper: true }),
      player('a-1', 'away', 0, -1),
      player('a-2', 'away', 1, 7),
      player('a-3', 'away', -7, 4),
    ], { x: -5, y: 0.11, z: -5 }, 'home', 'h-1');

    const chain = planPassChain(snapshot, 'home', 3);
    expect(chain).toHaveLength(3);
    expect(new Set(chain.map((pass) => `${pass.fromPlayerId}->${pass.toPlayerId}`)).size).toBe(3);
    expect(chain.every((pass) => pass.score > 0.35)).toBe(true);
    expect(chain.at(-1)!.target.z).toBeGreaterThan(chain[0]!.target.z);
  });

  it('role targets remain spatially distinct and exactly one goalkeeper exists', async () => {
    const { assignTeamRoles } = await load<RolesModule>('./roles');
    const snapshot = world([
      player('h-gk', 'home', 0, -16.5, { goalkeeper: true }),
      player('h-1', 'home', 0, 0),
      player('h-2', 'home', 0.1, 0.1),
      player('h-3', 'home', -0.1, 0),
      player('a-gk', 'away', 0, 16.5, { goalkeeper: true }),
      player('a-1', 'away', 0, 4),
      player('a-2', 'away', 1, 5),
      player('a-3', 'away', -1, 5),
    ], { x: 0, y: 0.11, z: 0 }, 'home', 'h-1');

    const result = assignTeamRoles(snapshot, 'home');
    expect(result.assignments.filter((entry) => entry.role === 'goalkeeper')).toHaveLength(1);
    const fieldTargets = result.assignments.filter((entry) => entry.role !== 'goalkeeper').map((entry) => entry.targetPosition);
    let minimum = Number.POSITIVE_INFINITY;
    for (let i = 0; i < fieldTargets.length; i += 1) {
      for (let j = i + 1; j < fieldTargets.length; j += 1) {
        minimum = Math.min(minimum, distance(fieldTargets[i]!, fieldTargets[j]!));
      }
    }
    expect(minimum).toBeGreaterThanOrEqual(2.5);
  });
});
