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
  test('a 90-degree jog cut redirects through a visible braking arc within 250 ms', () => {
    const world = createFlatMovementWorld();
    let state = createPlayerState({ velocity: { x: 0, y: 0, z: 4.2 }, facingYaw: 0 });

    for (let tick = 0; tick < 15; tick += 1) {
      state = stepPlayerMovement(state, RIGHT, world, DT);
    }

    expect(state.velocity.x).toBeLessThan(-1.4);
    expect(Math.abs(state.velocity.z)).toBeLessThan(2.4);
    expect(state.position.z).toBeLessThan(0.9);
  });

  test('authoritative facing stays on action aim during a camera-facing strafe', () => {
    const world = createFlatMovementWorld();
    let state = createPlayerState();

    for (let tick = 0; tick < 24; tick += 1) {
      state = stepPlayerMovement(state, RIGHT, world, DT);
    }

    const travelYaw = Math.atan2(state.velocity.x, state.velocity.z);
    expect(Math.abs(yawDelta(state.facingYaw, RIGHT.aimYaw))).toBeLessThan(0.01);
    expect(Math.abs(yawDelta(state.facingYaw, travelYaw))).toBeGreaterThan(1.1);
  });
});
