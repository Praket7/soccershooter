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
const IDLE_PLAYER_SPEED = 0.35;
const IDLE_BALL_SPEED = 0.8;
const EFFORT_TURN_DOT = Math.cos(52 * Math.PI / 180);
const HARD_TURN_DOT = Math.cos(105 * Math.PI / 180);

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
    return { horizon: 0.12, gain: 0.96, maxAdvance: 1.1, maxRecovery: 5.2, maxLateral: 4.6 };
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

function mixHash(hash: number, value: number): number {
  let next = hash ^ (Math.round(value) | 0);
  next = Math.imul(next, 0x45d9f3b);
  next ^= next >>> 16;
  return next >>> 0;
}

/** Integer-only hash of visible simulation state. It makes touch imperfection
 * replayable and cross-run deterministic instead of depending on Math.random(). */
function touchStateHash(
  actor: Readonly<FootballActorSnapshot>,
  ball: Readonly<FootballBallSnapshot>,
  direction: FootballHorizontalDirection,
): number {
  let hash = 0x811c9dc5;
  for (const value of [
    actor.position.x * 1000,
    actor.position.z * 1000,
    actor.velocity.x * 1000,
    actor.velocity.z * 1000,
    actor.facingYaw * 10000,
    actor.balance * 10000,
    ball.position.x * 1000,
    ball.position.z * 1000,
    ball.velocity.x * 1000,
    ball.velocity.z * 1000,
    direction.x * 10000,
    direction.z * 10000,
  ]) hash = mixHash(hash, value);
  return hash >>> 0;
}

function signedHash(hash: number): number {
  let value = hash >>> 0;
  value ^= value >>> 16;
  value = Math.imul(value, 0x7feb352d);
  value ^= value >>> 15;
  value = Math.imul(value, 0x846ca68b);
  value ^= value >>> 16;
  return (value / 0xffffffff) * 2 - 1;
}

interface TouchImperfection {
  difficulty: number;
  lateral: number;
  longitudinal: number;
  magnitude: number;
}

/**
 * Beginner-friendly error model with a mastery ceiling.
 *
 * Routine straight carry deliberately lives near zero difficulty. Risk comes
 * from choices and football context: sprinting at top speed, changing the ball's
 * travel direction sharply, reaching for a stretched ball, pressure, and poor
 * balance. RMB precision lowers both difficulty and resulting error, rewarding
 * deliberate close control. The resulting variation is deterministic from
 * simulation state so identical replays remain identical.
 */
function buildTouchImperfection(
  input: Readonly<ControlTouchInput>,
  direction: FootballHorizontalDirection,
  mode: ControlTouchMode,
  playerSpeed: number,
  ballDirectionDot: number,
  reach: number,
  touchDistance: number,
  pressure: number,
  balance: number,
): TouchImperfection {
  if (mode === 'trap') return { difficulty: 0, lateral: 0, longitudinal: 0, magnitude: 0 };

  const turnDifficulty = clampFootball((0.98 - ballDirectionDot) / 1.18, 0, 1);
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
      + stretchDifficulty * 0.20
      + speedDifficulty * 0.10
      + (input.sprint ? 0.05 : 0),
    0,
    1,
  );

  if (mode === 'receive-exit') difficulty *= 0.72;
  if (input.precision) difficulty *= 0.55;
  difficulty = clampFootball(difficulty, 0, 1);

  // A clean carry has only millimetre-scale velocity variation. Error grows
  // quadratically, so beginners are protected while stacked difficult choices
  // become meaningfully imperfect. Precision gets a second reduction because
  // the player is explicitly sacrificing speed for control.
  let envelope = 0.006 + 0.70 * difficulty * difficulty;
  if (mode === 'receive-exit') envelope *= 0.72;
  if (input.precision) envelope *= 0.62;
  envelope = Math.min(0.78, envelope);

  const seed = touchStateHash(input.actor, input.ball, direction);
  const a = signedHash(seed ^ 0x9e3779b9);
  const b = signedHash(seed ^ 0x85ebca6b);
  const rawLateral = Math.abs(a) < 0.08 ? (a < 0 ? -0.08 : 0.08) : a;
  const rawLongitudinal = b * 0.42;
  const norm = Math.max(1e-6, Math.hypot(rawLateral, rawLongitudinal));
  const magnitude = envelope * (0.68 + Math.abs(b) * 0.32);

  return {
    difficulty,
    lateral: rawLateral / norm * magnitude,
    longitudinal: rawLongitudinal / norm * magnitude,
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
  const trapRequested = input.receiveMode === 'kill';
  const receiveExitRequested = input.receiveMode === 'controlled-exit';
  const effortTurn = !trapRequested
    && !receiveExitRequested
    && moveIntentMagnitude >= 0.12
    && horizontalBallSpeed > 1.15
    && ballDirectionDot < EFFORT_TURN_DOT;

  const frontFactor = clampFootball((ballFacingDot - MIN_FRONT_DOT) / (1 - MIN_FRONT_DOT), 0, 1);
  const rawDirectionFactor = clampFootball((desiredFacingDot + 0.35) / 1.35, 0, 1);
  const directionFactor = effortTurn || receiveExitRequested ? Math.max(0.34, rawDirectionFactor) : rawDirectionFactor;
  const pressureFactor = 1 - 0.58 * pressure;
  const speedFactor = clampFootball(1 - Math.max(0, incomingSpeed - 12) / 22, 0.18, 1);
  const quality = clampFootball(frontFactor * directionFactor * pressureFactor * speedFactor * (0.55 + 0.45 * balance), 0, 1);

  let touchMode: ControlTouchMode;
  let touchDistance: number;
  let targetBallSpeed: number;
  if (trapRequested) {
    touchMode = 'trap';
    touchDistance = 0.28;
    targetBallSpeed = Math.min(1.1, playerSpeed * 0.22);
  } else if (receiveExitRequested) {
    touchMode = 'receive-exit';
    touchDistance = input.precision ? 0.3 : 0.4;
    targetBallSpeed = input.precision ? 1.8 : 2.6;
  } else if (effortTurn) {
    touchMode = 'effort-turn';
    const hardTurn = ballDirectionDot < HARD_TURN_DOT;
    touchDistance = input.precision ? 0.30 : input.sprint ? 0.58 : 0.40;
    targetBallSpeed = hardTurn
      ? input.precision ? 1.2 : input.sprint ? 3.4 : 1.8
      : input.precision ? 1.9 : input.sprint ? 4.4 : 2.7;
  } else if (input.sprint) {
    touchMode = 'sprint';
    touchDistance = 0.78 + clampFootball(playerSpeed - 6, 0, 3) * 0.015;
    targetBallSpeed = clampFootball(playerSpeed + 0.08, 4.0, 8.95);
  } else if (input.precision) {
    touchMode = 'precision';
    touchDistance = 0.30;
    targetBallSpeed = clampFootball(playerSpeed + 0.05, 1.8, 5.15);
  } else {
    touchMode = 'normal';
    touchDistance = 0.52;
    targetBallSpeed = clampFootball(playerSpeed + 0.15, 3.0, 5.45);
  }

  const imperfection = buildTouchImperfection(
    input,
    direction,
    touchMode,
    playerSpeed,
    ballDirectionDot,
    reach,
    touchDistance,
    pressure,
    balance,
  );
  const plannedPoint = targetPoint(input.actor, direction, touchDistance, Math.max(input.ball.radius, input.ball.position.y));
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
  if (ballFacingDot < MIN_FRONT_DOT) return { eligible: false, reason: 'behind-body', ...baseResult };
  if (input.ball.position.y - input.ball.radius > MAX_CONTROL_HEIGHT) return { eligible: false, reason: 'ball-too-high', ...baseResult };
  if (incomingSpeed > HARD_INCOMING_SPEED) return { eligible: false, reason: 'ball-too-fast', ...baseResult };
  if (!trapRequested && !receiveExitRequested && playerSpeed < IDLE_PLAYER_SPEED && incomingSpeed < IDLE_BALL_SPEED) {
    return { eligible: false, reason: 'idle-no-touch', ...baseResult };
  }

  const correction = trapRequested || receiveExitRequested
    ? { x: 0, z: 0 }
    : corridorCorrection(input.actor, input.ball, direction, touchDistance, touchMode);
  const lateral = { x: direction.z, z: -direction.x };
  const imperfectVelocity = {
    x: direction.x * imperfection.longitudinal + lateral.x * imperfection.lateral,
    z: direction.z * imperfection.longitudinal + lateral.z * imperfection.lateral,
  };
  const desiredVelocity: FootballVec3 = trapRequested
    ? {
        x: input.actor.velocity.x * 0.18,
        y: input.ball.grounded ? 0 : input.ball.velocity.y * 0.18,
        z: input.actor.velocity.z * 0.18,
      }
    : receiveExitRequested
      ? {
          x: direction.x * targetBallSpeed + imperfectVelocity.x,
          y: input.ball.grounded ? 0 : input.ball.velocity.y * 0.12,
          z: direction.z * targetBallSpeed + imperfectVelocity.z,
        }
      : {
          x: direction.x * targetBallSpeed + correction.x + imperfectVelocity.x,
          y: input.ball.grounded ? 0 : input.ball.velocity.y * (effortTurn ? 0.18 : 0.32),
          z: direction.z * targetBallSpeed + correction.z + imperfectVelocity.z,
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
      x: direction.z * spinRate,
      y: 0,
      z: direction.x * -spinRate,
    };
  }

  const command = commandTowardVelocity(
    'control-touch',
    input.ball,
    desiredVelocity,
    angularVelocityDelta,
    input.ball.mass * maxDeltaSpeed,
    `control mode=${touchMode} q=${quality.toFixed(3)} difficulty=${imperfection.difficulty.toFixed(3)} error=${imperfection.magnitude.toFixed(3)} turnDot=${ballDirectionDot.toFixed(3)} corridor=(${correction.x.toFixed(2)},${correction.z.toFixed(2)}) reach=${reach.toFixed(2)}/${controlReach(touchMode).toFixed(2)} rolling=${input.ball.grounded} pressure=${pressure.toFixed(3)}`,
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
