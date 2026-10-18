import { buildTacticalBlackboard } from './blackboard';
import {
  attackingDirection,
  fieldClamp,
  horizontalDistance,
  ownGoalZ,
  phaseForTeam,
  teamPlayers,
  type BotPlayerSnapshot,
  type BotRole,
  type BotWorldSnapshot,
  type TeamId,
  type TeamPhase,
  type Vec3,
} from './types';

export interface RoleAssignment {
  playerId: string;
  role: BotRole;
  targetPosition: Vec3;
}

export interface TeamRoleAssignment {
  assignments: RoleAssignment[];
  switchCount: number;
  phase: TeamPhase;
  possessionPlayerId: string | null;
  generatedAtSeconds: number;
}

function roleTarget(
  world: Readonly<BotWorldSnapshot>,
  team: TeamId,
  role: Exclude<BotRole, 'goalkeeper' | 'ball-carrier'>,
  ordinal = 0,
): Vec3 {
  const direction = attackingDirection(team);
  const ball = world.ball.position;
  if (role === 'immediate-support') {
    const side = ordinal % 2 === 0 ? 1 : -1;
    return fieldClamp(world, { x: ball.x + side * 4.2, y: 0, z: ball.z + direction * 1.7 });
  }
  if (role === 'width-support') {
    const side = ball.x >= 0 ? -1 : 1;
    return fieldClamp(world, { x: side * Math.max(4.6, world.field.halfWidth * 0.58), y: 0, z: ball.z + direction * 3.8 });
  }
  if (role === 'presser') return fieldClamp(world, { x: ball.x, y: 0, z: ball.z });
  if (role === 'cover-defender') {
    return fieldClamp(world, { x: ball.x * 0.42, y: 0, z: ball.z - direction * 4.2 });
  }
  const side = ordinal % 2 === 0 ? -1 : 1;
  return fieldClamp(world, {
    x: ball.x * 0.22 + side * 3.6,
    y: 0,
    z: ball.z - direction * 7.1,
  });
}

function keeperHome(world: Readonly<BotWorldSnapshot>, team: TeamId): Vec3 {
  const direction = attackingDirection(team);
  return { x: 0, y: 0, z: ownGoalZ(world, team) + direction * 1.2 };
}

function assignmentCost(player: Readonly<BotPlayerSnapshot>, target: Readonly<Vec3>): number {
  return horizontalDistance(player.position, target);
}

function assignByMinimumTravel(
  players: readonly BotPlayerSnapshot[],
  slots: readonly { role: Exclude<BotRole, 'goalkeeper' | 'ball-carrier'>; targetPosition: Vec3 }[],
): RoleAssignment[] {
  if (players.length === 0 || slots.length === 0) return [];
  let best: RoleAssignment[] = [];
  let bestMax = Number.POSITIVE_INFINITY;
  let bestTotal = Number.POSITIVE_INFINITY;
  const visit = (slotIndex: number, remaining: BotPlayerSnapshot[], current: RoleAssignment[], total: number, max: number): void => {
    if (slotIndex >= slots.length || remaining.length === 0) {
      if (current.length > best.length || (current.length === best.length && (max < bestMax - 1e-9 || (Math.abs(max - bestMax) <= 1e-9 && total < bestTotal)))) {
        best = current.map((entry) => ({ ...entry, targetPosition: { ...entry.targetPosition } }));
        bestMax = max;
        bestTotal = total;
      }
      return;
    }
    const slot = slots[slotIndex];
    if (!slot) return;
    for (let index = 0; index < remaining.length; index += 1) {
      const player = remaining[index];
      if (!player) continue;
      const cost = assignmentCost(player, slot.targetPosition);
      visit(
        slotIndex + 1,
        remaining.filter((_, itemIndex) => itemIndex !== index),
        [...current, { playerId: player.id, role: slot.role, targetPosition: { ...slot.targetPosition } }],
        total + cost,
        Math.max(max, cost),
      );
    }
  };
  visit(0, [...players], [], 0, 0);
  return best;
}

function isPreviousAssignment(value: unknown): value is TeamRoleAssignment {
  if (!value || typeof value !== 'object') return false;
  const record = value as Partial<TeamRoleAssignment>;
  return Array.isArray(record.assignments)
    && typeof record.generatedAtSeconds === 'number'
    && typeof record.phase === 'string';
}

export function assignTeamRoles(
  world: Readonly<BotWorldSnapshot>,
  team: TeamId,
  previous?: unknown,
): TeamRoleAssignment {
  const phase = phaseForTeam(world, team);
  const players = teamPlayers(world, team);
  if (players.length === 0) return { assignments: [], switchCount: 0, phase, possessionPlayerId: null, generatedAtSeconds: world.timeSeconds };

  if (isPreviousAssignment(previous)
    && previous.phase === phase
    && previous.possessionPlayerId === (world.possessionTeam === team ? world.possessionPlayerId : null)
    && world.timeSeconds - previous.generatedAtSeconds >= 0
    && world.timeSeconds - previous.generatedAtSeconds < 0.28
    && previous.assignments.every((entry) => players.some((player) => player.id === entry.playerId))) {
    return {
      assignments: previous.assignments.map((entry) => ({ ...entry, targetPosition: { ...entry.targetPosition } })),
      switchCount: 0,
      phase,
      possessionPlayerId: previous.possessionPlayerId,
      generatedAtSeconds: world.timeSeconds,
    };
  }

  const blackboard = buildTacticalBlackboard(world, team);
  const keeper = blackboard.goalkeeper
    ?? [...players].sort((a, b) => horizontalDistance(a.position, keeperHome(world, team)) - horizontalDistance(b.position, keeperHome(world, team)) || (a.id < b.id ? -1 : 1))[0]!;
  const assignments: RoleAssignment[] = [{ playerId: keeper.id, role: 'goalkeeper', targetPosition: keeperHome(world, team) }];
  const fieldPlayers = players.filter((player) => player.id !== keeper.id);

  let remaining = [...fieldPlayers];
  if (phase === 'attack' && world.possessionPlayerId && remaining.some((player) => player.id === world.possessionPlayerId)) {
    const carrier = remaining.find((player) => player.id === world.possessionPlayerId)!;
    assignments.push({ playerId: carrier.id, role: 'ball-carrier', targetPosition: { ...world.ball.position, y: 0 } });
    remaining = remaining.filter((player) => player.id !== carrier.id);
    const slots: Array<{ role: Exclude<BotRole, 'goalkeeper' | 'ball-carrier'>; targetPosition: Vec3 }> = [];
    if (remaining.length >= 1) slots.push({ role: 'immediate-support', targetPosition: roleTarget(world, team, 'immediate-support', 0) });
    if (remaining.length >= 2) slots.push({ role: 'width-support', targetPosition: roleTarget(world, team, 'width-support', 1) });
    for (let index = 2; index < remaining.length; index += 1) {
      slots.push({ role: 'recovery-runner', targetPosition: roleTarget(world, team, 'recovery-runner', index) });
    }
    assignments.push(...assignByMinimumTravel(remaining, slots));
  } else {
    const slots: Array<{ role: Exclude<BotRole, 'goalkeeper' | 'ball-carrier'>; targetPosition: Vec3 }> = [];
    if (remaining.length >= 1) slots.push({ role: 'presser', targetPosition: roleTarget(world, team, 'presser', 0) });
    if (remaining.length >= 2) slots.push({ role: 'cover-defender', targetPosition: roleTarget(world, team, 'cover-defender', 1) });
    for (let index = 2; index < remaining.length; index += 1) {
      slots.push({ role: 'recovery-runner', targetPosition: roleTarget(world, team, 'recovery-runner', index) });
    }
    assignments.push(...assignByMinimumTravel(remaining, slots));
  }

  let switchCount = 0;
  if (isPreviousAssignment(previous)) {
    const previousRoles = new Map(previous.assignments.map((entry) => [entry.playerId, entry.role]));
    for (const assignment of assignments) if (previousRoles.get(assignment.playerId) !== assignment.role) switchCount += 1;
  }
  return {
    assignments,
    switchCount,
    phase,
    possessionPlayerId: world.possessionTeam === team ? world.possessionPlayerId : null,
    generatedAtSeconds: world.timeSeconds,
  };
}
