import { describe, expect, test } from 'vitest';
import { BALL_CONSTANTS } from '../../../physics/src/ball/BallState';
import { buildControlTouch } from './controlEnvelope';
import { applyBallContact, type FootballActorSnapshot, type FootballBallSnapshot } from './types';

const actor = (overrides: Partial<FootballActorSnapshot> = {}): FootballActorSnapshot => ({
  position: { x: 0, y: 0, z: 0 },
  velocity: { x: 0, y: 0, z: 4.6 },
  facingYaw: 0,
  balance: 1,
  pressure: 0,
  sprinting: false,
  preferredFoot: 'right',
  ...overrides,
});

const ball = (overrides: Partial<FootballBallSnapshot> = {}): FootballBallSnapshot => ({
  position: { x: 0, y: BALL_CONSTANTS.radius, z: 0.62 },
  velocity: { x: 0, y: 0, z: 4.4 },
  angularVelocity: { x: 4.4 / BALL_CONSTANTS.radius, y: 0, z: 0 },
  radius: BALL_CONSTANTS.radius,
  mass: BALL_CONSTANTS.mass,
  grounded: true,
  ...overrides,
});

function normalized(x: number, z: number) {
  const length = Math.hypot(x, z);
  return { x: x / length, z: z / length };
}

describe('professional dribble recovery boundaries', () => {
  test('active turn-back can physically pick up a nearby loose ball while body orientation catches up', () => {
    const source = ball({
      position: { x: -0.34, y: BALL_CONSTANTS.radius, z: -0.56 },
      velocity: { x: -0.2, y: 0, z: 0.35 },
      angularVelocity: { x: 0, y: 0, z: 0 },
    });
    const recoveryDirection = normalized(source.position.x, source.position.z);
    const touch = buildControlTouch({
      actor: actor(),
      ball: source,
      desiredDirection: recoveryDirection,
      precision: true,
      sprint: false,
      pressure: 0,
      moveIntentMagnitude: 1,
    });

    expect(touch.eligible).toBe(true);
    expect(touch.reason).toBe('ok');
    expect(touch.command).toBeDefined();
    const next = applyBallContact(source, touch.command!);
    expect(next.position).toEqual(source.position);
    expect(next.velocity.x * recoveryDirection.x + next.velocity.z * recoveryDirection.z).toBeGreaterThan(0.4);
  });

  test('a ball beyond the physical control radius stays genuinely dropped even when the player points at it', () => {
    const source = ball({
      position: { x: -0.55, y: BALL_CONSTANTS.radius, z: -1.58 },
      velocity: { x: 0, y: 0, z: 0 },
      angularVelocity: { x: 0, y: 0, z: 0 },
    });
    const recoveryDirection = normalized(source.position.x, source.position.z);
    const touch = buildControlTouch({
      actor: actor({ velocity: { x: 0, y: 0, z: 2.8 } }),
      ball: source,
      desiredDirection: recoveryDirection,
      precision: false,
      sprint: false,
      pressure: 0,
      moveIntentMagnitude: 1,
    });

    expect(touch.eligible).toBe(false);
    expect(touch.reason).toBe('out-of-reach');
    expect(touch.command).toBeUndefined();
  });

  test('pressure creates meaningful deterministic error without turning one touch into a random launch', () => {
    const source = ball({ position: { x: 0.15, y: BALL_CONSTANTS.radius, z: 0.64 } });
    const clean = buildControlTouch({
      actor: actor(),
      ball: source,
      desiredDirection: { x: 0, z: 1 },
      precision: false,
      sprint: false,
      pressure: 0,
      moveIntentMagnitude: 1,
    });
    const pressured = buildControlTouch({
      actor: actor({ balance: 0.82, pressure: 0.78 }),
      ball: source,
      desiredDirection: { x: 0, z: 1 },
      precision: false,
      sprint: false,
      pressure: 0.78,
      moveIntentMagnitude: 1,
    });

    expect(clean.eligible).toBe(true);
    expect(pressured.eligible).toBe(true);
    expect(pressured.touchErrorMagnitude).toBeGreaterThan(clean.touchErrorMagnitude + 0.03);
    expect(pressured.touchErrorMagnitude).toBeLessThan(0.55);
    const next = applyBallContact(source, pressured.command!);
    expect(Math.hypot(next.velocity.x, next.velocity.z)).toBeLessThan(6.2);
  });
});
