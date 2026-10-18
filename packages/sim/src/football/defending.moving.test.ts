import { describe, expect, test } from 'vitest';
import { evaluateInterception } from './defending';
import type { FootballActorSnapshot, FootballBallSnapshot } from './types';

const defender: FootballActorSnapshot = {
  position: { x: 0, y: 0, z: 4 },
  velocity: { x: 3, y: 0, z: 0 },
  facingYaw: Math.PI / 2,
  balance: 1,
  pressure: 0,
  sprinting: false,
  preferredFoot: 'right',
};

const ball: FootballBallSnapshot = {
  position: { x: -3, y: 0.11, z: 4.2 },
  velocity: { x: 9, y: 0, z: 0 },
  angularVelocity: { x: 0, y: 0, z: 0 },
  radius: 0.11,
  mass: 0.436,
  grounded: true,
};

describe('Stage 05 moving interception geometry', () => {
  test('reachability compares ball and defender at the same predicted time', () => {
    const result = evaluateInterception({ defender, ball, horizonSeconds: 0.6 });

    expect(result.timeToWindow).toBeGreaterThan(0.45);
    expect(result.timeToWindow).toBeLessThan(0.55);
    expect(result.closestDistance).toBeLessThan(0.25);
    expect(result.eligible).toBe(true);
  });
});
