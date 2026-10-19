import {
  applyBallContact,
  clampFootball,
  clampVecMagnitude,
  cloneFootballBall,
  finiteFootball,
  type BallContactCommand,
  type FootballBallSnapshot,
  type FootballFoot,
  type FootballVec3,
} from './types';

export type FootballContactSurface = 'inside' | 'outside' | 'instep' | 'sole' | 'toe';
export type FootballPlannedContactKind = 'dribble' | 'trap' | 'pass' | 'shot';

export interface FootballContactPlanSeed {
  sourceId: string;
  kind: FootballPlannedContactKind;
  foot: FootballFoot;
  surface: FootballContactSurface;
  prepareTick: number;
  contactTick: number;
  recoveryEndTick: number;
  expectedBallPoint: FootballVec3;
  expectedFootPoint: FootballVec3;
  targetBallVelocity: FootballVec3;
  maxLinearImpulse: number;
  maxAngularImpulse: number;
  timingWindowTicks: number;
  geometryTolerance: number;
  quality: number;
  reason: string;
}

export interface FootballContactPlan extends FootballContactPlanSeed {
  /** Stable identifier derived only from authoritative plan inputs. */
  eventId: string;
}

export type PlannedContactExecutionReason =
  | 'ok'
  | 'no-plan'
  | 'too-early'
  | 'missed-window'
  | 'expired'
  | 'geometry-miss'
  | 'already-consumed';

export interface PlannedFootballContactExecution {
  applied: boolean;
  reason: PlannedContactExecutionReason;
  ball: FootballBallSnapshot;
  consumedEventIds: readonly string[];
}

export interface ExecutePlannedFootballContactInput {
  plan: Readonly<FootballContactPlan> | null;
  tick: number;
  actorPosition: FootballVec3;
  ball: Readonly<FootballBallSnapshot>;
  command: Readonly<BallContactCommand>;
  consumedEventIds?: readonly string[];
}

const EVENT_QUANTIZE = 1_000_000;
const MAX_CONTACT_REACH = 1.65;

function finiteVec3(value: Readonly<FootballVec3>): FootballVec3 {
  return {
    x: finiteFootball(value.x),
    y: finiteFootball(value.y),
    z: finiteFootball(value.z),
  };
}

function nonNegativeInteger(value: number, field: string): number {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new RangeError(`${field} must be a non-negative safe integer`);
  }
  return value;
}

function q(value: number): number {
  return Math.round(finiteFootball(value) * EVENT_QUANTIZE);
}

function hashString32(value: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}

function stablePlanPayload(seed: Readonly<FootballContactPlanSeed>): string {
  return [
    seed.sourceId,
    seed.kind,
    seed.foot,
    seed.surface,
    seed.prepareTick,
    seed.contactTick,
    seed.recoveryEndTick,
    q(seed.expectedBallPoint.x), q(seed.expectedBallPoint.y), q(seed.expectedBallPoint.z),
    q(seed.expectedFootPoint.x), q(seed.expectedFootPoint.y), q(seed.expectedFootPoint.z),
    q(seed.targetBallVelocity.x), q(seed.targetBallVelocity.y), q(seed.targetBallVelocity.z),
    q(seed.maxLinearImpulse),
    q(seed.maxAngularImpulse),
    seed.timingWindowTicks,
    q(seed.geometryTolerance),
    q(seed.quality),
    seed.reason,
  ].join('|');
}

function distance3(a: Readonly<FootballVec3>, b: Readonly<FootballVec3>): number {
  return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
}

function immutablePlan(seed: Readonly<FootballContactPlanSeed>, eventId: string): FootballContactPlan {
  const plan: FootballContactPlan = {
    ...seed,
    expectedBallPoint: Object.freeze({ ...seed.expectedBallPoint }),
    expectedFootPoint: Object.freeze({ ...seed.expectedFootPoint }),
    targetBallVelocity: Object.freeze({ ...seed.targetBallVelocity }),
    eventId,
  };
  return Object.freeze(plan);
}

export function createFootballContactPlan(seed: Readonly<FootballContactPlanSeed>): FootballContactPlan {
  if (typeof seed.sourceId !== 'string' || seed.sourceId.length === 0 || seed.sourceId.length > 64) {
    throw new TypeError('sourceId must be a non-empty string up to 64 characters');
  }
  if (typeof seed.reason !== 'string' || seed.reason.length === 0 || seed.reason.length > 160) {
    throw new TypeError('reason must be a non-empty string up to 160 characters');
  }

  const prepareTick = nonNegativeInteger(seed.prepareTick, 'prepareTick');
  const contactTick = nonNegativeInteger(seed.contactTick, 'contactTick');
  const recoveryEndTick = nonNegativeInteger(seed.recoveryEndTick, 'recoveryEndTick');
  const timingWindowTicks = nonNegativeInteger(seed.timingWindowTicks, 'timingWindowTicks');
  if (contactTick < prepareTick) throw new RangeError('contactTick must be >= prepareTick');
  if (recoveryEndTick < contactTick) throw new RangeError('recoveryEndTick must be >= contactTick');

  const normalized: FootballContactPlanSeed = {
    sourceId: seed.sourceId,
    kind: seed.kind,
    foot: seed.foot,
    surface: seed.surface,
    prepareTick,
    contactTick,
    recoveryEndTick,
    expectedBallPoint: finiteVec3(seed.expectedBallPoint),
    expectedFootPoint: finiteVec3(seed.expectedFootPoint),
    targetBallVelocity: finiteVec3(seed.targetBallVelocity),
    maxLinearImpulse: Math.max(0, finiteFootball(seed.maxLinearImpulse)),
    maxAngularImpulse: Math.max(0, finiteFootball(seed.maxAngularImpulse)),
    timingWindowTicks,
    geometryTolerance: Math.max(0, finiteFootball(seed.geometryTolerance)),
    quality: clampFootball(finiteFootball(seed.quality), 0, 1),
    reason: seed.reason,
  };

  const eventId = `contact:${hashString32(stablePlanPayload(normalized))}`;
  return immutablePlan(normalized, eventId);
}

function unchanged(
  input: Readonly<ExecutePlannedFootballContactInput>,
  reason: Exclude<PlannedContactExecutionReason, 'ok'>,
): PlannedFootballContactExecution {
  return {
    applied: false,
    reason,
    ball: cloneFootballBall(input.ball),
    consumedEventIds: [...(input.consumedEventIds ?? [])],
  };
}

export function executePlannedFootballContact(
  input: Readonly<ExecutePlannedFootballContactInput>,
): PlannedFootballContactExecution {
  const plan = input.plan;
  if (!plan) return unchanged(input, 'no-plan');

  const tick = nonNegativeInteger(input.tick, 'tick');
  const consumed = input.consumedEventIds ?? [];
  if (consumed.includes(plan.eventId)) return unchanged(input, 'already-consumed');
  if (tick > plan.recoveryEndTick) return unchanged(input, 'expired');
  if (tick < plan.contactTick - plan.timingWindowTicks) return unchanged(input, 'too-early');
  if (tick > plan.contactTick + plan.timingWindowTicks) return unchanged(input, 'missed-window');

  // Revalidate the actual moving ball and the planned foot at the contact tick.
  // The plan is never ownership: if either has drifted beyond the physical
  // envelope, the event simply misses and Stage 04 continues the free ball.
  const ballError = distance3(input.ball.position, plan.expectedBallPoint);
  const footBallDistance = distance3(input.ball.position, plan.expectedFootPoint);
  const actorFootDistance = distance3(input.actorPosition, plan.expectedFootPoint);
  const legalFootBallDistance = plan.geometryTolerance + Math.max(0, input.ball.radius);
  if (
    ballError > plan.geometryTolerance
    || footBallDistance > legalFootBallDistance
    || actorFootDistance > MAX_CONTACT_REACH
  ) {
    return unchanged(input, 'geometry-miss');
  }

  const boundedCommand: BallContactCommand = {
    ...input.command,
    deltaVelocity: { ...input.command.deltaVelocity },
    angularVelocityDelta: clampVecMagnitude(
      input.command.angularVelocityDelta,
      plan.maxAngularImpulse,
    ),
    maxImpulse: Math.min(
      Math.max(0, finiteFootball(input.command.maxImpulse)),
      plan.maxLinearImpulse,
    ),
    diagnostic: `${input.command.diagnostic} contact=${plan.eventId} foot=${plan.foot} surface=${plan.surface}`,
  };

  return {
    applied: true,
    reason: 'ok',
    ball: applyBallContact(input.ball, boundedCommand),
    consumedEventIds: [...consumed, plan.eventId],
  };
}
