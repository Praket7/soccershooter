import { describe, expect, test } from 'vitest';
import { BALL_CONSTANTS, cloneBallState, createBallState, kineticEnergy } from './BallState';

describe('Stage 04 ball state contract', () => {
  test('uses a regulation-scale football baseline and validates finite state', () => {
    expect(BALL_CONSTANTS.radius).toBeCloseTo(0.11, 6);
    expect(BALL_CONSTANTS.mass).toBeCloseTo(0.436, 6);
    expect(BALL_CONSTANTS.gravity).toBeCloseTo(9.81, 6);

    expect(() => createBallState({ velocity: { x: Number.NaN } })).toThrow(/velocity\.x.*finite/i);
  });

  test('cloning is deep and kinetic energy includes translation and spin', () => {
    const original = createBallState({
      velocity: { x: 3, y: 4, z: 0 },
      angularVelocity: { x: 0, y: 20, z: 0 },
    });
    const cloned = cloneBallState(original);
    cloned.position.x = 99;
    expect(original.position.x).toBe(0);
    expect(kineticEnergy(original)).toBeGreaterThan(0.5 * BALL_CONSTANTS.mass * 25);
  });
});
