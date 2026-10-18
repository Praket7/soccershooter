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

export const CLOSE_CONTROL_MOVE_SCALE = 0.68;
const EPSILON = 1e-9;

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
