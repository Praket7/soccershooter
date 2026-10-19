import type { AthleticMotionState } from '../player/athleticMotion';
import {
  createFootballContactPlan,
  executePlannedFootballContact,
  type FootballContactPlan,
  type FootballContactSurface,
} from './contactPlan';
import type { ReceiveMode } from './receive';
import {
  clampFootball,
  cloneFootballBall,
  commandTowardVelocity,
  horizontalDistance,
  horizontalMagnitude,
  normalizeHorizontal,
  type BallContactCommand,
  type FootballActorSnapshot,
  type FootballBallSnapshot,
  type FootballFoot,
  type FootballHorizontalDirection,
  type FootballVec3,
} from './types';

export interface PlannedDribbleState {
  activePlan: FootballContactPlan | null;
  consumedEventIds: readonly string[];
  lastContactTick: number;
  lastContactFoot: FootballFoot | null;
  looseBall: boolean;
}

export interface PlannedDribbleInput {
  tick: number;
  state: Readonly<PlannedDribbleState>;
  actor: Readonly<FootballActorSnapshot>;
  motion: Readonly<AthleticMotionState>;
  ball: Readonly<FootballBallSnapshot>;
  desiredDirection: FootballHorizontalDirection;
  precision: boolean;
  sprint: boolean;
  pressure: number;
  moveIntentMagnitude: number;
  receiveMode?: ReceiveMode | null;
}

export interface PlannedDribbleStep {
  state: PlannedDribbleState;
  ball: FootballBallSnapshot;
  contactApplied: boolean;
  reason: string;
}

const TICK_HZ = 60;
const FIRST_CONTACT_TICKS_NORMAL = 3;
const FIRST_CONTACT_TICKS_PRECISION = 2;
const COMMIT_BEFORE_CONTACT_TICKS = 4;
const MAX_PLAN_REACH = 1.48;
const MAX_CONTROL_HEIGHT = 0.72;

function oppositeFoot(foot: FootballFoot): FootballFoot {
  return foot === 'left' ? 'right' : 'left';
}

function cadenceTicks(input: Readonly<PlannedDribbleInput>): number {
  if (input.receiveMode === 'kill' || input.receiveMode === 'controlled-exit') return 3;
  const strideTicks = Math.max(1, input.motion.strideSeconds * TICK_HZ);
  if (input.precision) return Math.round(clampFootball(strideTicks * 0.64, 12, 17));
  return Math.round(clampFootball(strideTicks * 0.86, 17, 24));
}

function nextContactTick(input: Readonly<PlannedDribbleInput>): number {
  if (input.state.lastContactTick < 0) {
    if (input.receiveMode) return input.tick + 2;
    return input.tick + (input.precision ? FIRST_CONTACT_TICKS_PRECISION : FIRST_CONTACT_TICKS_NORMAL);
  }
  return Math.max(input.tick + 2, input.state.lastContactTick + cadenceTicks(input));
}

function contactFoot(input: Readonly<PlannedDribbleInput>): FootballFoot {
  if (input.state.lastContactFoot) return oppositeFoot(input.state.lastContactFoot);
  return input.motion.nextFoot;
}

function chooseSurface(input: Readonly<PlannedDribbleInput>, foot: FootballFoot): FootballContactSurface {
  if (input.receiveMode === 'kill') return 'sole';
  if (input.receiveMode === 'controlled-exit' || input.precision) return 'inside';
  if (Math.abs(input.motion.turnDemand) < 0.18) return 'instep';
  const turningRight = input.motion.turnDemand > 0;
  const outsideFoot = turningRight ? 'right' : 'left';
  return foot === outsideFoot ? 'outside' : 'inside';
}

function trajectoryOffsetAt(motion: Readonly<AthleticMotionState>, seconds: number): { x: number; z: number } {
  if (motion.trajectory.length === 0 || seconds <= 0) return { x: 0, z: 0 };
  const samples = motion.trajectory;
  if (seconds <= samples[0]!.time) {
    const sample = samples[0]!;
    const scale = seconds / Math.max(1e-6, sample.time);
    return { x: sample.position.x * scale, z: sample.position.z * scale };
  }
  for (let index = 1; index < samples.length; index += 1) {
    const left = samples[index - 1]!;
    const right = samples[index]!;
    if (seconds > right.time) continue;
    const t = (seconds - left.time) / Math.max(1e-6, right.time - left.time);
    return {
      x: left.position.x + (right.position.x - left.position.x) * t,
      z: left.position.z + (right.position.z - left.position.z) * t,
    };
  }
  const last = samples[samples.length - 1]!;
  const extra = seconds - last.time;
  return {
    x: last.position.x + last.velocity.x * extra,
    z: last.position.z + last.velocity.z * extra,
  };
}

function predictedBallPoint(ball: Readonly<FootballBallSnapshot>, seconds: number): FootballVec3 {
  // This is an intercept estimate, not a second ball solver. It is refreshed
  // until the short preparation window closes, while the actual Stage 04 ball
  // remains authoritative and is revalidated at the contact tick.
  const horizontalDamping = Math.max(0.78, 1 - seconds * 0.22);
  return {
    x: ball.position.x + ball.velocity.x * seconds * horizontalDamping,
    y: Math.max(ball.radius, ball.position.y + ball.velocity.y * seconds),
    z: ball.position.z + ball.velocity.z * seconds * horizontalDamping,
  };
}

function plannedActorPoint(input: Readonly<PlannedDribbleInput>, seconds: number): FootballVec3 {
  const offset = trajectoryOffsetAt(input.motion, seconds);
  return {
    x: input.actor.position.x + offset.x,
    y: input.actor.position.y,
    z: input.actor.position.z + offset.z,
  };
}

function targetSpeed(input: Readonly<PlannedDribbleInput>): number {
  const actorSpeed = horizontalMagnitude(input.actor.velocity);
  const plannedSpeed = Math.hypot(input.motion.plannedVelocity.x, input.motion.plannedVelocity.z);
  const referenceSpeed = Math.max(actorSpeed, plannedSpeed);
  if (input.receiveMode === 'kill') return Math.min(0.75, actorSpeed * 0.16);
  if (input.receiveMode === 'controlled-exit') return input.precision ? 2.0 : 2.8;
  if (input.precision) return clampFootball(referenceSpeed * 0.68 + 0.18, 1.45, 3.75);
  return clampFootball(referenceSpeed * 0.94 + 0.24, 2.65, 5.5);
}

function targetVelocity(input: Readonly<PlannedDribbleInput>): FootballVec3 {
  if (input.receiveMode === 'kill') {
    return {
      x: input.actor.velocity.x * 0.16,
      y: input.ball.grounded ? 0 : input.ball.velocity.y * 0.12,
      z: input.actor.velocity.z * 0.16,
    };
  }

  const direction = normalizeHorizontal(input.desiredDirection);
  const speed = targetSpeed(input);
  const incomingDirection = normalizeHorizontal(
    { x: input.ball.velocity.x, z: input.ball.velocity.z },
    direction,
  );
  const incomingSpeed = Math.hypot(input.ball.velocity.x, input.ball.velocity.z);
  const turnRetention = incomingSpeed > 0.5
    ? clampFootball(
        Math.abs(input.motion.turnDemand) * 0.16
          + clampFootball(input.pressure, 0, 1) * 0.18
          + (1 - clampFootball(input.actor.balance, 0, 1)) * 0.18,
        0,
        input.precision ? 0.20 : 0.34,
      )
    : 0;
  return {
    x: direction.x * speed * (1 - turnRetention) + incomingDirection.x * speed * turnRetention,
    y: input.ball.grounded ? 0 : input.ball.velocity.y * 0.18,
    z: direction.z * speed * (1 - turnRetention) + incomingDirection.z * speed * turnRetention,
  };
}

function rollingAngularDelta(ball: Readonly<FootballBallSnapshot>, velocity: Readonly<FootballVec3>): FootballVec3 {
  const radius = Math.max(0.001, ball.radius);
  return {
    x: velocity.z / radius - ball.angularVelocity.x,
    y: -ball.angularVelocity.y * 0.25,
    z: -velocity.x / radius - ball.angularVelocity.z,
  };
}

function geometryTolerance(input: Readonly<PlannedDribbleInput>): number {
  if (input.receiveMode === 'kill') return 0.22;
  if (input.precision) return 0.24;
  return 0.29;
}

function planContact(
  input: Readonly<PlannedDribbleInput>,
  contactTick: number,
  foot: FootballFoot,
): FootballContactPlan | null {
  const seconds = Math.max(0, contactTick - input.tick) / TICK_HZ;
  const expectedBallPoint = predictedBallPoint(input.ball, seconds);
  const expectedActorPoint = plannedActorPoint(input, seconds);
  const predictedReach = horizontalDistance(expectedActorPoint, expectedBallPoint);
  const currentReach = horizontalDistance(input.actor.position, input.ball.position);
  if (Math.min(currentReach, predictedReach) > MAX_PLAN_REACH) return null;
  if (expectedBallPoint.y - input.ball.radius > MAX_CONTROL_HEIGHT) return null;

  const kind = input.receiveMode === 'kill' ? 'trap' : 'dribble';
  const velocity = targetVelocity(input);
  const tolerance = geometryTolerance(input);
  const pressure = clampFootball(input.pressure, 0, 1);
  const balance = clampFootball(input.actor.balance, 0, 1);
  const quality = clampFootball(
    1 - pressure * 0.35 - (1 - balance) * 0.32 - Math.abs(input.motion.turnDemand) * (input.precision ? 0.10 : 0.18),
    0.35,
    1,
  );
  const prepareTick = Math.max(input.tick, contactTick - COMMIT_BEFORE_CONTACT_TICKS);

  return createFootballContactPlan({
    sourceId: 'stage05r-owner-dribble',
    kind,
    foot,
    surface: chooseSurface(input, foot),
    prepareTick,
    contactTick,
    recoveryEndTick: contactTick + 5,
    expectedBallPoint,
    // The point is where the selected foot must arrive. It follows the moving
    // ball intercept, not an invisible desired possession pocket.
    expectedFootPoint: { ...expectedBallPoint, y: Math.max(0.06, expectedBallPoint.y - input.ball.radius * 0.22) },
    targetBallVelocity: velocity,
    maxLinearImpulse: kind === 'trap' ? 4.6 : input.precision ? 2.8 : 3.8,
    maxAngularImpulse: kind === 'trap' ? 85 : 120,
    timingWindowTicks: 1,
    geometryTolerance: tolerance,
    quality,
    reason: kind === 'trap'
      ? `receive-kill-${foot}`
      : `${input.precision ? 'precision' : 'normal'}-${foot}-${chooseSurface(input, foot)}`,
  });
}

function commandForPlan(plan: Readonly<FootballContactPlan>, ball: Readonly<FootballBallSnapshot>): BallContactCommand {
  const angularVelocityDelta = plan.kind === 'trap'
    ? {
        x: -ball.angularVelocity.x * 0.70,
        y: -ball.angularVelocity.y * 0.55,
        z: -ball.angularVelocity.z * 0.70,
      }
    : rollingAngularDelta(ball, plan.targetBallVelocity);
  return commandTowardVelocity(
    'control-touch',
    ball,
    plan.targetBallVelocity,
    angularVelocityDelta,
    plan.maxLinearImpulse,
    `planned-${plan.kind} foot=${plan.foot} surface=${plan.surface} quality=${plan.quality.toFixed(3)}`,
  );
}

function cloneState(state: Readonly<PlannedDribbleState>): PlannedDribbleState {
  return {
    activePlan: state.activePlan,
    consumedEventIds: [...state.consumedEventIds],
    lastContactTick: state.lastContactTick,
    lastContactFoot: state.lastContactFoot,
    looseBall: state.looseBall,
  };
}

export function createPlannedDribbleState(): PlannedDribbleState {
  return {
    activePlan: null,
    consumedEventIds: [],
    lastContactTick: -1,
    lastContactFoot: null,
    looseBall: false,
  };
}

export function stepPlannedDribble(input: Readonly<PlannedDribbleInput>): PlannedDribbleStep {
  if (!Number.isSafeInteger(input.tick) || input.tick < 0) throw new RangeError('tick must be a non-negative safe integer');
  const state = cloneState(input.state);
  const unchangedBall = cloneFootballBall(input.ball);

  // Sprint/effort-turn remains on the legacy path until Task 4. This prevents
  // this first owner slice from smuggling an unfinished sprint planner into the
  // micro-gate.
  if (input.sprint) {
    state.activePlan = null;
    return { state, ball: unchangedBall, contactApplied: false, reason: 'legacy-sprint' };
  }

  const settledBall = Math.hypot(input.ball.velocity.x, input.ball.velocity.y, input.ball.velocity.z) < 0.22;
  const deliberateReceive = input.receiveMode === 'kill' || input.receiveMode === 'controlled-exit';
  if (input.moveIntentMagnitude < 0.08 && settledBall && !deliberateReceive) {
    state.activePlan = null;
    state.looseBall = false;
    return { state, ball: unchangedBall, contactApplied: false, reason: 'idle-no-touch' };
  }

  let plan = state.activePlan;
  if (plan && input.tick < plan.prepareTick) {
    // Re-target the *foot intercept* while preparation is still open. The ball
    // itself receives no correction. Once prepareTick is reached the contact is
    // committed so late input cannot turn into a remote or magnetic touch.
    plan = planContact(input, plan.contactTick, plan.foot);
    state.activePlan = plan;
  }

  if (plan) {
    if (input.tick >= plan.contactTick) {
      const execution = executePlannedFootballContact({
        plan,
        tick: input.tick,
        actorPosition: input.actor.position,
        ball: input.ball,
        command: commandForPlan(plan, input.ball),
        consumedEventIds: state.consumedEventIds,
      });
      if (execution.applied) {
        state.activePlan = null;
        state.consumedEventIds = execution.consumedEventIds.slice(-64);
        state.lastContactTick = input.tick;
        state.lastContactFoot = plan.foot;
        state.looseBall = false;
        return { state, ball: execution.ball, contactApplied: true, reason: 'contact' };
      }
      if (execution.reason !== 'too-early') {
        state.activePlan = null;
        state.looseBall = true;
      }
      return { state, ball: execution.ball, contactApplied: false, reason: execution.reason };
    }
    return { state, ball: unchangedBall, contactApplied: false, reason: 'awaiting-contact' };
  }

  const currentReach = horizontalDistance(input.actor.position, input.ball.position);
  if (currentReach > MAX_PLAN_REACH) {
    state.looseBall = true;
    return { state, ball: unchangedBall, contactApplied: false, reason: 'loose-ball-chase' };
  }

  const foot = contactFoot(input);
  const scheduledTick = nextContactTick(input);
  const created = planContact(input, scheduledTick, foot);
  if (!created) {
    state.looseBall = true;
    return { state, ball: unchangedBall, contactApplied: false, reason: 'no-viable-intercept' };
  }

  state.activePlan = created;
  state.looseBall = false;
  return { state, ball: unchangedBall, contactApplied: false, reason: 'contact-planned' };
}
