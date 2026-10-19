import { describe, expect, it } from 'vitest';
import { applyBallContact } from '@soccershooter/sim/football/types';
import { applyShotBuildModifier } from './shotBuildModifiers';

describe('career shot build modifier', () => {
  it('keeps the applied shot inside the normal speed and impulse envelope for a moving ball', () => {
    const result = applyShotBuildModifier({
      launchVelocity: { x: 0, y: 0, z: 36 },
      command: {
        kind: 'shot',
        deltaVelocity: { x: 0, y: 0, z: 26 },
        angularVelocityDelta: { x: 0, y: 0, z: 0 },
        maxImpulse: 15.5,
        diagnostic: 'max shot',
      },
    }, 1.08);

    expect(Math.hypot(result.launchVelocity.x, result.launchVelocity.y, result.launchVelocity.z)).toBeLessThanOrEqual(36);
    expect(result.launchVelocity.z).toBeCloseTo(36);
    expect(result.command?.maxImpulse).toBe(15.5);
    const applied = applyBallContact({
      position: { x: 0, y: 0.11, z: 0 },
      velocity: { x: 0, y: 0, z: 10 },
      angularVelocity: { x: 0, y: 0, z: 0 },
      radius: 0.11,
      mass: 0.436,
      grounded: true,
    }, result.command!);
    expect(Math.hypot(applied.velocity.x, applied.velocity.y, applied.velocity.z)).toBeLessThanOrEqual(36);
    expect(applied.velocity.z).toBeCloseTo(36);
  });
});
