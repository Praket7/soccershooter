export interface FootballVec3 {
  x: number;
  y: number;
  z: number;
}

export interface FootballHorizontalDirection {
  x: number;
  z: number;
}

export type FootballFoot = 'left' | 'right';

export interface FootballActorSnapshot {
  position: FootballVec3;
  velocity: FootballVec3;
  facingYaw: number;
  balance: number;
  pressure: number;
  sprinting: boolean;
  preferredFoot: FootballFoot;
}

export interface FootballBallSnapshot {
  position: FootballVec3;
  velocity: FootballVec3;
  angularVelocity: FootballVec3;
  radius: number;
  mass: number;
  grounded: boolean;
}

export type BallContactKind =
  | 'control-touch'
  | 'pass'
  | 'shot'
  | 'standing-challenge'
  | 'committed-challenge'
  | 'interception'
  | 'header'
  | 'volley';

export interface BallContactCommand {
  kind: BallContactKind;
  deltaVelocity: FootballVec3;
  angularVelocityDelta: FootballVec3;
  /** Hard safety cap for the linear impulse magnitude m * |delta-v|. */
  maxImpulse: number;
  diagnostic: string;
}

export const DEFAULT_FOOTBALL_BALL_MASS = 0.436;
export const DEFAULT_FOOTBALL_BALL_RADIUS = 0.11;

export function clampFootball(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function finiteFootball(value: number, fallback = 0): number {
  return Number.isFinite(value) ? value : fallback;
}

export function horizontalMagnitude(value: Pick<FootballVec3, 'x' | 'z'>): number {
  return Math.hypot(value.x, value.z);
}

export function magnitude3(value: FootballVec3): number {
  return Math.hypot(value.x, value.y, value.z);
}

export function horizontalDistance(a: FootballVec3, b: FootballVec3): number {
  return Math.hypot(a.x - b.x, a.z - b.z);
}

export function normalizeHorizontal(
  value: FootballHorizontalDirection,
  fallback: FootballHorizontalDirection = { x: 0, z: 1 },
): FootballHorizontalDirection {
  const x = finiteFootball(value.x);
  const z = finiteFootball(value.z);
  const length = Math.hypot(x, z);
  if (length <= 1e-9) {
    const fallbackLength = Math.hypot(fallback.x, fallback.z);
    if (fallbackLength <= 1e-9) return { x: 0, z: 1 };
    return { x: fallback.x / fallbackLength, z: fallback.z / fallbackLength };
  }
  return { x: x / length, z: z / length };
}

export function forwardFromYaw(yaw: number): FootballHorizontalDirection {
  const finiteYaw = finiteFootball(yaw);
  return { x: Math.sin(finiteYaw), z: Math.cos(finiteYaw) };
}

export function horizontalDot(a: FootballHorizontalDirection, b: FootballHorizontalDirection): number {
  const left = normalizeHorizontal(a);
  const right = normalizeHorizontal(b);
  return clampFootball(left.x * right.x + left.z * right.z, -1, 1);
}

export function horizontalAngle(a: FootballHorizontalDirection, b: FootballHorizontalDirection): number {
  return Math.acos(horizontalDot(a, b));
}

export function vectorFromTo(a: FootballVec3, b: FootballVec3): FootballVec3 {
  return { x: b.x - a.x, y: b.y - a.y, z: b.z - a.z };
}

export function addVec3(a: FootballVec3, b: FootballVec3): FootballVec3 {
  return { x: a.x + b.x, y: a.y + b.y, z: a.z + b.z };
}

export function scaleVec3(value: FootballVec3, scalar: number): FootballVec3 {
  return { x: value.x * scalar, y: value.y * scalar, z: value.z * scalar };
}

export function clampVecMagnitude(value: FootballVec3, maxMagnitude: number): FootballVec3 {
  const length = magnitude3(value);
  const max = Math.max(0, finiteFootball(maxMagnitude));
  if (length <= max || length <= 1e-12) return { ...value };
  return scaleVec3(value, max / length);
}

export function cloneFootballBall(ball: Readonly<FootballBallSnapshot>): FootballBallSnapshot {
  return {
    position: { ...ball.position },
    velocity: { ...ball.velocity },
    angularVelocity: { ...ball.angularVelocity },
    radius: finiteFootball(ball.radius, DEFAULT_FOOTBALL_BALL_RADIUS),
    mass: finiteFootball(ball.mass, DEFAULT_FOOTBALL_BALL_MASS),
    grounded: Boolean(ball.grounded),
  };
}

/**
 * Applies a legal contact as velocity/angular-velocity change only. Position is
 * deliberately immutable here: player interaction can impart impulses but may
 * never teleport or weld the football to a target point.
 */
export function applyBallContact(
  ball: Readonly<FootballBallSnapshot>,
  command: Readonly<BallContactCommand>,
): FootballBallSnapshot {
  const next = cloneFootballBall(ball);
  const mass = Math.max(0.001, next.mass || DEFAULT_FOOTBALL_BALL_MASS);
  const maxDeltaSpeed = Math.max(0, command.maxImpulse) / mass;
  const boundedDeltaVelocity = clampVecMagnitude(command.deltaVelocity, maxDeltaSpeed);
  next.velocity = addVec3(next.velocity, boundedDeltaVelocity);
  next.angularVelocity = clampVecMagnitude(addVec3(next.angularVelocity, command.angularVelocityDelta), 300);
  return next;
}

export function commandTowardVelocity(
  kind: BallContactKind,
  ball: Readonly<FootballBallSnapshot>,
  targetVelocity: FootballVec3,
  angularVelocityDelta: FootballVec3,
  maxImpulse: number,
  diagnostic: string,
): BallContactCommand {
  return {
    kind,
    deltaVelocity: {
      x: targetVelocity.x - ball.velocity.x,
      y: targetVelocity.y - ball.velocity.y,
      z: targetVelocity.z - ball.velocity.z,
    },
    angularVelocityDelta: { ...angularVelocityDelta },
    maxImpulse: Math.max(0, finiteFootball(maxImpulse)),
    diagnostic,
  };
}
