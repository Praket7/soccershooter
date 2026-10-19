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
  position: { x: 0, y: 0.11, z: 0.52 },
  velocity: { x: 0, y: 0, z: 4.7 },
  angularVelocity: { x: 0, y: 0, z: 0 },
  radius: 0.11,
  mass: 0.436,
  grounded: true,
  ...overrides,
});

describe('dribble touch rolling contact', () => {
  test('forward control touch creates the turf solver no-slip spin direction instead of artificial backspin', () => {
    const source = ball();
    const touch = buildControlTouch({
      actor: actor(),
      ball: source,
      desiredDirection: { x: 0, z: 1 },
      precision: false,
      sprint: false,
      pressure: 0,
      moveIntentMagnitude: 1,
    });

    expect(touch.eligible).toBe(true);
    expect(touch.command).toBeDefined();
    const next = applyBallContact(source, touch.command!);

    // groundContact.ts defines longitudinal slip as v.z - omega.x * radius.
    // A controlled forward touch should therefore create positive omega.x and
    // leave only modest slip for turf friction to dissipate.
    const longitudinalSlip = next.velocity.z - next.angularVelocity.x * next.radius;
    expect(next.angularVelocity.x).toBeGreaterThan(0);
    expect(Math.abs(longitudinalSlip)).toBeLessThan(Math.abs(next.velocity.z) * 0.2);
  });

  test('rightward control touch uses the matching negative z-axis rolling spin', () => {
    const source = ball({
      position: { x: 0.52, y: 0.11, z: 0 },
      velocity: { x: 4.7, y: 0, z: 0 },
    });
    const touch = buildControlTouch({
      actor: actor({ velocity: { x: 5.2, y: 0, z: 0 }, facingYaw: Math.PI / 2 }),
      ball: source,
      desiredDirection: { x: 1, z: 0 },
      precision: false,
      sprint: false,
      pressure: 0,
      moveIntentMagnitude: 1,
    });

    expect(touch.eligible).toBe(true);
    const next = applyBallContact(source, touch.command!);
    const lateralSlip = next.velocity.x + next.angularVelocity.z * next.radius;
    expect(next.angularVelocity.z).toBeLessThan(0);
    expect(Math.abs(lateralSlip)).toBeLessThan(Math.abs(next.velocity.x) * 0.2);
  });
});
