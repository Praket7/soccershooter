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
 * Generates one physically bounded touch. The target point is a planning aid;
 * only a velocity impulse is returned. The football is never snapped to it.
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

  const plannedPoint = targetPoint(input.actor, direction, touchDistance, Math.max(input.ball.radius, input.ball.position.y));
  const baseResult = { quality, touchMode, touchDistance, targetBallSpeed, targetPoint: plannedPoint };

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
  const desiredVelocity: FootballVec3 = trapRequested
    ? {
        x: input.actor.velocity.x * 0.18,
        y: input.ball.grounded ? 0 : input.ball.velocity.y * 0.18,
        z: input.actor.velocity.z * 0.18,
      }
    : receiveExitRequested
      ? {
          x: direction.x * targetBallSpeed,
          y: input.ball.grounded ? 0 : input.ball.velocity.y * 0.12,
          z: direction.z * targetBallSpeed,
        }
      : {
          x: direction.x * targetBallSpeed + correction.x,
          y: input.ball.grounded ? 0 : input.ball.velocity.y * (effortTurn ? 0.18 : 0.32),
          z: direction.z * targetBallSpeed + correction.z,
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
  const angularVelocityDelta: FootballVec3 = trapRequested
    ? {
        x: -input.ball.angularVelocity.x * 0.62,
        y: -input.ball.angularVelocity.y * 0.45,
        z: -input.ball.angularVelocity.z * 0.62,
      }
    : receiveExitRequested
      ? {
          x: direction.z * -1.8,
          y: -input.ball.angularVelocity.y * 0.2,
          z: direction.x * 1.8,
        }
      : {
          x: direction.z * (effortTurn ? -3.1 : -2.2),
          y: 0,
          z: direction.x * (effortTurn ? 3.1 : 2.2),
        };
  const command = commandTowardVelocity(
    'control-touch',
    input.ball,
    desiredVelocity,
    angularVelocityDelta,
    input.ball.mass * maxDeltaSpeed,
    `control mode=${touchMode} q=${quality.toFixed(3)} turnDot=${ballDirectionDot.toFixed(3)} corridor=(${correction.x.toFixed(2)},${correction.z.toFixed(2)}) reach=${reach.toFixed(2)}/${controlReach(touchMode).toFixed(2)} pressure=${pressure.toFixed(3)}`,
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
