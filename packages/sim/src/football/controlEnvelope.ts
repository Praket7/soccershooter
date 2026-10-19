import {
  clampFootball,
  commandTowardVelocity,
  forwardFromYaw,
  horizontalDistance,
  horizontalDot,
  horizontalMagnitude,
  normalizeHorizontal,
  type BallContactCommand,
  type FootballActorSnapshot,
  type FootballBallSnapshot,
  type FootballHorizontalDirection,
  type FootballVec3,
} from './types';
import type { ReceiveMode } from './receive';

export type ControlTouchMode = 'precision' | 'normal' | 'sprint' | 'effort-turn' | 'trap' | 'receive-exit';

export interface ControlTouchInput {
  actor: Readonly<FootballActorSnapshot>;
  ball: Readonly<FootballBallSnapshot>;
  desiredDirection: FootballHorizontalDirection;
  precision: boolean;
  sprint: boolean;
  pressure: number;
  /** 0 means the user is deliberately not asking to move; 1 is full movement input. */
  moveIntentMagnitude?: number;
  /** Explicit F/receive intent. RMB precision alone never requests a trap. */
  receiveMode?: ReceiveMode | null;
}

export type ControlFailureReason =
  | 'ok'
  | 'out-of-reach'
  | 'behind-body'
  | 'ball-too-high'
  | 'ball-too-fast'
  | 'idle-no-touch';

export interface ControlTouchResult {
  eligible: boolean;
  reason: ControlFailureReason;
  quality: number;
  touchMode: ControlTouchMode;
  touchDistance: number;
  targetBallSpeed: number;
  targetPoint: FootballVec3;
  /** 0 is a routine carry; 1 is the hardest controllable contact state. */
  touchDifficulty: number;
  /** Magnitude, in m/s, of deterministic situational imperfection added to this contact. */
  touchErrorMagnitude: number;
  command?: BallContactCommand;
}

export interface ControlBreakInput {
  opponentImpulse: number;
  ballSpeed: number;
  controlQuality: number;
}

const MAX_CONTROL_HEIGHT = 0.72;
const HARD_INCOMING_SPEED = 26;
const MIN_FRONT_DOT = Math.cos(128 * Math.PI / 180);
const CLOSE_STRIDE_MIN_DOT = -0.92;
const CLOSE_STRIDE_START = 0.42;
const CLOSE_STRIDE_END = 1.02;
const IDLE_PLAYER_SPEED = 0.35;
const IDLE_BALL_SPEED = 0.8;
const EFFORT_TURN_ANGLE = 36 * Math.PI / 180;
// The rendered boot front is ~0.25 m ahead of the player root and a regulation
// ball radius is ~0.11 m. Keeping deliberate close-control targets at or beyond
// 0.36 m prevents the ball center from being commanded inside the visible boot.
// This changes only target geometry; contacts remain bounded impulses and never
// teleport the ball.
const CLOSE_CONTROL_CONTACT_DISTANCE = 0.36;

function actorSpeed(actor: Readonly<FootballActorSnapshot>): number {
  return horizontalMagnitude(actor.velocity);
}

function targetPoint(
  actor: Readonly<FootballActorSnapshot>,
  direction: FootballHorizontalDirection,
  distance: number,
  ballY: number,
): FootballVec3 {
  return {
    x: actor.position.x + direction.x * distance,
    y: ballY,
    z: actor.position.z + direction.z * distance,
  };
}

function controlReach(mode: ControlTouchMode): number {
  if (mode === 'sprint') return 1.62;
  if (mode === 'effort-turn') return 1.56;
  if (mode === 'trap' || mode === 'receive-exit') return 1.50;
  if (mode === 'precision') return 1.38;
  return 1.48;
}

interface CorridorTuning {
  horizon: number;
  gain: number;
  maxAdvance: number;
  maxRecovery: number;
  maxLateral: number;
}

function corridorTuning(mode: ControlTouchMode): CorridorTuning {
  if (mode === 'precision') {
    return { horizon: 0.14, gain: 0.86, maxAdvance: 0.42, maxRecovery: 4.0, maxLateral: 3.8 };
  }
  if (mode === 'sprint') {
    return { horizon: 0.20, gain: 0.82, maxAdvance: 0.45, maxRecovery: 4.8, maxLateral: 3.3 };
  }
  if (mode === 'effort-turn') {
    return { horizon: 0.11, gain: 0.92, maxAdvance: 2.4, maxRecovery: 5.2, maxLateral: 4.2 };
  }
  return { horizon: 0.16, gain: 0.84, maxAdvance: 0.52, maxRecovery: 4.3, maxLateral: 3.5 };
}

/**
 * Produces a bounded velocity correction toward a moving control corridor.
 * Forward and recovery corrections are intentionally asymmetric: a competent
 * dribbler may gently nudge a close ball onward, but an overhit ball is slowed
 * much more decisively so one slightly long touch does not cascade into an
 * automatic turnover. Lateral correction is independent so the ball can be
 * brought back onto the running line without teleporting its position.
 */
function corridorCorrection(
  actor: Readonly<FootballActorSnapshot>,
  ball: Readonly<FootballBallSnapshot>,
  direction: FootballHorizontalDirection,
  touchDistance: number,
  mode: ControlTouchMode,
): FootballHorizontalDirection {
  const tuning = corridorTuning(mode);
  const relativeX = ball.position.x - actor.position.x;
  const relativeZ = ball.position.z - actor.position.z;
  const lateral = { x: direction.z, z: -direction.x };
  const relativeForward = relativeX * direction.x + relativeZ * direction.z;
  const relativeLateral = relativeX * lateral.x + relativeZ * lateral.z;

  const forwardError = touchDistance - relativeForward;
  const lateralError = -relativeLateral;
  const rawForward = forwardError / tuning.horizon * tuning.gain;
  const rawLateral = lateralError / tuning.horizon * tuning.gain;
  const forwardCorrection = clampFootball(rawForward, -tuning.maxRecovery, tuning.maxAdvance);
  const lateralCorrection = clampFootball(rawLateral, -tuning.maxLateral, tuning.maxLateral);

  return {
    x: direction.x * forwardCorrection + lateral.x * lateralCorrection,
    z: direction.z * forwardCorrection + lateral.z * lateralCorrection,
  };
}

/**
 * Match the Stage 04 turf solver's rolling convention. groundContact.ts defines
 * horizontal slip as:
 *   slipX = v.x + omega.z * R
 *   slipZ = v.z - omega.x * R
 * so a no-slip rolling target is omega.x = v.z/R and omega.z = -v.x/R.
 */
function rollingAngularVelocityDelta(
  ball: Readonly<FootballBallSnapshot>,
  desiredVelocity: Readonly<FootballVec3>,
): FootballVec3 {
  const radius = Math.max(0.001, ball.radius);
  const targetOmegaX = desiredVelocity.z / radius;
  const targetOmegaZ = -desiredVelocity.x / radius;
  return {
    x: targetOmegaX - ball.angularVelocity.x,
    y: -ball.angularVelocity.y * 0.2,
    z: targetOmegaZ - ball.angularVelocity.z,
  };
}

function rotateDirectionToward(
  current: FootballHorizontalDirection,
  target: FootballHorizontalDirection,
  maxRadians: number,
): FootballHorizontalDirection {
  const currentYaw = Math.atan2(current.x, current.z);
  const targetYaw = Math.atan2(target.x, target.z);
  let delta = targetYaw - currentYaw;
  while (delta > Math.PI) delta -= Math.PI * 2;
  while (delta < -Math.PI) delta += Math.PI * 2;
  const applied = clampFootball(delta, -maxRadians, maxRadians);
  const yaw = currentYaw + applied;
  return { x: Math.sin(yaw), z: Math.cos(yaw) };
}

/**
 * A ball almost under the player's stride can still be touched when it has just
 * crossed the root during a cut. As distance grows, the normal front-of-body
 * rule returns smoothly. This is a reach/geometry allowance, not possession:
 * position never snaps and the eventual correction is still impulse bounded.
 */
function minimumFrontDotForReach(reach: number): number {
  const t = clampFootball(
    (reach - CLOSE_STRIDE_START) / (CLOSE_STRIDE_END - CLOSE_STRIDE_START),
    0,
    1,
  );
  return CLOSE_STRIDE_MIN_DOT + (MIN_FRONT_DOT - CLOSE_STRIDE_MIN_DOT) * t;
}

function straightTouchDistance(
  precision: boolean,
  sprint: boolean,
  playerSpeed: number,
): number {
  if (precision) return CLOSE_CONTROL_CONTACT_DISTANCE;
  if (sprint) return 0.78 + clampFootball(playerSpeed - 6, 0, 3) * 0.015;
  return 0.52;
}

function straightTargetSpeed(
  precision: boolean,
  sprint: boolean,
  playerSpeed: number,
): number {
  if (precision) return clampFootball(playerSpeed + 0.05, 1.8, 5.15);
  if (sprint) return clampFootball(playerSpeed + 0.08, 4.0, 8.95);
  return clampFootball(playerSpeed + 0.15, 3.0, 5.45);
}

interface TouchImperfection {
  difficulty: number;
  momentumRetention: number;
  magnitude: number;
}

/**
 * Beginner-friendly, learnable error model with a mastery ceiling.
 *
 * A clean carry has no invented sideways noise. Difficult choices instead make
 * the old ball momentum harder to erase: pressure, poor balance, stretch, speed,
 * and a severe requested turn create deterministic understeer/heavy-touch error.
 * The mistake therefore has a football-shaped cause that the player can read and
 * improve, while RMB precision reduces it by sacrificing speed.
 */
function buildTouchImperfection(
  input: Readonly<ControlTouchInput>,
  mode: ControlTouchMode,
  playerSpeed: number,
  ballDirectionDot: number,
  reach: number,
  touchDistance: number,
  pressure: number,
  balance: number,
): TouchImperfection {
  if (mode === 'trap') return { difficulty: 0, momentumRetention: 0, magnitude: 0 };

  const turnDifficulty = clampFootball((1 - ballDirectionDot) / 2, 0, 1);
  const stretchStart = touchDistance * 1.15;
  const stretchSpan = Math.max(0.18, controlReach(mode) - stretchStart);
  const stretchDifficulty = clampFootball((reach - stretchStart) / stretchSpan, 0, 1);
  const speedDifficulty = input.sprint
    ? clampFootball((playerSpeed - 5.3) / 3.2, 0, 1)
    : clampFootball((playerSpeed - 5.8) / 3.0, 0, 1) * 0.35;
  const imbalance = 1 - balance;

  let difficulty = clampFootball(
    turnDifficulty * 0.42
      + pressure * 0.34
      + imbalance * 0.28
      + stretchDifficulty * 0.18
      + speedDifficulty * 0.08
      + (input.sprint ? 0.03 : 0),
    0,
    1,
  );

  if (mode === 'receive-exit') difficulty *= 0.72;
  if (input.precision) difficulty *= 0.52;
  difficulty = clampFootball(difficulty, 0, 1);

  let magnitude = 0.68 * difficulty * difficulty;
  if (mode === 'receive-exit') magnitude *= 0.72;
  if (input.precision) magnitude *= 0.62;
  magnitude = Math.min(0.78, magnitude);

  return {
    difficulty,
    momentumRetention: magnitude,
    magnitude,
  };
}

/**
 * Generates one physically bounded touch. The target point is a planning aid;
 * only velocity and spin impulses are returned. The football is never snapped
 * to the target point.
 *
 * Routine carry is deliberately competent: normal touches stay compact, sprint
 * touches are longer but recoverable, and modest control errors receive a legal
 * corrective contact before possession is declared lost. Genuine large errors,
 * pressure, bad body orientation, excessive ball height/speed, and opponent
 * contact still break control.
 */
export function buildControlTouch(input: Readonly<ControlTouchInput>): ControlTouchResult {
  const direction = normalizeHorizontal(input.desiredDirection, forwardFromYaw(input.actor.facingYaw));
  const facing = forwardFromYaw(input.actor.facingYaw);
  const toBall = normalizeHorizontal({
    x: input.ball.position.x - input.actor.position.x,
    z: input.ball.position.z - input.actor.position.z,
  }, facing);
  const reach = horizontalDistance(input.actor.position, input.ball.position);
  const incomingSpeed = Math.hypot(input.ball.velocity.x, input.ball.velocity.y, input.ball.velocity.z);
  const horizontalBallSpeed = Math.hypot(input.ball.velocity.x, input.ball.velocity.z);
  const playerSpeed = actorSpeed(input.actor);
  const ballFacingDot = horizontalDot(facing, toBall);
  const desiredFacingDot = horizontalDot(facing, direction);
  const desiredBallDot = horizontalDot(direction, toBall);
  const moveIntentMagnitude = clampFootball(input.moveIntentMagnitude ?? 1, 0, 1);
  const pressure = clampFootball(input.pressure, 0, 1);
  const balance = clampFootball(input.actor.balance, 0, 1);

  const movingBallDirection = normalizeHorizontal(
    { x: input.ball.velocity.x, z: input.ball.velocity.z },
    direction,
  );
  const ballDirectionDot = horizontalBallSpeed > 0.8
    ? horizontalDot(movingBallDirection, direction)
    : 1;
  const turnAngle = horizontalBallSpeed > 0.8
    ? Math.acos(clampFootball(ballDirectionDot, -1, 1))
    : 0;
  const trapRequested = input.receiveMode === 'kill';
  const receiveExitRequested = input.receiveMode === 'controlled-exit';
  const effortTurn = !trapRequested
    && !receiveExitRequested
    && moveIntentMagnitude >= 0.12
    && horizontalBallSpeed > 1.15
    && turnAngle > EFFORT_TURN_ANGLE;
  const turnSeverity = effortTurn
    ? clampFootball((turnAngle - EFFORT_TURN_ANGLE) / (Math.PI - EFFORT_TURN_ANGLE), 0, 1)
    : 0;

  const minimumFrontDot = minimumFrontDotForReach(reach);
  const activeRecoveryReach = input.precision ? 0.82 : 0.70;
  const activeTurnBackRecovery = !trapRequested
    && moveIntentMagnitude >= 0.5
    && reach <= activeRecoveryReach
    && desiredBallDot >= 0.82;
  const frontDotForQuality = activeTurnBackRecovery
    ? Math.max(ballFacingDot, minimumFrontDot + (1 - minimumFrontDot) * 0.22)
    : ballFacingDot;
  const frontFactor = clampFootball((frontDotForQuality - minimumFrontDot) / (1 - minimumFrontDot), 0, 1);
  const rawDirectionFactor = clampFootball((desiredFacingDot + 0.35) / 1.35, 0, 1);
  const directionFactor = effortTurn || receiveExitRequested ? Math.max(0.34, rawDirectionFactor) : rawDirectionFactor;
  const pressureFactor = 1 - 0.58 * pressure;
  const speedFactor = clampFootball(1 - Math.max(0, incomingSpeed - 12) / 22, 0.18, 1);
  const quality = clampFootball(frontFactor * directionFactor * pressureFactor * speedFactor * (0.55 + 0.45 * balance), 0, 1);

  const closeRecovery = clampFootball((0.72 - reach) / 0.52, 0, 1);
  const trailingRecovery = clampFootball((0.35 - ballFacingDot) / 1.15, 0, 1);
  const recoverySteer = Math.max(closeRecovery, trailingRecovery, activeTurnBackRecovery ? 1 : 0);
  const turnAllowanceDegrees = input.precision
    ? 50 + 20 * recoverySteer
    : input.sprint
      ? 26 + 40 * recoverySteer
      : 42 + 18 * recoverySteer;
  const controlDirection = effortTurn
    ? rotateDirectionToward(movingBallDirection, direction, turnAllowanceDegrees * Math.PI / 180)
    : direction;

  let touchMode: ControlTouchMode;
  let touchDistance: number;
  let targetBallSpeed: number;
  if (trapRequested) {
    touchMode = 'trap';
    touchDistance = CLOSE_CONTROL_CONTACT_DISTANCE;
    targetBallSpeed = Math.min(1.1, playerSpeed * 0.22);
  } else if (receiveExitRequested) {
    touchMode = 'receive-exit';
    touchDistance = input.precision ? CLOSE_CONTROL_CONTACT_DISTANCE : 0.4;
    targetBallSpeed = input.precision ? 1.8 : 2.6;
  } else if (effortTurn) {
    touchMode = 'effort-turn';
    const baseDistance = straightTouchDistance(input.precision, input.sprint, playerSpeed);
    const minimumDistance = input.precision ? CLOSE_CONTROL_CONTACT_DISTANCE : input.sprint ? 0.42 : 0.36;
    touchDistance = baseDistance
      + (minimumDistance - baseDistance) * Math.pow(turnSeverity, 0.65);

    const baseSpeed = straightTargetSpeed(input.precision, input.sprint, playerSpeed);
    const minimumSpeed = input.precision
      ? Math.max(1.6, playerSpeed * 0.40)
      : input.sprint
        ? Math.max(2.2, playerSpeed * 0.44)
        : Math.max(2.2, playerSpeed * 0.48);
    targetBallSpeed = baseSpeed
      + (minimumSpeed - baseSpeed) * Math.pow(turnSeverity, 0.85);
  } else if (input.sprint) {
    touchMode = 'sprint';
    touchDistance = straightTouchDistance(false, true, playerSpeed);
    targetBallSpeed = straightTargetSpeed(false, true, playerSpeed);
  } else if (input.precision) {
    touchMode = 'precision';
    touchDistance = straightTouchDistance(true, false, playerSpeed);
    targetBallSpeed = straightTargetSpeed(true, false, playerSpeed);
  } else {
    touchMode = 'normal';
    touchDistance = straightTouchDistance(false, false, playerSpeed);
    targetBallSpeed = straightTargetSpeed(false, false, playerSpeed);
  }

  const imperfection = buildTouchImperfection(
    input,
    touchMode,
    playerSpeed,
    ballDirectionDot,
    reach,
    touchDistance,
    pressure,
    balance,
  );
  const plannedPoint = targetPoint(
    input.actor,
    controlDirection,
    touchDistance,
    Math.max(input.ball.radius, input.ball.position.y),
  );
  const baseResult = {
    quality,
    touchMode,
    touchDistance,
    targetBallSpeed,
    targetPoint: plannedPoint,
    touchDifficulty: imperfection.difficulty,
    touchErrorMagnitude: imperfection.magnitude,
  };

  if (reach > controlReach(touchMode)) return { eligible: false, reason: 'out-of-reach', ...baseResult };
  if (ballFacingDot < minimumFrontDot && !activeTurnBackRecovery) return { eligible: false, reason: 'behind-body', ...baseResult };
  if (input.ball.position.y - input.ball.radius > MAX_CONTROL_HEIGHT) return { eligible: false, reason: 'ball-too-high', ...baseResult };
  if (incomingSpeed > HARD_INCOMING_SPEED) return { eligible: false, reason: 'ball-too-fast', ...baseResult };
  if (!trapRequested && !receiveExitRequested && playerSpeed < IDLE_PLAYER_SPEED && incomingSpeed < IDLE_BALL_SPEED) {
    return { eligible: false, reason: 'idle-no-touch', ...baseResult };
  }

  const correction = trapRequested || receiveExitRequested
    ? { x: 0, z: 0 }
    : corridorCorrection(input.actor, input.ball, controlDirection, touchDistance, touchMode);
  const momentumError = {
    x: movingBallDirection.x * imperfection.momentumRetention,
    z: movingBallDirection.z * imperfection.momentumRetention,
  };
  const desiredVelocity: FootballVec3 = trapRequested
    ? {
        x: input.actor.velocity.x * 0.18,
        y: input.ball.grounded ? 0 : input.ball.velocity.y * 0.18,
        z: input.actor.velocity.z * 0.18,
      }
    : receiveExitRequested
      ? {
          x: direction.x * targetBallSpeed + momentumError.x,
          y: input.ball.grounded ? 0 : input.ball.velocity.y * 0.12,
          z: direction.z * targetBallSpeed + momentumError.z,
        }
      : {
          x: controlDirection.x * targetBallSpeed + correction.x + momentumError.x,
          y: input.ball.grounded ? 0 : input.ball.velocity.y * (effortTurn ? 0.18 : 0.32),
          z: controlDirection.z * targetBallSpeed + correction.z + momentumError.z,
        };

  const baseDeltaSpeed = trapRequested
    ? 9.5
    : receiveExitRequested
      ? 8.8
      : effortTurn
        ? input.sprint ? 9.4 : 8.7
        : input.sprint ? 7.1 : input.precision ? 5.8 : 6.8;
  const qualityFloor = trapRequested || receiveExitRequested || effortTurn ? 0.55 : 0.4;
  const maxDeltaSpeed = baseDeltaSpeed * (qualityFloor + (1 - qualityFloor) * quality);

  let angularVelocityDelta: FootballVec3;
  if (trapRequested) {
    angularVelocityDelta = {
      x: -input.ball.angularVelocity.x * 0.62,
      y: -input.ball.angularVelocity.y * 0.45,
      z: -input.ball.angularVelocity.z * 0.62,
    };
  } else if (input.ball.grounded) {
    angularVelocityDelta = rollingAngularVelocityDelta(input.ball, desiredVelocity);
  } else if (receiveExitRequested) {
    angularVelocityDelta = {
      x: direction.z * 1.8,
      y: -input.ball.angularVelocity.y * 0.2,
      z: direction.x * -1.8,
    };
  } else {
    const spinRate = effortTurn ? 3.1 : 2.2;
    angularVelocityDelta = {
      x: controlDirection.z * spinRate,
      y: 0,
      z: controlDirection.x * -spinRate,
    };
  }

  const command = commandTowardVelocity(
    'control-touch',
    input.ball,
    desiredVelocity,
    angularVelocityDelta,
    input.ball.mass * maxDeltaSpeed,
    `control mode=${touchMode} q=${quality.toFixed(3)} difficulty=${imperfection.difficulty.toFixed(3)} error=${imperfection.magnitude.toFixed(3)} turn=${(turnAngle * 180 / Math.PI).toFixed(1)} steer=${turnAllowanceDegrees.toFixed(1)} recovery=${activeTurnBackRecovery} corridor=(${correction.x.toFixed(2)},${correction.z.toFixed(2)}) reach=${reach.toFixed(2)}/${controlReach(touchMode).toFixed(2)} rolling=${input.ball.grounded} pressure=${pressure.toFixed(3)}`,
  );

  return {
    eligible: true,
    reason: 'ok',
    ...baseResult,
    command,
  };
}

export function shouldBreakControl(input: Readonly<ControlBreakInput>): boolean {
  const quality = clampFootball(input.controlQuality, 0, 1);
  const impulseThreshold = 6.5 + quality * 9.5;
  const speedThreshold = 18 + quality * 8;
  return input.opponentImpulse >= impulseThreshold || input.ballSpeed >= speedThreshold;
}
