import { describe, expect, test } from 'vitest';
import type { InputIntent } from '../index';
import { createPlayerState } from './PlayerState';
import { DEFAULT_MOVEMENT_CONFIG, createFlatMovementWorld, stepPlayerMovement } from './movement';

const DT = 1 / 60;
const SPRINT: InputIntent = { moveX: 0, moveY: 1, aimYaw: 0, sprint: true, actionBits: 0 };
const NEUTRAL: InputIntent = { moveX: 0, moveY: 0, aimYaw: 0, sprint: false, actionBits: 0 };

function sprintSplit(distanceMeters: number): number {
  const world = createFlatMovementWorld({ minX: -20, maxX: 20, minZ: -5, maxZ: 40 });
  let state = createPlayerState();
  for (let tick = 1; tick <= 300; tick += 1) {
    state = stepPlayerMovement(state, SPRINT, world, DT);
    if (state.position.z >= distanceMeters) return tick * DT;
  }
  throw new Error(`failed to reach ${distanceMeters}m`);
}

function fullSpeedStop(): { seconds: number; distance: number } {
  const world = createFlatMovementWorld({ minX: -20, maxX: 20, minZ: -20, maxZ: 40 });
  let state = createPlayerState({ velocity: { x: 0, y: 0, z: DEFAULT_MOVEMENT_CONFIG.sprintSpeed } });
  const startZ = state.position.z;
  for (let tick = 1; tick <= 180; tick += 1) {
    state = stepPlayerMovement(state, NEUTRAL, world, DT);
    if (Math.hypot(state.velocity.x, state.velocity.z) <= 0.05) {
      return { seconds: tick * DT, distance: state.position.z - startZ };
    }
  }
  throw new Error('player did not stop');
}

describe('football locomotion realism envelope', () => {
  test('standing sprint acceleration stays near elite-football splits without feeling slow', () => {
    const fiveMeters = sprintSplit(5);
    const tenMeters = sprintSplit(10);

    // Professional football measurements cluster around ~1.0 s over 5 m and
    // ~1.7 s over 10 m. The game keeps a small responsiveness allowance while
    // rejecting the previous sub-0.8 s 5 m launch.
    expect(fiveMeters).toBeGreaterThanOrEqual(0.9);
    expect(fiveMeters).toBeLessThanOrEqual(1.2);
    expect(tenMeters).toBeGreaterThanOrEqual(1.45);
    expect(tenMeters).toBeLessThanOrEqual(1.75);
  });

  test('a full-speed release carries visible braking distance instead of stopping on rails', () => {
    const stop = fullSpeedStop();

    // Real football deceleration is progressive across several braking steps.
    // This envelope is intentionally more responsive than laboratory averages,
    // but still requires enough time/distance for momentum to be visually legible.
    expect(stop.seconds).toBeGreaterThanOrEqual(0.5);
    expect(stop.seconds).toBeLessThanOrEqual(1.1);
    expect(stop.distance).toBeGreaterThanOrEqual(2.4);
    expect(stop.distance).toBeLessThanOrEqual(4.8);
  });
});
