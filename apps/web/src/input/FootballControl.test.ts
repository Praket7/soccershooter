import { describe, expect, test } from 'vitest';
import type { InputIntent } from '@soccershooter/sim';
import { PlayerActionBits } from '@soccershooter/sim/player/PlayerState';
import { resolvePointerButtonDown } from './ActionMap';
import {
  CLOSE_CONTROL_MOVE_SCALE,
  resolveDribbleIntent,
  resolveTravelFacingYaw,
  shapeFootballMovementIntent,
  updateShotFacingLock,
} from './FootballControl';

describe('Stage 05 owner control feedback', () => {
  test('dribble direction follows the newly requested camera-relative input, not old player velocity', () => {
    const intent: InputIntent = {
      moveX: 1,
      moveY: 0,
      aimYaw: 0,
      sprint: true,
      actionBits: 0,
    };
    const resolved = resolveDribbleIntent(intent, { x: 0, z: 1 });
    expect(resolved.magnitude).toBeCloseTo(1, 8);
    expect(resolved.direction.x).toBeCloseTo(-1, 8);
    expect(resolved.direction.z).toBeCloseTo(0, 8);
  });

  test('football body-facing follows travel direction during a reversal instead of stale camera yaw', () => {
    const reversed = resolveTravelFacingYaw({ x: 0, z: -6.5 }, 0);
    expect(Math.abs(Math.abs(reversed) - Math.PI)).toBeLessThan(1e-8);

    const idle = resolveTravelFacingYaw({ x: 0.05, z: 0.02 }, 0.7);
    expect(idle).toBeCloseTo(0.7, 8);
  });

  test('shot contact follows the visible current body as the player turns toward mouse aim', () => {
    const begin = updateShotFacingLock(null, PlayerActionBits.ShootHeld, 0.15);
    expect(begin.contactFacingYaw).toBeCloseTo(0.15, 8);

    const continued = updateShotFacingLock(begin.latchedYaw, PlayerActionBits.ShootHeld, 1.05);
    expect(continued.contactFacingYaw).toBeCloseTo(1.05, 8);

    const released = updateShotFacingLock(continued.latchedYaw, PlayerActionBits.ShootReleased, 1.05);
    expect(released.latchedYaw).toBeNull();
    expect(released.contactFacingYaw).toBeCloseTo(1.05, 8);
  });

  test('the first unlocked primary pointer-down requests camera capture and emits no football action', () => {
    const result = resolvePointerButtonDown({
      primaryDown: false,
      secondaryDown: false,
      button: 0,
      pointerLocked: false,
    });
    expect(result.requestPointerLock).toBe(true);
    expect(result.primaryDown).toBe(false);
    expect(result.actionBits & PlayerActionBits.ShootHeld).toBe(0);
  });

  test('RMB close control lowers locomotion authority and disables sprint while preserving requested direction', () => {
    const intent: InputIntent = {
      moveX: 0.6,
      moveY: 0.8,
      aimYaw: 0.4,
      sprint: true,
      actionBits: PlayerActionBits.Precision,
    };
    const shaped = shapeFootballMovementIntent(intent);
    expect(shaped.sprint).toBe(false);
    expect(Math.hypot(shaped.moveX, shaped.moveY)).toBeCloseTo(CLOSE_CONTROL_MOVE_SCALE, 8);
    expect(shaped.moveX / shaped.moveY).toBeCloseTo(intent.moveX / intent.moveY, 8);
  });

  test('normal locomotion is unchanged when close control is not held', () => {
    const intent: InputIntent = {
      moveX: -0.4,
      moveY: 0.7,
      aimYaw: -0.2,
      sprint: true,
      actionBits: 0,
    };
    expect(shapeFootballMovementIntent(intent)).toEqual(intent);
  });
});
