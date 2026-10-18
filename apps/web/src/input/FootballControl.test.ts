import { describe, expect, test } from 'vitest';
import type { InputIntent } from '@soccershooter/sim';
import { PlayerActionBits } from '@soccershooter/sim/player/PlayerState';
import { applyPointerButtonDown } from './ActionMap';
import { resolveDribbleIntent, resolveTravelFacingYaw, updateShotFacingLock } from './FootballControl';

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

    // While charging, locomotion visibly rotates the player toward the current
    // camera/aim direction. Contact legality must follow that visible body,
    // not a hidden yaw frozen at the first frame of the charge.
    const continued = updateShotFacingLock(begin.latchedYaw, PlayerActionBits.ShootHeld, 1.05);
    expect(continued.contactFacingYaw).toBeCloseTo(1.05, 8);

    const released = updateShotFacingLock(continued.latchedYaw, PlayerActionBits.ShootReleased, 1.05);
    expect(released.latchedYaw).toBeNull();
    expect(released.contactFacingYaw).toBeCloseTo(1.05, 8);
  });

  test('the first primary pointer-down becomes a shot hold even when that click also captures the mouse', () => {
    const next = applyPointerButtonDown(false, false, 0);
    expect(next.primaryDown).toBe(true);
    expect(next.secondaryDown).toBe(false);
  });
});
