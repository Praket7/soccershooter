import { computeGoalkeeperDecision } from './goalkeeper';
import {
  deterministicDifficultyNoise,
  difficultyParameterSnapshot,
  type BotDifficultyParameters,
  type BotDifficultyTier,
} from './difficulty';
import { personalityWeight, type BotPersonalityId } from './personalities';
import { assignTeamRoles, type TeamRoleAssignment } from './roles';
import { chooseCarrierAction, chooseDefensiveAction, chooseDribbleTarget, chooseOffBallAction, type BotDecisionContext } from './utility';
import {
  attackingDirection,
  clamp01,
  fieldClamp,
  findPlayer,
  horizontalDistance,
  normalizeHorizontal,
  opponentGoalZ,
  type BotPlayerSnapshot,
  type BotRole,
  type BotWorldSnapshot,
  type TeamId,
  type Vec3,
} from './types';

export const TACTICAL_DECISION_HZ = 10;
export const TACTICAL_DECISION_INTERVAL = 1 / TACTICAL_DECISION_HZ;
const TEAMMATE_SEPARATION_RADIUS = 3;

export interface TeamBotRuntimeConfig {
  tier?: BotDifficultyTier;
  seed?: number;
  personalitiesByPlayerId?: Readonly<Record<string, BotPersonalityId>>;
  playstyle?: TeamPlaystyle;
}

export const TEAM_PLAYSTYLES = ['balanced', 'possession', 'counter', 'high-press', 'direct'] as const;
export type TeamPlaystyle = (typeof TEAM_PLAYSTYLES)[number];

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
  technique?: string | null;
}

export interface TeamBotRuntimeState {
  roles: TeamRoleAssignment;
  lastDecisionSeconds: number;
  lastPossessionTeam: TeamId | null;
  lastPossessionPlayerId: string | null;
  lastBallVelocity: Vec3;
  pendingCriticalSinceSeconds?: number | null;
  lastIntents?: TeamBotIntent[];
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

function contextForPlayer(
  playerId: string,
  difficulty: Readonly<BotDifficultyParameters>,
  config: Readonly<TeamBotRuntimeConfig>,
  previousOffBallTarget?: Vec3,
): BotDecisionContext {
  return {
    personalityId: config.personalitiesByPlayerId?.[playerId] ?? 'balanced',
    predictionHorizonSeconds: difficulty.predictionHorizonSeconds,
    passRiskTolerance: difficulty.passRiskTolerance,
    coordinatedRunFrequency: difficulty.coordinatedRunFrequency,
    defensiveAnticipation: difficulty.defensiveAnticipation,
    playstyle: config.playstyle ?? 'balanced',
    ...(previousOffBallTarget ? { previousOffBallTarget: { ...previousOffBallTarget } } : {}),
  };
}

function targetForRole(
  world: Readonly<BotWorldSnapshot>,
  team: TeamId,
  assignment: TeamRoleAssignment['assignments'][number],
  context?: Readonly<BotDecisionContext>,
): { target: Vec3; targetPlayerId: string | null; action: string; utilityScore: number } {
  const player = findPlayer(world, assignment.playerId);
  if (assignment.role === 'goalkeeper') {
    const decision = computeGoalkeeperDecision(world, player.id);
    return {
      target: decision.targetPosition,
      targetPlayerId: decision.distributionTargetId,
      action: decision.kind,
      utilityScore: personalityWeight(context?.personalityId ?? 'balanced', 'goalkeeper', decision.kind),
    };
  }
  if (assignment.role === 'receiver') {
    const horizon = Math.max(0, Math.min(0.8, context?.predictionHorizonSeconds ?? 0.35));
    return {
      target: fieldClamp(world, {
        x: world.ball.position.x + world.ball.velocity.x * horizon,
        y: 0,
        z: world.ball.position.z + world.ball.velocity.z * horizon,
      }, 0.45),
      targetPlayerId: null,
      action: 'receive',
      utilityScore: 0.82,
    };
  }
  if (assignment.role === 'ball-carrier') {
    const decision = chooseCarrierAction(world, player.id, context);
    const direction = attackingDirection(team);
    const actionTarget = decision.kind === 'pass' || decision.kind === 'shoot'
      // Aim at the outlet or goal, but keep the movement target beside the
      // physical ball so a legal pass/shot contact remains available. Running
      // at the tactical destination can pull the carrier outside kick range.
      ? {
        x: world.ball.position.x,
        y: 0,
        z: world.ball.position.z + attackingDirection(team) * 0.45,
      }
      : decision.kind === 'dribble' || decision.kind === 'protect'
      ? chooseDribbleTarget(world, player.id, context)
      : decision.kind === 'clear'
        ? { x: 0, y: 0, z: opponentGoalZ(world, team) }
        : assignment.targetPosition;
    return {
      target: actionTarget,
      targetPlayerId: decision.targetPlayerId,
      action: decision.kind,
      utilityScore: decision.score,
    };
  }
  if (assignment.role === 'presser' || assignment.role === 'cover-defender' || assignment.role === 'recovery-runner') {
    const decision = chooseDefensiveAction(world, player.id, context);
    return {
      target: decision.targetPosition,
      targetPlayerId: world.possessionTeam !== team ? world.possessionPlayerId : null,
      action: decision.kind,
      utilityScore: decision.score,
    };
  }
  if (assignment.role === 'immediate-support' || assignment.role === 'width-support') {
    const decision = chooseOffBallAction(world, player.id, assignment.role, context);
    return {
      target: decision.targetPosition,
      targetPlayerId: null,
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

export function selectShotTechnique(
  world: Readonly<BotWorldSnapshot>,
  playerId: string,
  repertoire: readonly string[],
): string | null {
  const player = findPlayer(world, playerId);
  const goalZ = opponentGoalZ(world, player.team);
  const distance = Math.hypot(player.position.x, goalZ - player.position.z);
  const angle = Math.atan2(Math.abs(player.position.x), Math.max(0.1, Math.abs(goalZ - player.position.z)));
  const goalkeeper = world.players.find((candidate) => candidate.team !== player.team && candidate.goalkeeper);
  const keeperAdvanced = goalkeeper && Math.abs(goalZ - goalkeeper.position.z) > 3.8;
  if (keeperAdvanced && distance < 15 && repertoire.includes('chip-shot')) return 'chip-shot';
  if (angle > 0.39 && repertoire.includes('finesse-shot')) return 'finesse-shot';
  if (distance > 12.5 && repertoire.includes('driven-shot')) return 'driven-shot';
  if (repertoire.includes('normal-shot')) return 'normal-shot';
  if (angle > 0.30 && repertoire.includes('finesse-shot')) return 'finesse-shot';
  return repertoire.find((item) => item.endsWith('-shot')) ?? null;
}

function selectTechnique(action: string, repertoire: readonly string[], passDistance = 0, world?: Readonly<BotWorldSnapshot>, playerId?: string): string | null {
  if (action === 'distribute') {
    return repertoire.find((item) => item === 'ground-pass')
      ?? repertoire.find((item) => item === 'lofted-pass')
      ?? repertoire.find((item) => item.endsWith('-pass'))
      ?? null;
  }
  if (action === 'pass') {
    return (passDistance >= 5 ? repertoire.find((item) => item === 'through-pass') : undefined)
      ?? repertoire.find((item) => item === 'ground-pass')
      ?? repertoire.find((item) => item.endsWith('-pass'))
      ?? null;
  }
  if (action === 'shoot') {
    return world && playerId ? selectShotTechnique(world, playerId, repertoire) : repertoire.find((item) => item === 'normal-shot') ?? repertoire.find((item) => item.endsWith('-shot')) ?? null;
  }
  if (action === 'dribble') {
    return repertoire.find((item) => item.includes('dribble')) ?? null;
  }
  return null;
}

function steeringIntent(
  world: Readonly<BotWorldSnapshot>,
  team: TeamId,
  assignment: TeamRoleAssignment['assignments'][number],
  context?: Readonly<BotDecisionContext>,
  difficulty?: Readonly<BotDifficultyParameters>,
  config?: Readonly<TeamBotRuntimeConfig>,
): TeamBotIntent {
  const player = findPlayer(world, assignment.playerId);
  const tactical = targetForRole(world, team, assignment, context);
  const playstyle = context?.playstyle ?? 'balanced';
  if (playstyle !== 'balanced' && assignment.role !== 'goalkeeper') {
    const direction = attackingDirection(team);
    const ball = world.ball.position;
    if (assignment.role === 'ball-carrier') {
      if (playstyle === 'counter' && tactical.action !== 'shoot' && tactical.action !== 'clear' && tactical.action !== 'pass') {
        tactical.target = { x: player.position.x * 0.65, y: 0, z: player.position.z + direction * 8.5 };
      } else if (playstyle === 'direct' && tactical.action === 'dribble') {
        tactical.target = { x: player.position.x * 0.35, y: 0, z: player.position.z + direction * 6.8 };
      } else if (playstyle === 'possession' && tactical.action === 'dribble') {
        tactical.target = { x: player.position.x * 0.8, y: 0, z: player.position.z + direction * 3.8 };
      }
    } else if (assignment.role === 'immediate-support' || assignment.role === 'width-support') {
      if (playstyle === 'possession') {
        tactical.target.z = Math.max(-world.field.halfLength + 0.8, Math.min(world.field.halfLength - 0.8, tactical.target.z + direction * 1.4));
      } else if (playstyle === 'counter' || playstyle === 'direct') {
        const forwardRun = playstyle === 'direct' ? 3.8 : 1.8;
        tactical.target.z = Math.max(
          -world.field.halfLength + 0.8,
          Math.min(world.field.halfLength - 0.8, tactical.target.z + direction * forwardRun),
        );
      }
    } else if (playstyle === 'high-press' && (assignment.role === 'presser' || assignment.role === 'cover-defender' || assignment.role === 'recovery-runner')) {
      tactical.target = { x: ball.x * 0.82 + player.position.x * 0.18, y: 0, z: ball.z * 0.82 + player.position.z * 0.18 };
    }
  }
  const dx = tactical.target.x - player.position.x;
  const dz = tactical.target.z - player.position.z;
  const distance = Math.hypot(dx, dz);
  const direction = normalizeHorizontal({ x: dx, z: dz });
  const intensity = distance <= 0.12 ? 0 : clamp01(distance / 2.4);
  const moveX = direction.x * intensity;
  const moveY = direction.z * intensity;
  const nearestOpponentDistance = Math.min(...world.players
    .filter((candidate) => candidate.team !== player.team && !candidate.goalkeeper)
    .map((candidate) => horizontalDistance(candidate.position, player.position)), Number.POSITIVE_INFINITY);
  const openCarryRun = assignment.role === 'ball-carrier'
    && tactical.action === 'dribble'
    && distance > 5
    && nearestOpponentDistance > 3.5;
  const sprint = distance > 4
    && (assignment.role === 'presser' || assignment.role === 'recovery-runner' || assignment.role === 'width-support' || assignment.role === 'receiver' || openCarryRun);
  const goalkeeperRecoverySprint = assignment.role === 'goalkeeper' && distance > 1.1;
  const aimTarget = assignment.role === 'goalkeeper'
    ? world.ball.position
    : tactical.action === 'shoot'
      ? { x: 0, y: 0, z: opponentGoalZ(world, team) }
      : tactical.targetPlayerId
        ? findPlayer(world, tactical.targetPlayerId).position
        : tactical.target;
  let aimYaw = Math.atan2(aimTarget.x - player.position.x, aimTarget.z - player.position.z);
  if (difficulty && config) {
    aimYaw += deterministicDifficultyNoise(config.seed ?? 0x7007, world.tick, player.id, 'aim') * difficulty.aimErrorRadians;
  }
  return {
    playerId: player.id,
    role: assignment.role,
    targetPosition: { ...tactical.target },
    targetPlayerId: tactical.targetPlayerId,
    moveX,
    moveY,
    aimYaw,
    sprint: sprint || goalkeeperRecoverySprint,
    action: tactical.action,
    utilityScore: tactical.utilityScore,
    ...(difficulty ? {
      technique: selectTechnique(
        tactical.action,
        difficulty.skillRepertoire,
        tactical.targetPlayerId ? horizontalDistance(player.position, findPlayer(world, tactical.targetPlayerId).position) : 0,
        world,
        player.id,
      ),
    } : {}),
  };
}

function applyTeammateSeparation(
  world: Readonly<BotWorldSnapshot>,
  team: TeamId,
  intents: readonly TeamBotIntent[],
): TeamBotIntent[] {
  const fieldPlayers = world.players.filter((player) => player.team === team && !player.goalkeeper);
  return intents.map((intent) => {
    const player = findPlayer(world, intent.playerId);
    if (player.goalkeeper) return intent;
    let repelX = 0;
    let repelZ = 0;
    for (const teammate of fieldPlayers) {
      if (teammate.id === player.id) continue;
      const dx = player.position.x - teammate.position.x;
      const dz = player.position.z - teammate.position.z;
      const distance = Math.hypot(dx, dz);
      if (distance >= TEAMMATE_SEPARATION_RADIUS) continue;
      const fallbackX = player.id < teammate.id ? -1 : 1;
      const direction = distance > 1e-6 ? { x: dx / distance, z: dz / distance } : { x: fallbackX, z: 0 };
      const strength = clamp01((TEAMMATE_SEPARATION_RADIUS - distance) / TEAMMATE_SEPARATION_RADIUS) * 0.9;
      repelX += direction.x * strength;
      repelZ += direction.z * strength;
    }
    let moveX = intent.moveX + repelX;
    let moveY = intent.moveY + repelZ;
    const magnitude = Math.hypot(moveX, moveY);
    if (magnitude > 1) {
      moveX /= magnitude;
      moveY /= magnitude;
    }
    return { ...intent, moveX, moveY };
  });
}

function noisyPlayer(
  player: Readonly<BotPlayerSnapshot>,
  world: Readonly<BotWorldSnapshot>,
  config: Readonly<TeamBotRuntimeConfig>,
  difficulty: Readonly<BotDifficultyParameters>,
): BotPlayerSnapshot {
  const seed = config.seed ?? 0x7007;
  return {
    ...player,
    position: {
      ...player.position,
      x: player.position.x + deterministicDifficultyNoise(seed, world.tick, player.id, 'observation-x') * difficulty.observationNoiseMetres,
      z: player.position.z + deterministicDifficultyNoise(seed, world.tick, player.id, 'observation-z') * difficulty.observationNoiseMetres,
    },
    velocity: { ...player.velocity },
  };
}

function perceivedWorld(
  world: Readonly<BotWorldSnapshot>,
  config: Readonly<TeamBotRuntimeConfig>,
  difficulty: Readonly<BotDifficultyParameters>,
): BotWorldSnapshot {
  const seed = config.seed ?? 0x7007;
  return {
    ...world,
    field: { ...world.field },
    ball: {
      position: {
        ...world.ball.position,
        x: world.ball.position.x + deterministicDifficultyNoise(seed, world.tick, 'ball', 'observation-x') * difficulty.observationNoiseMetres,
        z: world.ball.position.z + deterministicDifficultyNoise(seed, world.tick, 'ball', 'observation-z') * difficulty.observationNoiseMetres,
      },
      velocity: { ...world.ball.velocity },
    },
    players: world.players.map((player) => noisyPlayer(player, world, config, difficulty)),
    ...(world.matchState ? { matchState: { ...world.matchState } } : {}),
  };
}

function refreshCachedIntents(
  world: Readonly<BotWorldSnapshot>,
  team: TeamId,
  cached: readonly TeamBotIntent[],
): TeamBotIntent[] {
  const refreshed = cached.map((intent) => {
    const player = findPlayer(world, intent.playerId);
    const dx = intent.targetPosition.x - player.position.x;
    const dz = intent.targetPosition.z - player.position.z;
    const distance = Math.hypot(dx, dz);
    const direction = normalizeHorizontal({ x: dx, z: dz });
    const intensity = distance <= 0.12 ? 0 : clamp01(distance / 2.4);
    return { ...intent, moveX: direction.x * intensity, moveY: direction.z * intensity };
  });
  return applyTeammateSeparation(world, team, refreshed);
}

function legacyStep(
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
  const baseIntents = roles.assignments.map((assignment) => steeringIntent(world, team, assignment));
  const intents = applyTeammateSeparation(world, team, baseIntents);
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

export function stepTeamBotRuntime(
  world: Readonly<BotWorldSnapshot>,
  team: TeamId,
  state: Readonly<TeamBotRuntimeState>,
  config?: Readonly<TeamBotRuntimeConfig>,
): TeamBotStepResult {
  if (!config) return legacyStep(world, team, state);

  const receivedPass = world.possessionTeam === team
    && world.possessionPlayerId !== null
    && world.passReceiverId === world.possessionPlayerId;
  const effectiveConfig = config.playstyle || !receivedPass
    ? config
    : { ...config, playstyle: 'possession' as const };

  const difficulty = difficultyParameterSnapshot(effectiveConfig.tier ?? 'standard');
  const cognitionWorld = perceivedWorld(world, effectiveConfig, difficulty);
  const missingRoles = state.roles.assignments.length === 0;
  const possessionChanged = state.lastPossessionTeam !== world.possessionTeam
    || state.lastPossessionPlayerId !== world.possessionPlayerId;
  const receiverChanged = state.roles.passReceiverId !== (world.passReceiverId ?? null);
  const teammateNowControlsOrReceives = possessionChanged && world.possessionTeam === team
    || receiverChanged && Boolean(world.passReceiverId
      && world.players.some((player) => player.id === world.passReceiverId && player.team === team));
  const criticalBallEvent = ballEventIsCritical(world, state);
  const criticalChange = possessionChanged || criticalBallEvent;
  const pendingSince = state.pendingCriticalSinceSeconds
    ?? (criticalChange && Number.isFinite(state.lastDecisionSeconds) ? state.lastDecisionSeconds : null);
  const criticalReady = criticalChange && pendingSince !== null
    && world.timeSeconds - pendingSince >= difficulty.reactionDelaySeconds - 1e-9;
  const intervalElapsed = world.timeSeconds - state.lastDecisionSeconds >= difficulty.tacticalEvaluationIntervalSeconds - 1e-9;
  const reevaluated = missingRoles || teammateNowControlsOrReceives || criticalReady || (!criticalChange && intervalElapsed);

  if (!reevaluated && state.lastIntents?.length) {
    return {
      state: {
        ...state,
        pendingCriticalSinceSeconds: criticalChange ? pendingSince : state.pendingCriticalSinceSeconds ?? null,
      },
      intents: refreshCachedIntents(world, team, state.lastIntents),
      reevaluated: false,
    };
  }

  const roles = reevaluated ? assignTeamRoles(cognitionWorld, team, state.roles) : state.roles;
  const baseIntents = roles.assignments.map((assignment) => {
    const previousTarget = state.lastIntents?.find((intent) => intent.playerId === assignment.playerId)?.targetPosition;
    const context = contextForPlayer(assignment.playerId, difficulty, effectiveConfig, previousTarget);
    return steeringIntent(cognitionWorld, team, assignment, context, difficulty, effectiveConfig);
  });
  const intents = applyTeammateSeparation(world, team, baseIntents);
  return {
    state: {
      roles,
      lastDecisionSeconds: reevaluated ? world.timeSeconds : state.lastDecisionSeconds,
      lastPossessionTeam: reevaluated ? world.possessionTeam : state.lastPossessionTeam,
      lastPossessionPlayerId: reevaluated ? world.possessionPlayerId : state.lastPossessionPlayerId,
      lastBallVelocity: reevaluated ? { ...world.ball.velocity } : { ...state.lastBallVelocity },
      pendingCriticalSinceSeconds: reevaluated ? null : pendingSince,
      lastIntents: intents.map((intent) => ({ ...intent, targetPosition: { ...intent.targetPosition } })),
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
