import { describe, expect, it } from 'vitest';
import { applyBallContact } from '@soccershooter/sim/football/types';
import { applyShotBuildModifier } from './shotBuildModifiers';

describe('career shot build modifier', () => {
  it('keeps the applied shot inside the normal speed and impulse envelope for a moving ball', () => {
    const shot = {
      launchVelocity: { x: 0, y: 0, z: 34 },
      command: {
        kind: 'shot',
        deltaVelocity: { x: 0, y: 0, z: 24 },
        angularVelocityDelta: { x: 0, y: 0, z: 0 },
        maxImpulse: 15.5,
        diagnostic: 'shot',
      },
    } as const;
    const result = applyShotBuildModifier(shot, 1.08);

    expect(Math.hypot(result.launchVelocity.x, result.launchVelocity.y, result.launchVelocity.z)).toBeLessThanOrEqual(36);
    expect(result.launchVelocity.z).toBeCloseTo(36);
    expect(result.command?.maxImpulse).toBe(15.5);
    const ball = {
      position: { x: 0, y: 0.11, z: 0 },
      velocity: { x: 0, y: 0, z: 10 },
      angularVelocity: { x: 0, y: 0, z: 0 },
      radius: 0.11,
      mass: 0.436,
      grounded: true,
    } as const;
    const baseline = applyBallContact(ball, shot.command);
    const applied = applyBallContact(ball, result.command!);
    expect(baseline.velocity.z).toBeCloseTo(34);
    expect(applied.velocity.z).toBeGreaterThan(baseline.velocity.z);
    expect(applied.velocity.z).toBeCloseTo(36);
    expect(Math.hypot(applied.velocity.x, applied.velocity.y, applied.velocity.z)).toBeLessThanOrEqual(36);
    expect(applied.velocity.z).toBeCloseTo(36);
  });

  it('does not increase speed beyond the existing impulse-limited result for an extreme incoming ball', () => {
    const ball = {
      position: { x: 0, y: 0.11, z: 0 },
      velocity: { x: 0, y: 0, z: -100 },
      angularVelocity: { x: 0, y: 0, z: 0 },
      radius: 0.11,
      mass: 0.436,
      grounded: true,
    } as const;
    const shot = {
      launchVelocity: { x: 0, y: 0, z: 36 },
      command: {
        kind: 'shot' as const,
        deltaVelocity: { x: 0, y: 0, z: 136 },
        angularVelocityDelta: { x: 0, y: 0, z: 0 },
        maxImpulse: 15.5,
        diagnostic: 'max shot',
      },
    };

    const baseline = applyBallContact(ball, shot.command);
    const power = applyBallContact(ball, applyShotBuildModifier(shot, 1.08).command!);
    expect(Math.hypot(power.velocity.x, power.velocity.y, power.velocity.z)).toBeGreaterThan(36);
    expect(power.velocity).toEqual(baseline.velocity);
  });
});
