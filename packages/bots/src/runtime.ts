import { computeGoalkeeperDecision } from './goalkeeper';
import { assignTeamRoles, type TeamRoleAssignment } from './roles';
import { chooseCarrierAction, chooseDefensiveAction } from './utility';
import {
  attackingDirection,
  clamp01,
  findPlayer,
  horizontalDistance,
  normalizeHorizontal,
  opponentGoalZ,
  type BotRole,
  type BotWorldSnapshot,
  type TeamId,
  type Vec3,
} from './types';

export const TACTICAL_DECISION_HZ = 10;
export const TACTICAL_DECISION_INTERVAL = 1 / TACTICAL_DECISION_HZ;

export interface TeamBotIntent {
  playerId: string;
  role: BotRole;
  targetPosition: Vec3;
  targetPlayerId: string | null;
  moveX: number;
  moveY: number;
  aimYaw: number;
  sprint: boolean;
  action: string;
  utilityScore: number;
}

export interface TeamBotRuntimeState {
  roles: TeamRoleAssignment;
  lastDecisionSeconds: number;
  lastPossessionTeam: TeamId | null;
  lastPossessionPlayerId: string | null;
  lastBallVelocity: Vec3;
}

export interface TeamBotStepResult {
  state: TeamBotRuntimeState;
  intents: TeamBotIntent[];
  reevaluated: boolean;
}

function emptyRoles(): TeamRoleAssignment {
  return {
    assignments: [],
    switchCount: 0,
    phase: 'loose',
    possessionPlayerId: null,
    generatedAtSeconds: Number.NEGATIVE_INFINITY,
  };
}

export function createTeamBotRuntime(): TeamBotRuntimeState {
  return {
    roles: emptyRoles(),
    lastDecisionSeconds: Number.NEGATIVE_INFINITY,
    lastPossessionTeam: null,
    lastPossessionPlayerId: null,
    lastBallVelocity: { x: 0, y: 0, z: 0 },
  };
}

function ballEventIsCritical(world: Readonly<BotWorldSnapshot>, state: Readonly<TeamBotRuntimeState>): boolean {
  const dx = world.ball.velocity.x - state.lastBallVelocity.x;
  const dy = world.ball.velocity.y - state.lastBallVelocity.y;
  const dz = world.ball.velocity.z - state.lastBallVelocity.z;
  return Math.hypot(dx, dy, dz) >= 4.5;
}

function targetForRole(
  world: Readonly<BotWorldSnapshot>,
  team: TeamId,
  assignment: TeamRoleAssignment['assignments'][number],
): { target: Vec3; targetPlayerId: string | null; action: string; utilityScore: number } {
  const player = findPlayer(world, assignment.playerId);
  if (assignment.role === 'goalkeeper') {
    const decision = computeGoalkeeperDecision(world, player.id);
    return {
      target: decision.targetPosition,
      targetPlayerId: decision.distributionTargetId,
      action: decision.kind,
      utilityScore: 1,
    };
  }
  if (assignment.role === 'ball-carrier') {
    const decision = chooseCarrierAction(world, player.id);
    const targetPlayer = decision.targetPlayerId ? findPlayer(world, decision.targetPlayerId) : null;
    const direction = attackingDirection(team);
    const actionTarget = decision.kind === 'pass' && targetPlayer
      ? targetPlayer.position
      : decision.kind === 'shoot' || decision.kind === 'dribble' || decision.kind === 'clear'
        ? { x: 0, y: 0, z: opponentGoalZ(world, team) - direction * (decision.kind === 'dribble' ? 5 : 0) }
        : assignment.targetPosition;
    return {
      target: actionTarget,
      targetPlayerId: decision.targetPlayerId,
      action: decision.kind,
      utilityScore: decision.score,
    };
  }
  if (assignment.role === 'presser' || assignment.role === 'cover-defender' || assignment.role === 'recovery-runner') {
    const decision = chooseDefensiveAction(world, player.id);
    return {
      target: decision.targetPosition,
      targetPlayerId: world.possessionTeam !== team ? world.possessionPlayerId : null,
      action: decision.kind,
      utilityScore: decision.score,
    };
  }
  return {
    target: assignment.targetPosition,
    targetPlayerId: null,
    action: assignment.role,
    utilityScore: 0.7,
  };
}

function steeringIntent(
  world: Readonly<BotWorldSnapshot>,
  team: TeamId,
  assignment: TeamRoleAssignment['assignments'][number],
): TeamBotIntent {
  const player = findPlayer(world, assignment.playerId);
  const tactical = targetForRole(world, team, assignment);
  const dx = tactical.target.x - player.position.x;
  const dz = tactical.target.z - player.position.z;
  const distance = Math.hypot(dx, dz);
  const direction = normalizeHorizontal({ x: dx, z: dz });
  const intensity = distance <= 0.12 ? 0 : clamp01(distance / 2.4);
  const moveX = direction.x * intensity;
  const moveY = direction.z * intensity;
  const sprint = distance > 4
    && (assignment.role === 'presser' || assignment.role === 'recovery-runner' || assignment.role === 'width-support');
  const aimTarget = assignment.role === 'goalkeeper'
    ? world.ball.position
    : tactical.targetPlayerId
      ? findPlayer(world, tactical.targetPlayerId).position
      : tactical.target;
  const aimYaw = Math.atan2(aimTarget.x - player.position.x, aimTarget.z - player.position.z);
  return {
    playerId: player.id,
    role: assignment.role,
    targetPosition: { ...tactical.target },
    targetPlayerId: tactical.targetPlayerId,
    moveX,
    moveY,
    aimYaw,
    sprint,
    action: tactical.action,
    utilityScore: tactical.utilityScore,
  };
}

export function stepTeamBotRuntime(
  world: Readonly<BotWorldSnapshot>,
  team: TeamId,
  state: Readonly<TeamBotRuntimeState>,
): TeamBotStepResult {
  const possessionChanged = state.lastPossessionTeam !== world.possessionTeam
    || state.lastPossessionPlayerId !== world.possessionPlayerId;
  const intervalElapsed = world.timeSeconds - state.lastDecisionSeconds >= TACTICAL_DECISION_INTERVAL - 1e-9;
  const missingRoles = state.roles.assignments.length === 0;
  const criticalBallEvent = ballEventIsCritical(world, state);
  const reevaluated = missingRoles || possessionChanged || intervalElapsed || criticalBallEvent;
  const roles = reevaluated ? assignTeamRoles(world, team, state.roles) : state.roles;
  const intents = roles.assignments.map((assignment) => steeringIntent(world, team, assignment));
  return {
    state: {
      roles,
      lastDecisionSeconds: reevaluated ? world.timeSeconds : state.lastDecisionSeconds,
      lastPossessionTeam: world.possessionTeam,
      lastPossessionPlayerId: world.possessionPlayerId,
      lastBallVelocity: { ...world.ball.velocity },
    },
    intents,
    reevaluated,
  };
}

export function supportDistanceFromRoles(roles: Readonly<TeamRoleAssignment>): number | null {
  const carrier = roles.assignments.find((entry) => entry.role === 'ball-carrier');
  const support = roles.assignments.find((entry) => entry.role === 'immediate-support');
  if (!carrier || !support) return null;
  return horizontalDistance(carrier.targetPosition, support.targetPosition);
}
