import { describe, expect, test } from 'vitest';
import { solvePass } from './passing';
import { buildShot } from './shooting';
import type { FootballActorSnapshot, FootballBallSnapshot } from './types';

const ball: FootballBallSnapshot = {
  position: { x: 0, y: 0.11, z: 0 },
  velocity: { x: 0, y: 0, z: 0 },
  angularVelocity: { x: 0, y: 0, z: 0 },
  radius: 0.11,
  mass: 0.436,
  grounded: true,
};

function actor(facingYaw: number): FootballActorSnapshot {
  return {
    position: { x: 0, y: 0, z: -0.55 },
    velocity: { x: 0, y: 0, z: 0 },
    facingYaw,
    balance: 1,
    pressure: 0,
    sprinting: false,
    preferredFoot: 'right',
  };
}

describe('strike-relative pitch spin', () => {
  test('normal shot preserves the established +Z backspin signature', () => {
    const shot = buildShot({
      style: 'normal',
      shooter: actor(0),
      ball,
      aim: { x: 0, z: 1 },
      charge: 0.7,
      spinInput: 0,
      pressure: 0,
      balance: 1,
      contactFoot: 'right',
    });

    expect(shot.legal).toBe(true);
    expect(shot.command?.angularVelocityDelta).toEqual({ x: -3, y: 0, z: 0 });
  });

  test('normal shot aimed +X rotates backspin with the strike direction', () => {
    const shot = buildShot({
      style: 'normal',
      shooter: actor(Math.PI / 2),
      ball,
      aim: { x: 1, z: 0 },
      charge: 0.7,
      spinInput: 0,
      pressure: 0,
      balance: 1,
      contactFoot: 'right',
    });

    expect(shot.legal).toBe(true);
    expect(shot.command?.angularVelocityDelta.x).toBeCloseTo(0, 12);
    expect(shot.command?.angularVelocityDelta.y).toBeCloseTo(0, 12);
    expect(shot.command?.angularVelocityDelta.z).toBeCloseTo(3, 12);
  });

  test('lofted pass aimed +X rotates its backspin with the pass direction', () => {
    const solution = solvePass({
      type: 'lofted',
      passer: actor(Math.PI / 2),
      ball,
      receiver: { position: { x: 14, y: 0, z: 0 }, velocity: { x: 0, y: 0, z: 0 } },
      userAim: { x: 1, z: 0 },
      assist: 0,
      pressure: 0,
      allowBehindBodyTechnique: false,
    });

    expect(solution.legal).toBe(true);
    expect(solution.command?.angularVelocityDelta.x).toBeCloseTo(0, 12);
    expect(solution.command?.angularVelocityDelta.y).toBeCloseTo(0, 12);
    expect(solution.command?.angularVelocityDelta.z).toBeCloseTo(18, 12);
  });
});
