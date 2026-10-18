import { describe, expect, test } from 'vitest';
import { buildShot } from './shooting';
import type { FootballActorSnapshot, FootballBallSnapshot } from './types';

const shooter: FootballActorSnapshot = {
  position: { x: 0, y: 0, z: 0 },
  velocity: { x: 0, y: 0, z: 2 },
  facingYaw: 0,
  balance: 1,
  pressure: 0,
  sprinting: false,
  preferredFoot: 'right',
};

const ball: FootballBallSnapshot = {
  position: { x: 0, y: 0.11, z: 0.72 },
  velocity: { x: 0, y: 0, z: 0 },
  angularVelocity: { x: 0, y: 0, z: 0 },
  radius: 0.11,
  mass: 0.436,
  grounded: true,
};

function shot(style: 'normal' | 'knuckle', knuckleSeed?: number) {
  return buildShot({
    style,
    shooter,
    ball,
    aim: { x: 0, z: 1 },
    charge: 0.75,
    spinInput: 0.2,
    pressure: 0,
    balance: 1,
    contactFoot: 'right',
    ...(knuckleSeed === undefined ? {} : { knuckleSeed }),
  });
}

describe('Stage 05 knuckle seed lifecycle', () => {
  test('ordinary strikes explicitly clear prior knuckle perturbation', () => {
    expect(shot('normal', 0x12345678).knuckleSeed).toBe(0);
  });

  test('knuckle strikes carry the deterministic event seed into ball physics', () => {
    expect(shot('knuckle', 0x12345678).knuckleSeed).toBe(0x12345678);
    expect(shot('knuckle', 0x12345678).knuckleSeed).toBe(shot('knuckle', 0x12345678).knuckleSeed);
  });
});
