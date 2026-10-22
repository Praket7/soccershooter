import type { AthleticMotionState } from '../player/athleticMotion';
import { chooseControlAssist } from './controlAssist';
import { buildControlTouch } from './controlEnvelope';
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
  forwardFromYaw,
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
  contactTimingOffsetTicks?: number;
  receiveMode?: ReceiveMode | null;
  /**
   * A shot is being charged while the player is still carrying the ball.
   * This does not reserve or attach the ball. It converts the next ordinary
   * carry touch into a short legal setup touch so the runner can arrive at the
   * following strike beat without first kicking the ball out of foot reach.
   */
  strikePreparation?: boolean;
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
const FIRST_CONTACT_TICKS_SPRINT = 3;
const STRIKE_SETUP_CONTACT_TICKS = 5;
const COMMIT_BEFORE_CONTACT_TICKS = 4;
const MAX_PLAN_REACH = 1.48;
const MAX_CONTROL_HEIGHT = 0.72;

function oppositeFoot(foot: FootballFoot): FootballFoot {
  return foot === 'left' ? 'right' : 'left';
}

function isEffortTurn(input: Readonly<PlannedDribbleInput>): boolean {
  if (input.receiveMode) return false;
  const actorSpeed = horizontalMagnitude(input.actor.velocity);
  return input.motion.gait === 'plant'
    || input.motion.gait === 'recover'
    || input.motion.plantIntensity >= 0.24
    || (actorSpeed >= 2.5 && Math.abs(input.motion.turnDemand) >= 0.18);
}

function isStrikePreparation(input: Readonly<PlannedDribbleInput>): boolean {
  return input.strikePreparation ?? Boolean(input.motion.strikePreparation);
}

function cadenceTicks(input: Readonly<PlannedDribbleInput>): number {
  if (input.receiveMode === 'kill' || input.receiveMode === 'controlled-exit') return 3;
  if (isStrikePreparation(input)) return STRIKE_SETUP_CONTACT_TICKS;
  const strideTicks = Math.max(1, input.motion.strideSeconds * TICK_HZ);
  // Competent close control needs a physical touch often enough that the ball
  // remains available without feeling welded. Cadence is still gait-derived;
  // these are not per-frame corrections or hidden possession forces.
  const velocityDirection = normalizeHorizontal(input.actor.velocity, input.desiredDirection);
  const requestedDirection = normalizeHorizontal(input.desiredDirection);
  const directionChange = Math.acos(clampFootball(
    velocityDirection.x * requestedDirection.x + velocityDirection.z * requestedDirection.z,
    -1,
    1,
  ));
  const carrierSpeed = horizontalMagnitude(input.actor.velocity);
  // Sprint input can remain held through a sharp plant even after the athlete
  // has shed most of their speed. Keep the tight-turn touch beat active in that
  // window so the ball does not coast ahead while the carrier is braking.
  const turningSpeedThreshold = 1.0;
  const turningCarry = carrierSpeed >= turningSpeedThreshold && directionChange >= 0.12;
  if (isEffortTurn(input) || turningCarry) {
    // Tight running curves need a touch inside the normal stride beat. Waiting
    // 8-10 ticks lets the player round the turn while the ball continues along
    // its old tangent, which reads as the ball trailing around the circle.
    if (directionChange >= 0.20 || Math.abs(input.motion.turnDemand) >= 0.06) {
      return Math.round(input.sprint || input.precision
        ? clampFootball(strideTicks * 0.24, 4, 6)
        : clampFootball(strideTicks * 0.20, 4, 5));
    }
    return Math.round(input.sprint || input.precision
      ? clampFootball(strideTicks * 0.42, 8, 10)
      : clampFootball(strideTicks * 0.34, 7, 9));
  }
  if (input.precision) return Math.round(clampFootball(strideTicks * 0.36, 7, 9));
  if (input.sprint) return Math.round(clampFootball(strideTicks * 0.42, 8, 10));
  return Math.round(clampFootball(strideTicks * 0.42, 9, 11));
}

function nextContactTick(input: Readonly<PlannedDribbleInput>): number {
  if (isStrikePreparation(input)) return input.tick + STRIKE_SETUP_CONTACT_TICKS;
  if (input.state.lastContactTick < 0) {
    if (input.receiveMode) return input.tick + 2;
    if (input.sprint) return input.tick + FIRST_CONTACT_TICKS_SPRINT;
    return input.tick + (input.precision ? FIRST_CONTACT_TICKS_PRECISION : FIRST_CONTACT_TICKS_NORMAL);
  }
  return Math.max(input.tick + 2, input.state.lastContactTick + cadenceTicks(input));
}

function contactFoot(input: Readonly<PlannedDribbleInput>): FootballFoot {
  const alternating = input.state.lastContactFoot ? oppositeFoot(input.state.lastContactFoot) : input.motion.nextFoot;
  return chooseControlAssist({
    actorPosition: input.actor.position,
    ballPosition: input.ball.position,
    facingYaw: input.actor.facingYaw,
    nextFoot: alternating,
    preferredFoot: input.actor.preferredFoot,
    pressure: input.pressure,
    balance: input.actor.balance,
    precision: input.precision,
    turnDemand: input.motion.turnDemand,
    skill: 'beginner',
  }).foot;
}

function chooseSurface(input: Readonly<PlannedDribbleInput>, foot: FootballFoot): FootballContactSurface {
  if (input.receiveMode === 'kill') return 'sole';
  if (input.receiveMode === 'controlled-exit' || input.precision) return 'inside';
  if (isStrikePreparation(input)) return foot === input.actor.preferredFoot ? 'inside' : 'outside';
  // Effort-turn selection must happen before the generic normal-dribble assist.
  // Previously this branch was unreachable for ordinary dribbling because the
  // null receive mode returned through the generic assist first.
  if (isEffortTurn(input)) {
    const turningRight = input.motion.turnDemand > 0;
    const outsideFoot = turningRight ? 'right' : 'left';
    return foot === outsideFoot ? 'outside' : 'inside';
  }
  if (input.sprint || Math.abs(input.motion.turnDemand) < 0.18) return 'instep';
  return chooseControlAssist({
    actorPosition: input.actor.position,
    ballPosition: input.ball.position,
    facingYaw: input.actor.facingYaw,
    nextFoot: foot,
    preferredFoot: input.actor.preferredFoot,
    pressure: input.pressure,
    balance: input.actor.balance,
    precision: input.precision,
    turnDemand: input.motion.turnDemand,
    skill: 'beginner',
  }).surface;
}

function trajectoryOffsetAt(
  motion: Readonly<AthleticMotionState>,
  origin: Pick<FootballVec3, 'x' | 'z'>,
  seconds: number,
): { x: number; z: number } {
  if (motion.trajectory.length === 0 || seconds <= 0) return { x: 0, z: 0 };
  const samples = motion.trajectory;
  if (seconds <= samples[0]!.time) {
    const sample = samples[0]!;
    const scale = seconds / Math.max(1e-6, sample.time);
    return {
      x: (sample.position.x - origin.x) * scale,
      z: (sample.position.z - origin.z) * scale,
    };
  }
  for (let index = 1; index < samples.length; index += 1) {
    const left = samples[index - 1]!;
    const right = samples[index]!;
    if (seconds > right.time) continue;
    const t = (seconds - left.time) / Math.max(1e-6, right.time - left.time);
    const worldX = left.position.x + (right.position.x - left.position.x) * t;
    const worldZ = left.position.z + (right.position.z - left.position.z) * t;
    return { x: worldX - origin.x, z: worldZ - origin.z };
  }
  const last = samples[samples.length - 1]!;
  const extra = seconds - last.time;
  return {
    x: last.position.x - origin.x + last.velocity.x * extra,
    z: last.position.z - origin.z + last.velocity.z * extra,
  };
}

function predictedBallPoint(ball: Readonly<FootballBallSnapshot>, seconds: number): FootballVec3 {
  const horizontalDamping = Math.max(0.78, 1 - seconds * 0.22);
  return {
    x: ball.position.x + ball.velocity.x * seconds * horizontalDamping,
    y: Math.max(ball.radius, ball.position.y + ball.velocity.y * seconds),
    z: ball.position.z + ball.velocity.z * seconds * horizontalDamping,
  };
}

function plannedActorPoint(input: Readonly<PlannedDribbleInput>, seconds: number): FootballVec3 {
  const offset = trajectoryOffsetAt(input.motion, input.actor.position, seconds);
  return {
    x: input.actor.position.x + offset.x,
    y: input.actor.position.y,
    z: input.actor.position.z + offset.z,
  };
}

function predictedCarrierVelocity(input: Readonly<PlannedDribbleInput>, seconds: number): FootballHorizontalDirection {
  const samples = input.motion.trajectory;
  if (samples.length === 0 || seconds <= 0) return input.actor.velocity;
  if (seconds <= samples[0]!.time) {
    const sample = samples[0]!;
    const t = seconds / Math.max(1e-6, sample.time);
    return {
      x: input.actor.velocity.x + (sample.velocity.x - input.actor.velocity.x) * t,
      z: input.actor.velocity.z + (sample.velocity.z - input.actor.velocity.z) * t,
    };
  }
  for (let index = 1; index < samples.length; index += 1) {
    const left = samples[index - 1]!;
    const right = samples[index]!;
    if (seconds > right.time) continue;
    const t = (seconds - left.time) / Math.max(1e-6, right.time - left.time);
    return {
      x: left.velocity.x + (right.velocity.x - left.velocity.x) * t,
      z: left.velocity.z + (right.velocity.z - left.velocity.z) * t,
    };
  }
  return samples[samples.length - 1]!.velocity;
}

function targetSpeed(input: Readonly<PlannedDribbleInput>, carrierVelocity: FootballHorizontalDirection): number {
  const actorSpeed = horizontalMagnitude(input.actor.velocity);
  const contactSpeed = Math.hypot(carrierVelocity.x, carrierVelocity.z);
  const plannedSpeed = Math.hypot(input.motion.plannedVelocity.x, input.motion.plannedVelocity.z);
  if (input.receiveMode === 'kill') return Math.min(0.75, actorSpeed * 0.16);
  if (input.receiveMode === 'controlled-exit') return input.precision ? 2.0 : 2.8;
  // Shot preparation must preserve the runner's carry pace. Capping this setup
  // touch made a sprinting player outrun the free ball before the strike beat.
  if (isStrikePreparation(input)) return clampFootball(actorSpeed * 0.98 + 0.16, 1.4, 9.35);
  // Precision changes touch spacing and cadence more than locomotion speed. The
  // ball stays almost pace-matched so close control is responsive, not mud.
  if (input.precision) return clampFootball(actorSpeed * 0.98 + 0.16, 1.4, 5.15);
  if (isEffortTurn(input)) {
    const turnSpeedCeiling = input.sprint ? 9.35 : 5.30;
    return clampFootball(contactSpeed * 1.02 + 0.16, 1.8, turnSpeedCeiling);
  }
  if (input.sprint) {
    const requestedKnockOn = actorSpeed + 0.82 + Math.min(0.50, actorSpeed * 0.055);
    const alignment = normalizeHorizontal(carrierVelocity);
    const requested = normalizeHorizontal(input.desiredDirection);
    const directionalMatch = alignment.x * requested.x + alignment.z * requested.z;
    return clampFootball(
      Math.min(requestedKnockOn, contactSpeed + Math.max(0, directionalMatch) * 0.45),
      Math.max(0.9, contactSpeed * 0.82),
      9.35,
    );
  }

  const speedGap = Math.max(0, plannedSpeed - contactSpeed);
  const anticipatedSpeed = contactSpeed * 0.98 + 0.16 + Math.min(0.45, speedGap * 0.28);
  return clampFootball(anticipatedSpeed, 1.1, 5.45);
}

function targetVelocity(input: Readonly<PlannedDribbleInput>, seconds: number): FootballVec3 {
  if (input.receiveMode === 'kill') {
    return {
      x: input.actor.velocity.x * 0.16,
      y: input.ball.grounded ? 0 : input.ball.velocity.y * 0.12,
      z: input.actor.velocity.z * 0.16,
    };
  }

  const carrierVelocity = predictedCarrierVelocity(input, seconds);
  const carrierDirection = normalizeHorizontal(carrierVelocity, input.desiredDirection);
  // Respect the requested lane while accounting for the athlete's braking arc.
  // A fully trajectory-locked touch keeps the ball attached to old momentum
  // during reversals; a modest blend lets the touch lead the cut without
  // pretending the carrier can instantly change velocity.
  const requestedDirection = normalizeHorizontal(input.desiredDirection);
  const carrierAlignment = clampFootball(
    carrierDirection.x * requestedDirection.x + carrierDirection.z * requestedDirection.z,
    -1,
    1,
  );
  // A jogging 90-degree lane change needs the touch to lead the new direction
  // instead of remaining tethered to lateral carrier momentum. Preserve the
  // existing braking arc for reversals and sprint cuts, where redirecting too
  // aggressively stretches the ball away from the player.
  const laneChangeLead = !input.precision && carrierAlignment >= -0.12
    ? clampFootball((0.55 - carrierAlignment) / 0.55, 0, 1)
    : 0;
  const baseRequestedWeight = isEffortTurn(input) ? 0.14 : 0.32;
  const laneChangeAuthority = input.sprint
    ? input.motion.plantIntensity >= 0.24 ? 0.38 : 0.72
    : 0.78;
  const requestedWeight = baseRequestedWeight + laneChangeLead * (1 - baseRequestedWeight) * laneChangeAuthority;
  const direction = normalizeHorizontal({
    x: carrierDirection.x * (1 - requestedWeight) + requestedDirection.x * requestedWeight,
    z: carrierDirection.z * (1 - requestedWeight) + requestedDirection.z * requestedWeight,
  }, carrierDirection);
  const speed = targetSpeed(input, carrierVelocity);
  const incomingDirection = normalizeHorizontal(
    { x: input.ball.velocity.x, z: input.ball.velocity.z },
    direction,
  );
  const incomingSpeed = Math.hypot(input.ball.velocity.x, input.ball.velocity.z);
  const effort = isEffortTurn(input);
  const turnRetention = incomingSpeed > 0.5
    ? clampFootball(
        Math.abs(input.motion.turnDemand) * (effort ? 0.08 : 0.12)
          + clampFootball(input.pressure, 0, 1) * 0.18
          + (1 - clampFootball(input.actor.balance, 0, 1)) * 0.18,
        0,
        input.precision ? 0.16 : effort ? 0.38 : input.sprint ? 0.34 : 0.26,
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
  if (input.precision || isStrikePreparation(input)) return 0.24;
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
  const velocity = targetVelocity(input, seconds);
  const tolerance = geometryTolerance(input);
  const pressure = clampFootball(input.pressure, 0, 1);
  const balance = clampFootball(input.actor.balance, 0, 1);
  const assist = chooseControlAssist({
    actorPosition: input.actor.position,
    ballPosition: input.ball.position,
    facingYaw: input.actor.facingYaw,
    nextFoot: foot,
    preferredFoot: input.actor.preferredFoot,
    pressure,
    balance,
    precision: input.precision,
    turnDemand: input.motion.turnDemand,
    skill: 'beginner',
  });
  const effort = isEffortTurn(input);
  const quality = clampFootball(
    1
      - pressure * 0.35
      - (1 - balance) * 0.32
      - Math.abs(input.motion.turnDemand) * (input.precision ? 0.10 : effort ? 0.22 : 0.14)
      - (input.sprint ? input.motion.plantIntensity * 0.10 : 0),
    0.35,
    1,
  );
  const prepareTick = Math.max(input.tick, contactTick - COMMIT_BEFORE_CONTACT_TICKS);
  const surface = chooseSurface(input, foot);
  const mode = isStrikePreparation(input)
    ? 'strike-setup'
    : effort ? 'effort' : input.precision ? 'precision' : input.sprint ? 'sprint' : 'normal';

  return createFootballContactPlan({
    sourceId: 'stage05r-owner-dribble',
    kind,
    foot,
    surface,
    prepareTick,
    contactTick,
    recoveryEndTick: contactTick + 5,
    expectedBallPoint,
    expectedFootPoint: { ...expectedBallPoint, y: Math.max(0.06, expectedBallPoint.y - input.ball.radius * 0.22) },
    targetBallVelocity: velocity,
    maxLinearImpulse: kind === 'trap' ? 4.6 : isStrikePreparation(input) ? 3.6 : input.precision ? 2.8 : effort ? 4.5 : input.sprint ? 4.8 : 3.8,
    maxAngularImpulse: kind === 'trap' ? 85 : 120,
    timingWindowTicks: input.receiveMode ? 1 : clampFootball(assist.timingWindowTicks + (input.contactTimingOffsetTicks ?? 0), 1, 3),
    geometryTolerance: tolerance,
    quality,
    reason: kind === 'trap'
      ? `receive-kill-${foot}`
      : `${mode}-${foot}-${surface}`,
  });
}

function commandForPlan(
  plan: Readonly<FootballContactPlan>,
  ball: Readonly<FootballBallSnapshot>,
  input: Readonly<PlannedDribbleInput>,
): BallContactCommand {
  const incomingSpeed = Math.hypot(input.ball.velocity.x, input.ball.velocity.z);
  const incomingDirection = normalizeHorizontal(
    { x: input.ball.velocity.x, z: input.ball.velocity.z },
    input.desiredDirection,
  );
  const requestedDirection = normalizeHorizontal(input.desiredDirection);
  const incomingIntentDot = incomingDirection.x * requestedDirection.x
    + incomingDirection.z * requestedDirection.z;
  const reversal = incomingIntentDot < -0.82;
  // Keep planned braking arcs on routine cuts. On a full reversal, use the new
  // input lane immediately so the bounded touch carries the ball around with
  // the planted turn instead of continuing down the old trajectory.
  const controlDirection = input.receiveMode === 'controlled-exit'
    ? requestedDirection
    : reversal
      ? forwardFromYaw(input.motion.bodyYaw)
      : normalizeHorizontal(plan.targetBallVelocity, requestedDirection);
  const controlTouch = !isStrikePreparation(input)
    ? buildControlTouch({
        actor: input.actor,
        ball,
        desiredDirection: controlDirection,
        precision: input.precision,
        sprint: input.sprint,
        pressure: input.pressure,
        moveIntentMagnitude: input.moveIntentMagnitude,
        ...(input.receiveMode !== undefined ? { receiveMode: input.receiveMode } : {}),
      }).command
    : undefined;
  if (controlTouch) return controlTouch;
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

  const settledBall = Math.hypot(input.ball.velocity.x, input.ball.velocity.y, input.ball.velocity.z) < 0.22;
  const deliberateReceive = input.receiveMode === 'kill' || input.receiveMode === 'controlled-exit';
  const requestedDirection = normalizeHorizontal(input.desiredDirection);
  if (state.looseBall && !deliberateReceive) {
    const recoveryDistance = horizontalDistance(input.actor.position, input.ball.position);
    const recoveryLane = (input.ball.position.x - input.actor.position.x) * requestedDirection.x
      + (input.ball.position.z - input.actor.position.z) * requestedDirection.z;
    if (recoveryDistance > 0.85 || recoveryLane < 0.10) {
      state.activePlan = null;
      return { state, ball: unchangedBall, contactApplied: false, reason: 'loose-ball-chase' };
    }
    state.looseBall = false;
  }
  if (input.moveIntentMagnitude < 0.08 && settledBall && !deliberateReceive) {
    state.activePlan = null;
    state.looseBall = false;
    return { state, ball: unchangedBall, contactApplied: false, reason: 'idle-no-touch' };
  }

  let plan = state.activePlan;
  // Shot charge is an explicit request to shorten the next stride into a setup
  // touch. Only a still-uncommitted carry plan may be pulled earlier; a foot
  // already inside its final plant window is allowed to finish normally.
  if (plan
    && isStrikePreparation(input)
    && plan.kind === 'dribble'
    && input.tick < plan.prepareTick
    && plan.contactTick - input.tick > STRIKE_SETUP_CONTACT_TICKS) {
    plan = planContact(input, input.tick + STRIKE_SETUP_CONTACT_TICKS, plan.foot);
    state.activePlan = plan;
  }

  const plannedDirection = plan ? normalizeHorizontal(plan.targetBallVelocity) : null;
  const laneAlignment = plannedDirection
    ? requestedDirection.x * plannedDirection.x + requestedDirection.z * plannedDirection.z
    : 1;
  const ballAheadOfRequestedLane = (input.ball.position.x - input.actor.position.x) * requestedDirection.x
    + (input.ball.position.z - input.actor.position.z) * requestedDirection.z;
  // Keep sprint touches committed against abrupt reversals, but let a normal
  // arc update through the final plant beat once the ball starts falling out
  // of the new carry lane. If it cannot be reached at contact, the existing
  // geometry/window checks still produce a genuine loose ball.
  const lateLaneCorrection = !input.precision && plannedDirection !== null
    && laneAlignment < -0.5 && ballAheadOfRequestedLane < 0.55;
  const committedSprintLaneCanFollow = input.sprint && plannedDirection !== null
    && laneAlignment < 0.995
    && ballAheadOfRequestedLane < 0.55;
  const lateJogBranchDoesNotRequireFullReversal = !input.sprint && !input.precision && plannedDirection !== null
    && laneAlignment >= -0.5;
  if (plan && input.tick < plan.contactTick && (
    input.tick < plan.prepareTick
    || lateJogBranchDoesNotRequireFullReversal
    || lateLaneCorrection
    || committedSprintLaneCanFollow
  )) {
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
        command: commandForPlan(plan, input.ball, input),
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

/**
 * Runs the normal gait-timed carry planner during a specialist move's windup.
 * The move owns only its final contact beat(s); before that, ball control must
 * continue to respond to the player's live movement and turns.
 */
export function stepTechniqueCarry(
  input: Readonly<PlannedDribbleInput> & {
    techniqueContactTick: number;
    reserveContactTicks: number;
  },
): PlannedDribbleStep | null {
  if (!Number.isSafeInteger(input.techniqueContactTick) || input.techniqueContactTick < 0) {
    throw new RangeError('techniqueContactTick must be a non-negative safe integer');
  }
  if (!Number.isSafeInteger(input.reserveContactTicks) || input.reserveContactTicks < 0) {
    throw new RangeError('reserveContactTicks must be a non-negative safe integer');
  }
  if (input.tick >= input.techniqueContactTick - input.reserveContactTicks) return null;
  return stepPlannedDribble(input);
}
