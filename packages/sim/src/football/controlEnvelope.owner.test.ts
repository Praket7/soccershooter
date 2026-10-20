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
  test('a turning carry touch preserves its current foot side instead of steering through the centerline', () => {
    const touch = buildControlTouch({
      actor: actor({ velocity: { x: 0, y: 0, z: 5 } }),
      ball: ball({
        position: { x: 0, y: 0.11, z: 0.30 },
        velocity: { x: 0, y: 0, z: 4.8 },
      }),
      desiredDirection: { x: -0.5, z: Math.sqrt(0.75) },
      precision: false,
      sprint: false,
      pressure: 0,
      moveIntentMagnitude: 1,
    });

    expect(touch.eligible).toBe(true);
    const next = applyBallContact(ball({
      position: { x: 0, y: 0.11, z: 0.30 },
      velocity: { x: 0, y: 0, z: 4.8 },
    }), touch.command!);
    const direction = { x: -0.5, z: Math.sqrt(0.75) };
    const lateral = { x: direction.z, z: -direction.x };
    const targetOffset = {
      x: touch.targetPoint.x,
      z: touch.targetPoint.z,
    };
    expect(targetOffset.x * lateral.x + targetOffset.z * lateral.z).toBeGreaterThan(0.12);
    expect(targetOffset.x * direction.x + targetOffset.z * direction.z).toBeGreaterThan(0.43);
    const lateralSpeed = next.velocity.x * lateral.x + next.velocity.z * lateral.z;
    expect(lateralSpeed).toBeGreaterThan(-0.4);
  });

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

  test('ordinary jogging actively recenters a laterally drifting ball without adding a speed surplus', () => {
    const source = ball({
      position: { x: 0.42, y: 0.11, z: 0.68 },
      velocity: { x: 0.9, y: 0, z: 4.8 },
    });
    const playerSpeed = 5.2;
    const touch = buildControlTouch({
      actor: actor({ velocity: { x: 0, y: 0, z: playerSpeed } }),
      ball: source,
      desiredDirection: { x: 0, z: 1 },
      precision: false,
      sprint: false,
      pressure: 0,
      moveIntentMagnitude: 1,
    });

    expect(touch.eligible).toBe(true);
    expect(touch.touchMode).toBe('normal');
    expect(touch.targetBallSpeed).toBe(playerSpeed);
    const next = applyBallContact(source, touch.command!);
    expect(next.velocity.x).toBeLessThan(-0.15);
    expect(next.position).toEqual(source.position);
  });

  test('a correctly positioned normal dribble touch matches the jogging carrier speed', () => {
    const playerSpeed = 5.2;
    const source = ball({
      position: { x: 0.02, y: 0.11, z: 0.52 },
      velocity: { x: 0, y: 0, z: 4.7 },
    });
    const touch = buildControlTouch({
      actor: actor({ velocity: { x: 0, y: 0, z: playerSpeed } }),
      ball: source,
      desiredDirection: { x: 0, z: 1 },
      precision: false,
      sprint: false,
      pressure: 0,
      moveIntentMagnitude: 1,
    });

    expect(touch.eligible).toBe(true);
    expect(touch.targetBallSpeed).toBe(playerSpeed);
    const next = applyBallContact(source, touch.command!);
    expect(next.velocity.z).toBeLessThanOrEqual(playerSpeed);
  });

  test('competent normal dribbling gets one recovery touch before a modest stretch becomes a turnover', () => {
    const playerSpeed = 5.2;
    const source = ball({
      position: { x: 0.08, y: 0.11, z: 1.42 },
      velocity: { x: 0.15, y: 0, z: 5.6 },
    });
    const touch = buildControlTouch({
      actor: actor({ velocity: { x: 0, y: 0, z: playerSpeed } }),
      ball: source,
      desiredDirection: { x: 0, z: 1 },
      precision: false,
      sprint: false,
      pressure: 0,
      moveIntentMagnitude: 1,
    });

    expect(touch.eligible).toBe(true);
    expect(touch.touchMode).toBe('normal');
    const next = applyBallContact(source, touch.command!);
    expect(next.velocity.z).toBeLessThan(playerSpeed);
    expect(next.velocity.x).toBeLessThan(0);
  });

  test('explicit receive with no movement intent physically traps a moving ball', () => {
    const source = ball({ velocity: { x: 0.2, y: 0, z: 5.2 } });
    const touch = buildControlTouch({
      actor: actor({ velocity: { x: 0, y: 0, z: 0 } }),
      ball: source,
      desiredDirection: { x: 0, z: 1 },
      precision: false,
      sprint: false,
      pressure: 0,
      moveIntentMagnitude: 0,
      receiveMode: 'kill',
    });

    expect(touch.eligible).toBe(true);
    expect(touch.touchMode).toBe('trap');
    const next = applyBallContact(source, touch.command!);
    expect(Math.hypot(next.velocity.x, next.velocity.z)).toBeLessThan(1.25);
  });

  test('RMB precision by itself remains close-control dribble and does not secretly trap', () => {
    const touch = buildControlTouch({
      actor: actor({ velocity: { x: 0, y: 0, z: 1.5 } }),
      ball: ball({ velocity: { x: 0, y: 0, z: 2.1 } }),
      desiredDirection: { x: 0, z: 1 },
      precision: true,
      sprint: false,
      pressure: 0,
      moveIntentMagnitude: 0,
    });
    expect(touch.touchMode).toBe('precision');
  });

  test('controlled receive exits in the requested direction with a short touch', () => {
    const source = ball({ velocity: { x: 0, y: 0, z: 5.2 } });
    const touch = buildControlTouch({
      actor: actor({ velocity: { x: 0, y: 0, z: 0 } }),
      ball: source,
      desiredDirection: { x: -1, z: 0 },
      precision: false,
      sprint: false,
      pressure: 0,
      moveIntentMagnitude: 1,
      receiveMode: 'controlled-exit',
    });
    expect(touch.eligible).toBe(true);
    expect(touch.touchMode).toBe('receive-exit');
    const next = applyBallContact(source, touch.command!);
    expect(next.velocity.x).toBeLessThan(-0.25);
    expect(Math.abs(next.velocity.z)).toBeLessThan(2.5);
  });

  test('fresh sprint dribble matches carrier speed instead of adding a knock-on surplus', () => {
    const playerSpeed = 8.4;
    const touch = buildControlTouch({
      actor: actor({ velocity: { x: 0, y: 0, z: playerSpeed }, sprinting: true }),
      ball: ball({ position: { x: 0, y: 0.11, z: 0.72 }, velocity: { x: 0, y: 0, z: 8.1 } }),
      desiredDirection: { x: 0, z: 1 },
      precision: false,
      sprint: true,
      pressure: 0,
      moveIntentMagnitude: 1,
    });

    expect(touch.eligible).toBe(true);
    expect(touch.touchMode).toBe('sprint');
    expect(touch.targetBallSpeed).toBe(playerSpeed);
    expect(touch.touchDistance).toBeLessThanOrEqual(0.55);
  });

  test('sprint dribbling retains a long-stride recovery window and decisively slows an overextended ball', () => {
    const playerSpeed = 8.4;
    const source = ball({
      position: { x: 0.12, y: 0.11, z: 1.52 },
      velocity: { x: 0.2, y: 0, z: 9.0 },
    });
    const touch = buildControlTouch({
      actor: actor({ velocity: { x: 0, y: 0, z: playerSpeed }, sprinting: true }),
      ball: source,
      desiredDirection: { x: 0, z: 1 },
      precision: false,
      sprint: true,
      pressure: 0,
      moveIntentMagnitude: 1,
    });

    expect(touch.eligible).toBe(true);
    expect(touch.touchMode).toBe('sprint');
    const next = applyBallContact(source, touch.command!);
    expect(next.velocity.z).toBeLessThan(playerSpeed - 0.35);
    expect(next.velocity.x).toBeLessThan(0);
  });
});
