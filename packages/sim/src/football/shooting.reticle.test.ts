import { describe, expect, test } from 'vitest';
import { buildShot, type ShotBuildInput } from './shooting';
import type { FootballActorSnapshot, FootballBallSnapshot, FootballVec3 } from './types';

const shooter: FootballActorSnapshot = {
  position: { x: 0, y: 0, z: -0.65 },
  velocity: { x: 0, y: 0, z: 0 },
  facingYaw: 0,
  balance: 1,
  pressure: 0,
  sprinting: false,
  preferredFoot: 'right',
};

const ball: FootballBallSnapshot = {
  position: { x: 0, y: 0.11, z: 0 },
  velocity: { x: 0, y: 0, z: 0 },
  angularVelocity: { x: 0, y: 0, z: 0 },
  radius: 0.11,
  mass: 0.436,
  grounded: true,
};

type ReticleShotInput = ShotBuildInput & { aimTarget: FootballVec3 };

function normalShotAt(aimTarget: FootballVec3) {
  const input: ReticleShotInput = {
    style: 'normal',
    shooter,
    ball,
    aim: { x: 0, z: 1 },
    aimTarget,
    charge: 0.72,
    spinInput: 0,
    pressure: 0,
    balance: 1,
    contactFoot: 'right',
  };
  return buildShot(input);
}

describe('Stage 05 reticle-driven shooting', () => {
  test('moving the center reticle higher on the same goal materially raises the launch', () => {
    const low = normalShotAt({ x: 0, y: 0.45, z: 17 });
    const high = normalShotAt({ x: 0, y: 2.25, z: 17 });

    expect(low.legal).toBe(true);
    expect(high.legal).toBe(true);
    expect(high.launchVelocity.y - low.launchVelocity.y).toBeGreaterThan(1.4);
    expect(Math.abs(high.launchVelocity.x - low.launchVelocity.x)).toBeLessThan(1e-9);
  });

  test('reticle elevation remains bounded by the selected shot technique', () => {
    const absurd = normalShotAt({ x: 0, y: 30, z: 17 });
    expect(absurd.legal).toBe(true);
    const elevation = Math.atan2(absurd.launchVelocity.y, Math.hypot(absurd.launchVelocity.x, absurd.launchVelocity.z));
    expect(elevation * 180 / Math.PI).toBeLessThanOrEqual(18.01);
    expect(absurd.launchSpeed).toBeLessThanOrEqual(36);
  });

  test('the same reticle target produces exactly the same shot solution', () => {
    const target = { x: 1.25, y: 1.6, z: 17 };
    expect(normalShotAt(target)).toEqual(normalShotAt(target));
  });
});
