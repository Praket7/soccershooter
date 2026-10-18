import { describe, expect, test } from 'vitest';
import { buildControlTouch } from './controlEnvelope';
import { applyBallContact, type FootballActorSnapshot, type FootballBallSnapshot } from './types';

const actor = (overrides: Partial<FootballActorSnapshot> = {}): FootballActorSnapshot => ({
  position: { x: 0, y: 0, z: 0 },
  velocity: { x: 0, y: 0, z: 5.2 },
  facingYaw: 0,
  balance: 1,
  pressure: 0,
  sprinting: false,
  preferredFoot: 'right',
  ...overrides,
});

const ball = (overrides: Partial<FootballBallSnapshot> = {}): FootballBallSnapshot => ({
  position: { x: 0.03, y: 0.11, z: 0.56 },
  velocity: { x: 0, y: 0, z: 5.0 },
  angularVelocity: { x: 5.0 / 0.11, y: 0, z: 0 },
  radius: 0.11,
  mass: 0.436,
  grounded: true,
  ...overrides,
});

describe('beginner-friendly dribbling with a mastery ceiling', () => {
  test('clean jogging is intentionally forgiving and nearly error free', () => {
    const touch = buildControlTouch({
      actor: actor(),
      ball: ball(),
      desiredDirection: { x: 0, z: 1 },
      precision: false,
      sprint: false,
      pressure: 0,
      moveIntentMagnitude: 1,
    });

    expect(touch.eligible).toBe(true);
    expect(touch.touchMode).toBe('normal');
    expect(touch.touchDifficulty).toBeLessThan(0.12);
    expect(touch.touchErrorMagnitude).toBeLessThan(0.06);
  });

  test('straight sprint remains controllable instead of becoming a random heavy touch', () => {
    const touch = buildControlTouch({
      actor: actor({ velocity: { x: 0, y: 0, z: 8.2 }, sprinting: true, balance: 0.9 }),
      ball: ball({ position: { x: 0.05, y: 0.11, z: 0.8 }, velocity: { x: 0, y: 0, z: 8.0 } }),
      desiredDirection: { x: 0, z: 1 },
      precision: false,
      sprint: true,
      pressure: 0,
      moveIntentMagnitude: 1,
    });

    expect(touch.eligible).toBe(true);
    expect(touch.touchMode).toBe('sprint');
    expect(touch.touchDifficulty).toBeLessThan(0.22);
    expect(touch.touchErrorMagnitude).toBeLessThan(0.16);
  });

  test('a high-speed hard cut is measurably harder than a clean straight carry', () => {
    const easy = buildControlTouch({
      actor: actor(),
      ball: ball(),
      desiredDirection: { x: 0, z: 1 },
      precision: false,
      sprint: false,
      pressure: 0,
      moveIntentMagnitude: 1,
    });
    const hard = buildControlTouch({
      actor: actor({ velocity: { x: 0, y: 0, z: 8.2 }, sprinting: true, balance: 0.78 }),
      ball: ball({ position: { x: -0.12, y: 0.11, z: 0.84 }, velocity: { x: 0, y: 0, z: 8.0 } }),
      desiredDirection: { x: -1, z: 0 },
      precision: false,
      sprint: true,
      pressure: 0,
      moveIntentMagnitude: 1,
    });

    expect(hard.eligible).toBe(true);
    expect(hard.touchMode).toBe('effort-turn');
    expect(hard.touchDifficulty).toBeGreaterThan(easy.touchDifficulty + 0.22);
    expect(hard.touchErrorMagnitude).toBeGreaterThan(easy.touchErrorMagnitude);
  });

  test('pressure, imbalance, and a stretched ball can create a recoverable imperfect touch', () => {
    const source = ball({
      position: { x: 0.38, y: 0.11, z: 1.31 },
      velocity: { x: 0.35, y: 0, z: 6.0 },
    });
    const touch = buildControlTouch({
      actor: actor({ velocity: { x: 0, y: 0, z: 6.2 }, balance: 0.58, pressure: 0.82 }),
      ball: source,
      desiredDirection: { x: 0.7, z: 0.714142842854285 },
      precision: false,
      sprint: false,
      pressure: 0.82,
      moveIntentMagnitude: 1,
    });

    expect(touch.eligible).toBe(true);
    expect(touch.touchDifficulty).toBeGreaterThan(0.45);
    expect(touch.touchErrorMagnitude).toBeGreaterThan(0.08);
    expect(touch.touchErrorMagnitude).toBeLessThan(0.9);
    const next = applyBallContact(source, touch.command!);
    expect(next.position).toEqual(source.position);
  });

  test('RMB close control materially reduces the same difficult touch error', () => {
    const source = ball({
      position: { x: 0.26, y: 0.11, z: 1.0 },
      velocity: { x: 0.25, y: 0, z: 5.3 },
    });
    const baseInput = {
      actor: actor({ velocity: { x: 0, y: 0, z: 5.5 }, balance: 0.7, pressure: 0.62 }),
      ball: source,
      desiredDirection: { x: 0.6, z: 0.8 },
      sprint: false,
      pressure: 0.62,
      moveIntentMagnitude: 1,
    } as const;

    const normal = buildControlTouch({ ...baseInput, precision: false });
    const precision = buildControlTouch({ ...baseInput, precision: true });

    expect(normal.eligible).toBe(true);
    expect(precision.eligible).toBe(true);
    expect(precision.touchDifficulty).toBeLessThan(normal.touchDifficulty);
    expect(precision.touchErrorMagnitude).toBeLessThan(normal.touchErrorMagnitude * 0.7);
  });

  test('touch error is deterministic for the same simulation state', () => {
    const input = {
      actor: actor({ velocity: { x: 0.3, y: 0, z: 7.4 }, balance: 0.72, pressure: 0.55 }),
      ball: ball({ position: { x: 0.29, y: 0.11, z: 1.08 }, velocity: { x: 0.2, y: 0, z: 7.0 } }),
      desiredDirection: { x: -0.45, z: 0.8930285549745876 },
      precision: false,
      sprint: true,
      pressure: 0.55,
      moveIntentMagnitude: 1,
    } as const;

    expect(buildControlTouch(input)).toEqual(buildControlTouch(input));
  });
});
