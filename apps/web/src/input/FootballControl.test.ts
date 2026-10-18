import { describe, expect, test } from 'vitest';
import type { InputIntent } from '@soccershooter/sim';
import { PlayerActionBits } from '@soccershooter/sim/player/PlayerState';
import { applyPointerButtonDown } from './ActionMap';
import { resolveDribbleIntent, updateShotFacingLock } from './FootballControl';

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

  test('shot preparation keeps the body-facing reference while mouse aim remains free to move', () => {
    const begin = updateShotFacingLock(null, PlayerActionBits.ShootHeld, 0.15);
    expect(begin.latchedYaw).toBeCloseTo(0.15, 8);
    expect(begin.contactFacingYaw).toBeCloseTo(0.15, 8);

    const continued = updateShotFacingLock(begin.latchedYaw, PlayerActionBits.ShootHeld, 1.05);
    expect(continued.latchedYaw).toBeCloseTo(0.15, 8);
    expect(continued.contactFacingYaw).toBeCloseTo(0.15, 8);

    const released = updateShotFacingLock(continued.latchedYaw, PlayerActionBits.ShootReleased, 1.05);
    expect(released.latchedYaw).toBeNull();
    expect(released.contactFacingYaw).toBeCloseTo(0.15, 8);
  });

  test('the first primary pointer-down becomes a shot hold even when that click also captures the mouse', () => {
    const next = applyPointerButtonDown(false, false, 0);
    expect(next.primaryDown).toBe(true);
    expect(next.secondaryDown).toBe(false);
  });
});
