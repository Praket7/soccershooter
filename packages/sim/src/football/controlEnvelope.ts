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

export interface ControlTouchInput {
  actor: Readonly<FootballActorSnapshot>;
  ball: Readonly<FootballBallSnapshot>;
  desiredDirection: FootballHorizontalDirection;
  precision: boolean;
  sprint: boolean;
  pressure: number;
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

/**
 * Generates one physically bounded touch. The target point is a planning aid;
 * only a velocity impulse is returned. The football is never snapped to it.
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
  const playerSpeed = actorSpeed(input.actor);
  const ballFacingDot = horizontalDot(facing, toBall);
  const desiredFacingDot = horizontalDot(facing, direction);
  const pressure = clampFootball(input.pressure, 0, 1);
  const balance = clampFootball(input.actor.balance, 0, 1);

  const frontFactor = clampFootball((ballFacingDot - MIN_FRONT_DOT) / (1 - MIN_FRONT_DOT), 0, 1);
  const directionFactor = clampFootball((desiredFacingDot + 0.35) / 1.35, 0, 1);
  const pressureFactor = 1 - 0.58 * pressure;
  const speedFactor = clampFootball(1 - Math.max(0, incomingSpeed - 12) / 22, 0.18, 1);
  const quality = clampFootball(frontFactor * directionFactor * pressureFactor * speedFactor * (0.55 + 0.45 * balance), 0, 1);

  const precisionDistance = 0.43;
  const normalDistance = 0.67;
  const sprintDistance = 1.27 + clampFootball(playerSpeed - 6, 0, 3) * 0.08;
  const touchDistance = input.sprint ? sprintDistance : input.precision ? precisionDistance : normalDistance;
  const targetBallSpeed = input.sprint
    ? clampFootball(6.6 + playerSpeed * 0.48, 7, 10.8)
    : input.precision
      ? clampFootball(2.4 + playerSpeed * 0.34, 2.4, 5.2)
      : clampFootball(3.6 + playerSpeed * 0.4, 3.6, 6.8);
  const plannedPoint = targetPoint(input.actor, direction, touchDistance, Math.max(input.ball.radius, input.ball.position.y));

  if (reach > CONTROL_REACH) {
    return { eligible: false, reason: 'out-of-reach', quality, touchDistance, targetBallSpeed, targetPoint: plannedPoint };
  }
  if (ballFacingDot < MIN_FRONT_DOT) {
    return { eligible: false, reason: 'behind-body', quality, touchDistance, targetBallSpeed, targetPoint: plannedPoint };
  }
  if (input.ball.position.y - input.ball.radius > MAX_CONTROL_HEIGHT) {
    return { eligible: false, reason: 'ball-too-high', quality, touchDistance, targetBallSpeed, targetPoint: plannedPoint };
  }
  if (incomingSpeed > HARD_INCOMING_SPEED) {
    return { eligible: false, reason: 'ball-too-fast', quality, touchDistance, targetBallSpeed, targetPoint: plannedPoint };
  }
  if (playerSpeed < IDLE_PLAYER_SPEED && incomingSpeed < IDLE_BALL_SPEED) {
    return { eligible: false, reason: 'idle-no-touch', quality, touchDistance, targetBallSpeed, targetPoint: plannedPoint };
  }

  const desiredVelocity: FootballVec3 = {
    x: direction.x * targetBallSpeed,
    y: input.ball.grounded ? 0 : input.ball.velocity.y * 0.32,
    z: direction.z * targetBallSpeed,
  };
  const baseDeltaSpeed = input.sprint ? 7 : input.precision ? 4.1 : 5.3;
  const maxDeltaSpeed = baseDeltaSpeed * (0.35 + 0.65 * quality);
  const command = commandTowardVelocity(
    'control-touch',
    input.ball,
    desiredVelocity,
    { x: direction.z * -2.2, y: 0, z: direction.x * 2.2 },
    input.ball.mass * maxDeltaSpeed,
    `control q=${quality.toFixed(3)} pressure=${pressure.toFixed(3)} ${input.sprint ? 'sprint' : input.precision ? 'precision' : 'normal'}`,
  );

  return {
    eligible: true,
    reason: 'ok',
    quality,
    touchDistance,
    targetBallSpeed,
    targetPoint: plannedPoint,
    command,
  };
}

export function shouldBreakControl(input: Readonly<ControlBreakInput>): boolean {
  const quality = clampFootball(input.controlQuality, 0, 1);
  const impulseThreshold = 6.5 + quality * 9.5;
  const speedThreshold = 18 + quality * 8;
  return input.opponentImpulse >= impulseThreshold || input.ballSpeed >= speedThreshold;
}
