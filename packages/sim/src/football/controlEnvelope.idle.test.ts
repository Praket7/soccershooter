import { describe, expect, test } from 'vitest';
import { buildControlTouch } from './controlEnvelope';
import type { FootballActorSnapshot, FootballBallSnapshot } from './types';

const actor: FootballActorSnapshot = {
  position: { x: 0, y: 0, z: 0 },
  velocity: { x: 0, y: 0, z: 0 },
  facingYaw: 0,
  balance: 1,
  pressure: 0,
  sprinting: false,
  preferredFoot: 'right',
};

const baseBall: FootballBallSnapshot = {
  position: { x: 0, y: 0.11, z: 0.72 },
  velocity: { x: 0, y: 0, z: 0 },
  angularVelocity: { x: 0, y: 0, z: 0 },
  radius: 0.11,
  mass: 0.436,
  grounded: true,
};

describe('Stage 05 non-magnetic idle control', () => {
  test('stationary player does not repeatedly nudge a stationary nearby ball', () => {
    const result = buildControlTouch({
      actor,
      ball: baseBall,
      desiredDirection: { x: 0, z: 1 },
      precision: false,
      sprint: false,
      pressure: 0,
    });
    expect(result.eligible).toBe(false);
    expect(result.reason).toBe('idle-no-touch');
    expect(result.command).toBeUndefined();
  });

  test('stationary player may still trap an actually incoming ball', () => {
    const result = buildControlTouch({
      actor,
      ball: { ...baseBall, velocity: { x: 0, y: 0, z: -4 } },
      desiredDirection: { x: 0, z: 1 },
      precision: true,
      sprint: false,
      pressure: 0,
    });
    expect(result.eligible).toBe(true);
    expect(result.command).toBeDefined();
  });
});
