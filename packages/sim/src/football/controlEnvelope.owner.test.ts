import { describe, expect, test } from 'vitest';
import { buildControlTouch } from './controlEnvelope';
import { applyBallContact, type FootballActorSnapshot, type FootballBallSnapshot } from './types';

const actor = (overrides: Partial<FootballActorSnapshot> = {}): FootballActorSnapshot => ({
  position: { x: 0, y: 0, z: 0 },
  velocity: { x: 0, y: 0, z: 4 },
  facingYaw: 0,
  balance: 1,
  pressure: 0,
  sprinting: false,
  preferredFoot: 'right',
  ...overrides,
});

const ball = (overrides: Partial<FootballBallSnapshot> = {}): FootballBallSnapshot => ({
  position: { x: 0, y: 0.11, z: 0.78 },
  velocity: { x: 0, y: 0, z: 4 },
  angularVelocity: { x: 0, y: 0, z: 0 },
  radius: 0.11,
  mass: 0.436,
  grounded: true,
  ...overrides,
});

describe('Stage 05 owner dribble feedback', () => {
  test('a sharp requested turn brakes the old ball vector and starts the new direction before the ball escapes', () => {
    const source = ball({ velocity: { x: 0, y: 0, z: 7.2 } });
    const touch = buildControlTouch({
      actor: actor({ velocity: { x: 0, y: 0, z: 7.4 }, sprinting: true }),
      ball: source,
      desiredDirection: { x: -1, z: 0 },
      precision: false,
      sprint: true,
      pressure: 0,
      moveIntentMagnitude: 1,
    });

    expect(touch.eligible).toBe(true);
    expect(touch.touchMode).toBe('effort-turn');
    expect(touch.command).toBeDefined();
    const next = applyBallContact(source, touch.command!);
    expect(next.velocity.z).toBeLessThan(4.2);
    expect(next.velocity.x).toBeLessThan(-0.4);
    expect(next.position).toEqual(source.position);
  });

  test('precision with no movement intent physically traps a moving ball instead of nudging it forward again', () => {
    const source = ball({ velocity: { x: 0.2, y: 0, z: 5.2 } });
    const touch = buildControlTouch({
      actor: actor({ velocity: { x: 0, y: 0, z: 0 } }),
      ball: source,
      desiredDirection: { x: 0, z: 1 },
      precision: true,
      sprint: false,
      pressure: 0,
      moveIntentMagnitude: 0,
    });

    expect(touch.eligible).toBe(true);
    expect(touch.touchMode).toBe('trap');
    const next = applyBallContact(source, touch.command!);
    expect(Math.hypot(next.velocity.x, next.velocity.z)).toBeLessThan(1.25);
  });

  test('straight sprint touches stay inside the calibrated recoverable envelope', () => {
    const playerSpeed = 8.4;
    const touch = buildControlTouch({
      actor: actor({ velocity: { x: 0, y: 0, z: playerSpeed }, sprinting: true }),
      ball: ball({ velocity: { x: 0, y: 0, z: 8.1 } }),
      desiredDirection: { x: 0, z: 1 },
      precision: false,
      sprint: true,
      pressure: 0,
      moveIntentMagnitude: 1,
    });

    expect(touch.eligible).toBe(true);
    expect(touch.touchMode).toBe('sprint');
    expect(touch.targetBallSpeed).toBeLessThanOrEqual(playerSpeed + 0.3);
    expect(touch.touchDistance).toBeLessThanOrEqual(1.0);
  });
});
