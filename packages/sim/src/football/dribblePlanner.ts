import type { AthleticMotionState } from '../player/athleticMotion';
import { chooseControlAssist } from './controlAssist';
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
  contactTimingOffsetTicks?: number;
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
const FIRST_CONTACT_TICKS_SPRINT = 3;
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

function cadenceTicks(input: Readonly<PlannedDribbleInput>): number {
  if (input.receiveMode === 'kill' || input.receiveMode === 'controlled-exit') return 3;
  const strideTicks = Math.max(1, input.motion.strideSeconds * TICK_HZ);
  // Competent close control needs a physical touch often enough that the ball
  // remains available without feeling welded. Cadence is still gait-derived;
  // these are not per-frame corrections or hidden possession forces.
  if (isEffortTurn(input)) return Math.round(clampFootball(strideTicks * 0.42, 8, 11));
  if (input.precision) return Math.round(clampFootball(strideTicks * 0.50, 9, 13));
  if (input.sprint) return Math.round(clampFootball(strideTicks * 1.08, 21, 27));
  return Math.round(clampFootball(strideTicks * 0.70, 14, 19));
}

function nextContactTick(input: Readonly<PlannedDribbleInput>): number {
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

function targetSpeed(input: Readonly<PlannedDribbleInput>): number {
  const actorSpeed = horizontalMagnitude(input.actor.velocity);
  const plannedSpeed = Math.hypot(input.motion.plannedVelocity.x, input.motion.plannedVelocity.z);
  if (input.receiveMode === 'kill') return Math.min(0.75, actorSpeed * 0.16);
  if (input.receiveMode === 'controlled-exit') return input.precision ? 2.0 : 2.8;
  // Precision changes touch spacing and cadence more than locomotion speed. The
  // ball stays almost pace-matched so close control is responsive, not mud.
  if (input.precision) return clampFootball(actorSpeed * 0.98 + 0.16, 1.4, 5.15);
  if (isEffortTurn(input)) {
    return clampFootball(actorSpeed * 0.78 + 0.35, 2.35, 5.30);
  }
  if (input.sprint) {
    return clampFootball(actorSpeed + 1.0 + Math.min(0.50, actorSpeed * 0.055), 3.45, 9.35);
  }

  const speedGap = Math.max(0, plannedSpeed - actorSpeed);
  const anticipatedSpeed = actorSpeed * 0.98 + 0.16 + Math.min(0.45, speedGap * 0.28);
  return clampFootball(anticipatedSpeed, 1.1, 5.45);
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
  const effort = isEffortTurn(input);
  const turnRetention = incomingSpeed > 0.5
    ? clampFootball(
        Math.abs(input.motion.turnDemand) * (effort ? 0.22 : 0.12)
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
  const mode = effort ? 'effort' : input.precision ? 'precision' : input.sprint ? 'sprint' : 'normal';

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
    maxLinearImpulse: kind === 'trap' ? 4.6 : input.precision ? 2.8 : effort ? 4.5 : input.sprint ? 4.8 : 3.8,
    maxAngularImpulse: kind === 'trap' ? 85 : 120,
    timingWindowTicks: input.receiveMode ? 1 : clampFootball(assist.timingWindowTicks + (input.contactTimingOffsetTicks ?? 0), 1, 3),
    geometryTolerance: tolerance,
    quality,
    reason: kind === 'trap'
      ? `receive-kill-${foot}`
      : `${mode}-${foot}-${surface}`,
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

  const settledBall = Math.hypot(input.ball.velocity.x, input.ball.velocity.y, input.ball.velocity.z) < 0.22;
  const deliberateReceive = input.receiveMode === 'kill' || input.receiveMode === 'controlled-exit';
  if (input.moveIntentMagnitude < 0.08 && settledBall && !deliberateReceive) {
    state.activePlan = null;
    state.looseBall = false;
    return { state, ball: unchangedBall, contactApplied: false, reason: 'idle-no-touch' };
  }

  let plan = state.activePlan;
  const requestedDirection = normalizeHorizontal(input.desiredDirection);
  const plannedDirection = plan ? normalizeHorizontal(plan.targetBallVelocity) : null;
  const lateJogBranchDoesNotRequireFullReversal = !input.sprint && !input.precision && plannedDirection !== null
    && requestedDirection.x * plannedDirection.x + requestedDirection.z * plannedDirection.z >= -0.5;
  if (plan && input.tick < plan.contactTick && (input.tick < plan.prepareTick || lateJogBranchDoesNotRequireFullReversal)) {
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
