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

const EPSILON = 1e-9;

function normalize(direction: HorizontalDirection, fallback: HorizontalDirection): HorizontalDirection {
  const length = Math.hypot(direction.x, direction.z);
  if (length > EPSILON) return { x: direction.x / length, z: direction.z / length };
  const fallbackLength = Math.hypot(fallback.x, fallback.z);
  if (fallbackLength > EPSILON) return { x: fallback.x / fallbackLength, z: fallback.z / fallbackLength };
  return { x: 0, z: 1 };
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
 * Keeps shooting aim free while preserving the body setup that existed when
 * shot preparation began. Mouse/right-stick yaw may keep changing the aim
 * vector during charge, but the contact model still receives a stable body
 * orientation and can penalize ambitious off-angle strikes honestly.
 */
export function updateShotFacingLock(
  previousLatchedYaw: number | null,
  actionBits: number,
  currentFacingYaw: number,
): ShotFacingLockResult {
  const shootHeld = (actionBits & PlayerActionBits.ShootHeld) !== 0;
  const shootReleased = (actionBits & PlayerActionBits.ShootReleased) !== 0;

  if (shootReleased) {
    return {
      latchedYaw: null,
      contactFacingYaw: previousLatchedYaw ?? currentFacingYaw,
    };
  }
  if (shootHeld) {
    const latchedYaw = previousLatchedYaw ?? currentFacingYaw;
    return { latchedYaw, contactFacingYaw: latchedYaw };
  }
  return { latchedYaw: null, contactFacingYaw: null };
}
