import { describe, expect, test } from 'vitest';
import type { InputIntent } from '../index';
import { createPlayerState } from './PlayerState';
import { createFlatMovementWorld, stepPlayerMovement } from './movement';

const DT = 1 / 60;
const RIGHT: InputIntent = { moveX: 1, moveY: 0, aimYaw: 0, sprint: false, actionBits: 0 };

function yawDelta(a: number, b: number): number {
  const tau = Math.PI * 2;
  return ((b - a + Math.PI) % tau + tau) % tau - Math.PI;
}

describe('professional movement rebuild regressions', () => {
  test('a 90-degree jog cut redirects within 250 ms instead of entering a long sluggish plant', () => {
    const world = createFlatMovementWorld();
    let state = createPlayerState({ velocity: { x: 0, y: 0, z: 4.2 }, facingYaw: 0 });

    for (let tick = 0; tick < 15; tick += 1) {
      state = stepPlayerMovement(state, RIGHT, world, DT);
    }

    expect(state.velocity.x).toBeLessThan(-3.3);
    expect(Math.abs(state.velocity.z)).toBeLessThan(1.35);
    expect(state.position.z).toBeLessThan(0.78);
  });

  test('lower-body facing follows locomotion during a camera-facing strafe', () => {
    const world = createFlatMovementWorld();
    let state = createPlayerState();

    for (let tick = 0; tick < 24; tick += 1) {
      state = stepPlayerMovement(state, RIGHT, world, DT);
    }

    const travelYaw = Math.atan2(state.velocity.x, state.velocity.z);
    expect(Math.abs(yawDelta(state.facingYaw, travelYaw))).toBeLessThan(0.16);
    expect(Math.abs(yawDelta(state.facingYaw, RIGHT.aimYaw))).toBeGreaterThan(1.1);
  });
});
