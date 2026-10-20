import { describe, expect, test } from 'vitest';
import { BALL_CONSTANTS } from '../../../physics/src/ball/BallState';
import { buildControlTouch } from './controlEnvelope';
import { applyBallContact, type FootballActorSnapshot, type FootballBallSnapshot } from './types';

/**
 * `buildControlTouch` is the legacy direct-touch helper. Multi-frame sprint-cut
 * behavior is now owned by the Stage 05R planned-contact path and is covered in
 * dribbleTurn.integration.test.ts / dribbleCarry.integration.test.ts. Keep this
 * file focused on invariants the compatibility helper still owns instead of
 * forcing modern player movement to satisfy its obsolete instant-touch loop.
 */
describe('legacy direct-touch compatibility invariants', () => {
  test('a perfectly centered clean carry does not invent sideways touch jitter', () => {
    const actor: FootballActorSnapshot = {
      position: { x: 0, y: 0, z: 0 },
      velocity: { x: 0, y: 0, z: 5.2 },
      facingYaw: 0,
      balance: 1,
      pressure: 0,
      sprinting: false,
      preferredFoot: 'right',
    };
    const source: FootballBallSnapshot = {
      position: { x: 0, y: BALL_CONSTANTS.radius, z: 0.52 },
      velocity: { x: 0, y: 0, z: 5 },
      angularVelocity: { x: 5 / BALL_CONSTANTS.radius, y: 0, z: 0 },
      radius: BALL_CONSTANTS.radius,
      mass: BALL_CONSTANTS.mass,
      grounded: true,
    };
    const touch = buildControlTouch({
      actor,
      ball: source,
      desiredDirection: { x: 0, z: 1 },
      precision: false,
      sprint: false,
      pressure: 0,
      moveIntentMagnitude: 1,
    });
    expect(touch.eligible).toBe(true);
    const next = applyBallContact(source, touch.command!);
    expect(Math.abs(next.velocity.x)).toBeLessThan(0.001);
  });

  test('the first full-sprint 90 degree effort touch bends the ball instead of snapping almost sideways', () => {
    const actor: FootballActorSnapshot = {
      position: { x: 0, y: 0, z: 0 },
      velocity: { x: 0, y: 0, z: 7.4 },
      facingYaw: 0,
      balance: 1,
      pressure: 0,
      sprinting: true,
      preferredFoot: 'right',
    };
    const source: FootballBallSnapshot = {
      position: { x: 0, y: BALL_CONSTANTS.radius, z: 0.78 },
      velocity: { x: 0, y: 0, z: 7.2 },
      angularVelocity: { x: 7.2 / BALL_CONSTANTS.radius, y: 0, z: 0 },
      radius: BALL_CONSTANTS.radius,
      mass: BALL_CONSTANTS.mass,
      grounded: true,
    };
    const touch = buildControlTouch({
      actor,
      ball: source,
      desiredDirection: { x: -1, z: 0 },
      precision: false,
      sprint: true,
      pressure: 0,
      moveIntentMagnitude: 1,
    });
    expect(touch.eligible).toBe(true);
    expect(touch.touchMode).toBe('effort-turn');
    const next = applyBallContact(source, touch.command!);
    const deflectionDegrees = Math.atan2(Math.abs(next.velocity.x), Math.max(0.001, next.velocity.z)) * 180 / Math.PI;
    expect(deflectionDegrees).toBeGreaterThan(20);
    expect(deflectionDegrees).toBeLessThan(66);
  });
});
