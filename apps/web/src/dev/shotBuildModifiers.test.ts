import { describe, expect, it } from 'vitest';
import { applyShotBuildModifier } from './shotBuildModifiers';

describe('career shot build modifier', () => {
  it('keeps the power build inside the normal shot speed and impulse envelope', () => {
    const result = applyShotBuildModifier({
      launchVelocity: { x: 0, y: 0, z: 36 },
      command: {
        kind: 'shot',
        deltaVelocity: { x: 0, y: 0, z: 30 },
        angularVelocityDelta: { x: 0, y: 0, z: 0 },
        maxImpulse: 15.5,
        diagnostic: 'max shot',
      },
    }, 1.08);

    expect(Math.hypot(result.launchVelocity.x, result.launchVelocity.y, result.launchVelocity.z)).toBeLessThanOrEqual(36);
    expect(result.launchVelocity.z).toBeCloseTo(36);
    expect(result.command?.maxImpulse).toBe(15.5);
    expect(result.command?.deltaVelocity.z).toBeCloseTo(32.4);
  });
});
