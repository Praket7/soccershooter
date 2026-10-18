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

const CONTROL_REACH = 1.32;
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

function clampHorizontalCorrection(x: number, z: number, maximum: number): FootballHorizontalDirection {
  const magnitude = Math.hypot(x, z);
  if (magnitude <= maximum || magnitude <= 1e-9) return { x, z };
  const scale = maximum / magnitude;
  return { x: x * scale, z: z * scale };
}

/**
 * A dribble touch is a bounded velocity servo around a moving control corridor,
 * not a position lock. The ball remains physically independent: lateral or
 * longitudinal error changes the requested impulse, while reach, body angle,
 * quality and impulse caps still decide whether the player can recover it.
 */
function corridorCorrection(
  actor: Readonly<FootballActorSnapshot>,
  ball: Readonly<FootballBallSnapshot>,
  direction: FootballHorizontalDirection,
  touchDistance: number,
  mode: ControlTouchMode,
): FootballHorizontalDirection {
  const relativeX = ball.position.x - actor.position.x;
  const relativeZ = ball.position.z - actor.position.z;
  const desiredX = direction.x * touchDistance;
  const desiredZ = direction.z * touchDistance;
  const errorX = desiredX - relativeX;
  const errorZ = desiredZ - relativeZ;

  let horizon = 0.22;
  let gain = 0.9;
  let maximum = 3.1;
  if (mode === 'precision') {
    horizon = 0.18;
    gain = 0.96;
    maximum = 3.7;
  } else if (mode === 'sprint') {
    horizon = 0.32;
    gain = 0.68;
    maximum = 2.5;
  } else if (mode === 'effort-turn') {
    horizon = 0.16;
    gain = 0.95;
    maximum = 4.2;
  }

  return clampHorizontalCorrection(
    errorX / horizon * gain,
    errorZ / horizon * gain,
    maximum,
  );
}

/**
 * Generates one physically bounded touch. The target point is a planning aid;
 * only a velocity impulse is returned. The football is never snapped to it.
 *
 * Sharp direction changes become braking/redirecting effort touches. Receive
 * is explicit: F/no movement kills momentum; F+movement cushions into a short
 * controlled exit. Precision/RMB changes dribble touch size but never secretly
 * changes the action into a trap.
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
    touchDistance = input.precision ? 0.32 : input.sprint ? 0.66 : 0.43;
    targetBallSpeed = hardTurn
      ? input.precision ? 1.25 : input.sprint ? 3.7 : 1.9
      : input.precision ? 2.0 : input.sprint ? 4.8 : 2.9;
  } else if (input.sprint) {
    touchMode = 'sprint';
    touchDistance = 0.92 + clampFootball(playerSpeed - 6, 0, 3) * 0.025;
    const freshTargetSpeed = clampFootball(playerSpeed + 0.25, 4.2, 9.0);
    const separationError = Math.max(0, reach - touchDistance);
    targetBallSpeed = clampFootball(
      freshTargetSpeed - separationError * 1.9,
      Math.max(3.6, playerSpeed - 1.2),
      9.0,
    );
  } else if (input.precision) {
    touchMode = 'precision';
    touchDistance = 0.34;
    targetBallSpeed = clampFootball(playerSpeed + 0.18, 2.0, 5.25);
  } else {
    touchMode = 'normal';
    touchDistance = 0.56;
    targetBallSpeed = clampFootball(playerSpeed + 0.35, 3.2, 6.45);
  }

  const plannedPoint = targetPoint(input.actor, direction, touchDistance, Math.max(input.ball.radius, input.ball.position.y));
  const baseResult = { quality, touchMode, touchDistance, targetBallSpeed, targetPoint: plannedPoint };

  if (reach > CONTROL_REACH) return { eligible: false, reason: 'out-of-reach', ...baseResult };
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
        ? input.sprint ? 9.2 : 8.4
        : input.sprint ? 6.6 : input.precision ? 5.2 : 6.2;
  const qualityFloor = trapRequested || receiveExitRequested || effortTurn ? 0.55 : 0.35;
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
    `control mode=${touchMode} q=${quality.toFixed(3)} turnDot=${ballDirectionDot.toFixed(3)} corridor=(${correction.x.toFixed(2)},${correction.z.toFixed(2)}) pressure=${pressure.toFixed(3)}`,
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
