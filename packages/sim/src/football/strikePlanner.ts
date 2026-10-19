import { createFootballContactPlan, type FootballContactPlan } from './contactPlan';
import type { FootballBallSnapshot, FootballFoot, FootballVec3 } from './types';

const TICK_HZ = 60;
const MAX_STRIKE_REACH = 0.76;
// Setup may begin while the ball is one normal dribble stride ahead. This is an
// input-buffer envelope only: stepStrikeContact still enforces MAX_STRIKE_REACH
// at the actual contact beat, so no extra physical reach or ball magnetism is
// granted. Keeping this below the dribble planner's 1.48 m recovery boundary
// also prevents a genuinely lost ball from banking a future kick.
const MAX_STRIKE_SETUP_REACH = 1.22;

export interface StrikeContactRequest {
  kind: 'pass' | 'shot';
  sourceId: string;
  tick: number;
  gaitPhase: number;
  strideSeconds: number;
  actorPosition: Readonly<FootballVec3>;
  ball: Readonly<FootballBallSnapshot>;
  targetBallVelocity: Readonly<FootballVec3>;
  preferredFoot: Exclude<FootballFoot, 'both'>;
  balance: number;
}

export type StrikeContactStep =
  | { status: 'preparing'; plan: Readonly<FootballContactPlan> }
  | { status: 'contact'; plan: Readonly<FootballContactPlan> }
  | { status: 'missed'; plan: Readonly<FootballContactPlan>; reason: 'expired' | 'geometry-miss' };

function distance(a: Readonly<FootballVec3>, b: Readonly<FootballVec3>): number {
  return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
}

function finiteUnit(value: number): number {
  return Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0));
}

/**
 * Plans an interruptible strike beat from gait timing. The plan schedules
 * presentation and contact provenance only; it never owns or moves the ball.
 */
export function createStrikeContactPlan(
  input: Readonly<StrikeContactRequest>,
): FootballContactPlan | null {
  if (!Number.isSafeInteger(input.tick) || input.tick < 0) throw new RangeError('tick must be a non-negative integer');
  if (!Number.isFinite(input.gaitPhase) || !Number.isFinite(input.strideSeconds) || input.strideSeconds <= 0) {
    throw new TypeError('gait phase and stride duration must be finite');
  }

  const strideTicks = Math.max(12, Math.round(input.strideSeconds * TICK_HZ));
  const phase = ((input.gaitPhase % 1) + 1) % 1;
  const preferredOffset = input.preferredFoot === 'left' ? 0.5 : 0;
  const footPhase = (phase + preferredOffset) % 1;
  const untilSwing = ((0.72 - footPhase + 1) % 1) * strideTicks;
  const contactDelay = Math.max(5, Math.min(18, Math.ceil(untilSwing)));
  const contactTick = input.tick + contactDelay;
  // A legal action must be visible immediately even though the actual impulse
  // still waits for the gait-timed contact beat. Presentation can start the
  // support/setup motion now without granting ball ownership or teleporting it.
  const prepareTick = input.tick;
  const seconds = contactDelay / TICK_HZ;
  const expectedBallPoint = {
    x: input.ball.position.x + input.ball.velocity.x * seconds,
    y: Math.max(input.ball.radius, input.ball.position.y + input.ball.velocity.y * seconds),
    z: input.ball.position.z + input.ball.velocity.z * seconds,
  };
  const expectedFootPoint = { ...expectedBallPoint, y: Math.max(0.06, expectedBallPoint.y - input.ball.radius * 0.22) };

  // Accept a short approach setup so pass/shot input during a normal knock-on
  // is not discarded before the next gait beat. This does NOT authorize the
  // strike itself; contact-time geometry below remains at MAX_STRIKE_REACH.
  if (distance(input.actorPosition, input.ball.position) > MAX_STRIKE_SETUP_REACH) return null;

  const balance = finiteUnit(input.balance);
  return createFootballContactPlan({
    sourceId: input.sourceId,
    kind: input.kind,
    foot: input.preferredFoot,
    surface: input.kind === 'shot' ? 'instep' : 'inside',
    prepareTick,
    contactTick,
    recoveryEndTick: contactTick + Math.max(5, Math.round(strideTicks * 0.2)),
    expectedBallPoint,
    expectedFootPoint,
    targetBallVelocity: { ...input.targetBallVelocity },
    maxLinearImpulse: input.kind === 'shot' ? 15.5 : 12.5,
    maxAngularImpulse: input.kind === 'shot' ? 64 : 22,
    timingWindowTicks: 1,
    geometryTolerance: 0.24,
    quality: 0.55 + balance * 0.45,
    reason: balance < 0.45 ? 'rushed-off-balance-strike' : 'gait-planned-strike',
  });
}

/** Revalidates the moving ball and actor reach on the planned contact tick. */
export function stepStrikeContact(
  plan: Readonly<FootballContactPlan>,
  tick: number,
  actorPosition: Readonly<FootballVec3>,
  ball: Readonly<FootballBallSnapshot>,
): StrikeContactStep {
  if (tick < plan.contactTick - plan.timingWindowTicks) return { status: 'preparing', plan };
  if (tick > plan.contactTick + plan.timingWindowTicks) return { status: 'missed', plan, reason: 'expired' };
  if (
    distance(ball.position, plan.expectedBallPoint) > plan.geometryTolerance
    || distance(actorPosition, plan.expectedFootPoint) > MAX_STRIKE_REACH
  ) return { status: 'missed', plan, reason: 'geometry-miss' };
  return { status: 'contact', plan };
}
