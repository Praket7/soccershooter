import type { InputIntent } from '@soccershooter/sim';
import { PlayerActionBits } from '@soccershooter/sim/player/PlayerState';

export interface HorizontalDirection {
  x: number;
  z: number;
}

export interface ResolvedDribbleIntent {
  direction: HorizontalDirection;
  magnitude: number;
}

export interface ShotFacingLockResult {
  latchedYaw: number | null;
  contactFacingYaw: number | null;
}

export function resolveTechniqueMovementAuthority(
  currentAuthority: number,
  _techniqueWindingUp: boolean,
): number {
  return Math.min(1, Math.max(0, currentAuthority));
}

export const CLOSE_CONTROL_MOVE_SCALE = 0.68;
const EPSILON = 1e-9;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function normalize(direction: HorizontalDirection, fallback: HorizontalDirection): HorizontalDirection {
  const length = Math.hypot(direction.x, direction.z);
  if (length > EPSILON) return { x: direction.x / length, z: direction.z / length };
  const fallbackLength = Math.hypot(fallback.x, fallback.z);
  if (fallbackLength > EPSILON) return { x: fallback.x / fallbackLength, z: fallback.z / fallbackLength };
  return { x: 0, z: 1 };
}

/**
 * Close control is a locomotion tradeoff, not only a smaller ball touch.
 * Device-agnostic Precision input reduces movement authority and suppresses
 * sprint while preserving the player's requested direction.
 */
export function shapeFootballMovementIntent(intent: Readonly<InputIntent>): InputIntent {
  if ((intent.actionBits & PlayerActionBits.Precision) === 0) return { ...intent };
  return {
    ...intent,
    moveX: intent.moveX * CLOSE_CONTROL_MOVE_SCALE,
    moveY: intent.moveY * CLOSE_CONTROL_MOVE_SCALE,
    sprint: false,
  };
}

/**
 * Resolves the user's current movement request into the same camera-relative
 * world direction used by player locomotion. Dribble touches consume this
 * direction directly instead of inheriting the player's previous velocity.
 */
export function resolveDribbleIntent(
  intent: Pick<InputIntent, 'moveX' | 'moveY' | 'aimYaw'>,
  fallback: HorizontalDirection,
): ResolvedDribbleIntent {
  const rawMagnitude = Math.hypot(intent.moveX, intent.moveY);
  if (rawMagnitude <= EPSILON) {
    return { direction: normalize(fallback, { x: 0, z: 1 }), magnitude: 0 };
  }

  const magnitude = Math.min(1, rawMagnitude);
  const moveX = intent.moveX / rawMagnitude;
  const moveY = intent.moveY / rawMagnitude;
  const sin = Math.sin(intent.aimYaw);
  const cos = Math.cos(intent.aimYaw);
  return {
    direction: normalize({
      x: moveY * sin - moveX * cos,
      z: moveY * cos + moveX * sin,
    }, fallback),
    magnitude,
  };
}

/** Briefly carries a completed step-over into its opposite-side exit lane. */
export function resolveStepOverExitIntent(
  intent: Readonly<InputIntent>,
  exitDirection: Readonly<HorizontalDirection>,
): InputIntent {
  const magnitude = Math.min(1, Math.max(0.72, Math.hypot(intent.moveX, intent.moveY)));
  const sin = Math.sin(intent.aimYaw);
  const cos = Math.cos(intent.aimYaw);
  return {
    ...intent,
    moveX: (-exitDirection.x * cos + exitDirection.z * sin) * magnitude,
    moveY: (exitDirection.x * sin + exitDirection.z * cos) * magnitude,
    sprint: intent.sprint,
  };
}

/** Keep skill-move touches inside a forward-facing cone, even if input reverses. */
export function resolveTechniqueExitDirection(
  requested: Readonly<HorizontalDirection>,
  facingYaw: number,
  minimumForwardDot = 0.58,
): HorizontalDirection {
  const forward = { x: Math.sin(facingYaw), z: Math.cos(facingYaw) };
  const right = { x: Math.cos(facingYaw), z: -Math.sin(facingYaw) };
  const direction = normalize(requested, forward);
  const forwardDot = direction.x * forward.x + direction.z * forward.z;
  if (forwardDot >= minimumForwardDot) return direction;
  const side = direction.x * right.x + direction.z * right.z;
  const lateral = Math.sign(side || 1) * Math.sqrt(1 - minimumForwardDot * minimumForwardDot);
  return normalize({
    x: forward.x * minimumForwardDot + right.x * lateral,
    z: forward.z * minimumForwardDot + right.z * lateral,
  }, forward);
}

/** Carry the exit touch with the runner instead of launching the ball at an
 * unrelated fixed speed. The added push creates separation from a defender
 * while keeping the ball inside the next dribble recovery pocket. */
export function resolveStepOverBallVelocity(
  playerVelocity: Readonly<{ x: number; z: number }>,
  exitDirection: Readonly<HorizontalDirection>,
): { x: number; y: number; z: number } {
  const speed = Math.hypot(playerVelocity.x, playerVelocity.z);
  if (speed < 0.75) return { x: exitDirection.x * 1.8, y: 0, z: exitDirection.z * 1.8 };
  return {
    x: playerVelocity.x + exitDirection.x * 0.38,
    y: 0,
    z: playerVelocity.z + exitDirection.z * 0.38,
  };
}

/** The elastico's snap follows the cut while preserving most running speed. */
export function resolveElasticoBallVelocity(
  playerVelocity: Readonly<{ x: number; z: number }>,
  exitDirection: Readonly<HorizontalDirection>,
): { x: number; y: number; z: number } {
  const speed = Math.hypot(playerVelocity.x, playerVelocity.z);
  if (speed < 0.75) return { x: exitDirection.x * 2.2, y: 0, z: exitDirection.z * 2.2 };
  return {
    x: playerVelocity.x + exitDirection.x * 0.55,
    y: 0,
    z: playerVelocity.z + exitDirection.z * 0.55,
  };
}

export function resolveElasticoOutsideTouchVelocity(
  playerVelocity: Readonly<{ x: number; z: number }>,
  outsideDirection: Readonly<HorizontalDirection>,
): { x: number; y: number; z: number } {
  const speed = Math.hypot(playerVelocity.x, playerVelocity.z);
  if (speed < 0.75) return { x: outsideDirection.x * 0.9, y: 0, z: outsideDirection.z * 0.9 };
  return {
    x: playerVelocity.x + outsideDirection.x * 0.75,
    y: 0,
    z: playerVelocity.z + outsideDirection.z * 0.75,
  };
}

/** The Elastico's inside snap must oppose the foot used for the outside touch. */
export function resolveElasticoExitDirectionForFoot(
  facingYaw: number,
  contactFoot: 'left' | 'right',
): HorizontalDirection {
  const forward = { x: Math.sin(facingYaw), z: Math.cos(facingYaw) };
  const right = { x: Math.cos(facingYaw), z: -Math.sin(facingYaw) };
  const inwardSign = contactFoot === 'right' ? -1 : 1;
  return resolveTechniqueExitDirection(normalize({
    x: forward.x * 0.58 + right.x * inwardSign * 0.82,
    z: forward.z * 0.58 + right.z * inwardSign * 0.82,
  }, forward), facingYaw);
}

/** Local ball anchor used while the Elastico's sole/inside cut is animated. */
export function resolveElasticoBallAnchor(
  progress: number,
  feintFoot: 'left' | 'right',
  start: Readonly<{ x: number; z: number }>,
): { x: number; z: number } {
  const side = feintFoot === 'left' ? -1 : 1;
  const points = [
    { t: 0, x: start.x, z: start.z },
    { t: 0.42, x: side * 0.48, z: 0.66 },
    { t: 0.68, x: side * 0.50, z: 0.78 },
    { t: 0.88, x: -side * 0.32, z: 0.82 },
    { t: 1, x: -side * 0.22, z: 0.92 },
  ];
  const t = clamp(progress, 0, 1);
  const index = points.findIndex((point, i) => i < points.length - 1 && t <= points[i + 1]!.t);
  const from = points[Math.max(0, index)]!;
  const to = points[Math.min(points.length - 1, Math.max(1, index + 1))]!;
  const localT = clamp((t - from.t) / Math.max(1e-6, to.t - from.t), 0, 1);
  const eased = localT * localT * (3 - 2 * localT);
  return { x: from.x + (to.x - from.x) * eased, z: from.z + (to.z - from.z) * eased };
}

/**
 * For dribble/control contacts, a moving player's hips/feet are considered
 * oriented with travel rather than with the free-look camera. At very low
 * speed we keep the prior facing so standing setup remains stable.
 */
export function resolveTravelFacingYaw(
  velocity: HorizontalDirection,
  fallbackYaw: number,
  minimumSpeed = 0.35,
): number {
  const speed = Math.hypot(velocity.x, velocity.z);
  return speed > minimumSpeed ? Math.atan2(velocity.x, velocity.z) : fallbackYaw;
}

/**
 * Tracks active shot preparation without freezing a hidden body orientation.
 * The player mesh visibly turns toward current aim through the normal movement
 * turn-rate limit, so contact legality must use that same visible body yaw on
 * every frame and at release. Aim is still independent and off-angle shots are
 * still penalized by the authoritative shooting model.
 */
export function updateShotFacingLock(
  _previousLatchedYaw: number | null,
  actionBits: number,
  currentFacingYaw: number,
): ShotFacingLockResult {
  const shootHeld = (actionBits & PlayerActionBits.ShootHeld) !== 0;
  const shootReleased = (actionBits & PlayerActionBits.ShootReleased) !== 0;

  if (shootReleased) {
    return { latchedYaw: null, contactFacingYaw: currentFacingYaw };
  }
  if (shootHeld) {
    return { latchedYaw: currentFacingYaw, contactFacingYaw: currentFacingYaw };
  }
  return { latchedYaw: null, contactFacingYaw: null };
}
