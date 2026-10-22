import { createFootballContactPlan, type FootballContactPlan } from './contactPlan';
import type { FootballBallSnapshot, FootballFoot, FootballVec3 } from './types';

const TICK_HZ = 60;
const MAX_STRIKE_REACH = 0.76;
// Setup may begin while the ball is one normal dribble stride ahead. This is an
// Input-buffer envelope only. Contact reach is carried explicitly by the plan
// and rechecked on the actual beat; timing tolerance cannot silently widen it.
const MAX_STRIKE_SETUP_REACH = 1.22;
const MIN_CONTACT_DELAY_TICKS = 2;
const MAX_CONTACT_DELAY_TICKS = 8;
const PREFERRED_FOOT_BIAS = 0.34;
const APPROACH_SETUP_SPEED = 4.5;

export interface StrikeContactRequest {
  kind: 'pass' | 'shot';
  sourceId: string;
  tick: number;
  gaitPhase: number;
  strideSeconds: number;
  actorPosition: Readonly<FootballVec3>;
  /** Optional live root velocity. Older callers remain valid, but live player
   * control should provide it so the planner searches the moving intercept. */
  actorVelocity?: Readonly<FootballVec3>;
  ball: Readonly<FootballBallSnapshot>;
  targetBallVelocity: Readonly<FootballVec3>;
  preferredFoot: Exclude<FootballFoot, 'both'>;
  balance: number;
  /** Optional exact delay for moves with a visible setup before contact. */
  contactDelayTicks?: number;
  /** Skill-specific tolerance for the live contact beat. */
  maximumContactReach?: number;
  timingWindowTicks?: number;
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

function oppositeFoot(foot: Exclude<FootballFoot, 'both'>): Exclude<FootballFoot, 'both'> {
  return foot === 'left' ? 'right' : 'left';
}

function wrappedPhaseDistance(a: number, b: number): number {
  const raw = Math.abs(a - b) % 1;
  return Math.min(raw, 1 - raw);
}

function predictPoint(
  position: Readonly<FootballVec3>,
  velocity: Readonly<FootballVec3> | undefined,
  seconds: number,
): FootballVec3 {
  return {
    x: position.x + (velocity?.x ?? 0) * seconds,
    y: position.y + (velocity?.y ?? 0) * seconds,
    z: position.z + (velocity?.z ?? 0) * seconds,
  };
}

interface ContactCandidate {
  foot: Exclude<FootballFoot, 'both'>;
  delayTicks: number;
  expectedBallPoint: FootballVec3;
  score: number;
}

function inferredActorVelocity(input: Readonly<StrikeContactRequest>): FootballVec3 {
  if (input.actorVelocity) return { ...input.actorVelocity };
  const setupDistance = distance(input.actorPosition, input.ball.position);
  // Compatibility bridge for callers created before actorVelocity became part
  // of the strike contract. A ball already in the carry pocket is usually
  // co-moving with the athlete, so use its horizontal velocity for *planning*.
  if (setupDistance <= 0.95) {
    return { x: input.ball.velocity.x, y: 0, z: input.ball.velocity.z };
  }
  // A ball inside the wider input-buffer envelope may be one stride ahead. Let
  // planning assume the athlete continues approaching it, but do not grant the
  // contact: stepStrikeContact still checks the real root-to-ball distance.
  if (setupDistance <= MAX_STRIKE_SETUP_REACH) {
    const dx = input.ball.position.x - input.actorPosition.x;
    const dz = input.ball.position.z - input.actorPosition.z;
    const horizontal = Math.hypot(dx, dz);
    if (horizontal > 1e-6) {
      return {
        x: dx / horizontal * APPROACH_SETUP_SPEED,
        y: 0,
        z: dz / horizontal * APPROACH_SETUP_SPEED,
      };
    }
  }
  return { x: 0, y: 0, z: 0 };
}

function chooseContactCandidate(input: Readonly<StrikeContactRequest>, strideTicks: number): ContactCandidate | null {
  const phase = ((input.gaitPhase % 1) + 1) % 1;
  const actorVelocity = inferredActorVelocity(input);
  let best: ContactCandidate | null = null;

  const minimumDelay = input.contactDelayTicks ?? MIN_CONTACT_DELAY_TICKS;
  const maximumDelay = input.contactDelayTicks ?? MAX_CONTACT_DELAY_TICKS;
  for (const foot of [input.preferredFoot, oppositeFoot(input.preferredFoot)] as const) {
    const footOffset = foot === 'left' ? 0.5 : 0;
    for (let delayTicks = minimumDelay; delayTicks <= maximumDelay; delayTicks += 1) {
      const seconds = delayTicks / TICK_HZ;
      const expectedActorPoint = predictPoint(input.actorPosition, actorVelocity, seconds);
      const expectedBallPoint = predictPoint(input.ball.position, input.ball.velocity, seconds);
      expectedBallPoint.y = Math.max(input.ball.radius, expectedBallPoint.y);
      const reach = distance(expectedActorPoint, expectedBallPoint);
      if (reach > (input.maximumContactReach ?? MAX_STRIKE_REACH)) continue;

      const contactPhase = (phase + delayTicks / strideTicks + footOffset) % 1;
      const swingPhaseError = wrappedPhaseDistance(contactPhase, 0.72);
      // Prefer the declared strong foot when both are feasible, but allow the
      // alternate foot immediately when it is the only physically reachable
      // one. This retains skill identity without reintroducing input latency.
      const nonPreferredPenalty = foot === input.preferredFoot ? 0 : PREFERRED_FOOT_BIAS;
      const score = swingPhaseError * 0.65 + delayTicks * 0.018 + nonPreferredPenalty + reach * 0.035;
      if (!best || score < best.score) {
        best = { foot, delayTicks, expectedBallPoint, score };
      }
    }
  }

  return best;
}

/**
 * Plans an interruptible strike beat from gait timing and the live moving
 * player/ball intercept. The ball remains completely free; planning only picks
 * the next physically reachable foot beat.
 */
export function createStrikeContactPlan(
  input: Readonly<StrikeContactRequest>,
): FootballContactPlan | null {
  if (!Number.isSafeInteger(input.tick) || input.tick < 0) throw new RangeError('tick must be a non-negative integer');
  if (!Number.isFinite(input.gaitPhase) || !Number.isFinite(input.strideSeconds) || input.strideSeconds <= 0) {
    throw new TypeError('gait phase and stride duration must be finite');
  }
  if (input.contactDelayTicks !== undefined
    && (!Number.isSafeInteger(input.contactDelayTicks) || input.contactDelayTicks < MIN_CONTACT_DELAY_TICKS || input.contactDelayTicks > 60)) {
    throw new RangeError('contactDelayTicks must be an integer from 2 to 60');
  }
  if (input.actorVelocity && ![input.actorVelocity.x, input.actorVelocity.y, input.actorVelocity.z].every(Number.isFinite)) {
    throw new TypeError('actor velocity must be finite');
  }

  if (distance(input.actorPosition, input.ball.position) > MAX_STRIKE_SETUP_REACH) return null;

  const strideTicks = Math.max(12, Math.round(input.strideSeconds * TICK_HZ));
  const candidate = chooseContactCandidate(input, strideTicks);
  if (!candidate) return null;

  const contactTick = input.tick + candidate.delayTicks;
  const prepareTick = input.tick;
  const expectedBallPoint = candidate.expectedBallPoint;
  const expectedFootPoint = {
    ...expectedBallPoint,
    y: Math.max(0.06, expectedBallPoint.y - input.ball.radius * 0.22),
  };

  const balance = finiteUnit(input.balance);
  return createFootballContactPlan({
    sourceId: input.sourceId,
    kind: input.kind,
    foot: candidate.foot,
    surface: input.kind === 'shot' ? 'instep' : 'inside',
    prepareTick,
    contactTick,
    recoveryEndTick: contactTick + Math.max(4, Math.round(strideTicks * 0.18)),
    expectedBallPoint,
    expectedFootPoint,
    targetBallVelocity: { ...input.targetBallVelocity },
    maxLinearImpulse: input.kind === 'shot' ? 15.5 : 12.5,
    maxAngularImpulse: input.kind === 'shot' ? 64 : 22,
    timingWindowTicks: input.timingWindowTicks ?? 1,
    ...(input.maximumContactReach === undefined ? {} : { maximumContactReach: input.maximumContactReach }),
    geometryTolerance: 0.24,
    quality: 0.55 + balance * 0.45,
    reason: balance < 0.45 ? 'rushed-off-balance-strike' : 'running-intercept-strike',
  });
}

/**
 * Revalidates the actual free ball against the actual actor on the contact
 * beat. Prediction error never invalidates an otherwise legal foot-ball
 * geometry; the planner is guidance, not a second ball authority.
 */
export function stepStrikeContact(
  plan: Readonly<FootballContactPlan>,
  tick: number,
  actorPosition: Readonly<FootballVec3>,
  ball: Readonly<FootballBallSnapshot>,
): StrikeContactStep {
  if (tick < plan.contactTick - plan.timingWindowTicks) return { status: 'preparing', plan };
  if (tick > plan.contactTick + plan.timingWindowTicks) return { status: 'missed', plan, reason: 'expired' };
  if (distance(actorPosition, ball.position) > (plan.maximumContactReach ?? MAX_STRIKE_REACH)) {
    return { status: 'missed', plan, reason: 'geometry-miss' };
  }
  return { status: 'contact', plan };
}
