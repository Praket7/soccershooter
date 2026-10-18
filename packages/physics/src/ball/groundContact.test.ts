import { describe, expect, test } from 'vitest';
import { BALL_CONSTANTS, createBallState, kineticEnergy } from './BallState';
import { MATCH_BALL_PROFILE } from './aerodynamics';
import { resolveGroundContact } from './groundContact';

describe('Stage 04 turf contact', () => {
  test('a downward impact bounces without penetration or energy gain', () => {
    const before = createBallState({
      position: { x: 0, y: BALL_CONSTANTS.radius - 0.01, z: 0 },
      velocity: { x: 4, y: -8, z: 6 },
      angularVelocity: { x: 8, y: 1, z: -4 },
    });
    const beforeEnergy = kineticEnergy(before);
    const after = resolveGroundContact(before, 1 / 120, MATCH_BALL_PROFILE);
    expect(after.position.y).toBeGreaterThanOrEqual(BALL_CONSTANTS.radius);
    expect(after.velocity.y).toBeGreaterThan(0);
    expect(kineticEnergy(after)).toBeLessThan(beforeEnergy);
  });

  test('rolling resistance monotonically slows a rolling ball and settles it', () => {
    let ball = createBallState({
      position: { x: 0, y: BALL_CONSTANTS.radius, z: 0 },
      velocity: { x: 0, y: 0, z: 4 },
      angularVelocity: { x: 4 / BALL_CONSTANTS.radius, y: 0, z: 0 },
      grounded: true,
    });
    let lastSpeed = Math.hypot(ball.velocity.x, ball.velocity.z);
    for (let i = 0; i < 2400; i += 1) {
      ball = resolveGroundContact(ball, 1 / 120, MATCH_BALL_PROFILE);
      const speed = Math.hypot(ball.velocity.x, ball.velocity.z);
      expect(speed).toBeLessThanOrEqual(lastSpeed + 1e-10);
      lastSpeed = speed;
    }
    expect(lastSpeed).toBeLessThan(0.08);
  });

  test('turf friction couples sliding translation toward the rolling no-slip relation', () => {
    const ball = createBallState({
      position: { x: 0, y: BALL_CONSTANTS.radius, z: 0 },
      velocity: { x: 0, y: -0.2, z: 8 },
      angularVelocity: { x: 0, y: 0, z: 0 },
    });
    const beforeSlip = 8;
    const after = resolveGroundContact(ball, 1 / 120, MATCH_BALL_PROFILE);
    const contactSlip = Math.abs(after.velocity.z - after.angularVelocity.x * BALL_CONSTANTS.radius);
    expect(contactSlip).toBeLessThan(beforeSlip);
  });

  test('sliding-to-rolling coupling never creates kinetic energy on the turf', () => {
    let ball = createBallState({
      position: { x: 0, y: BALL_CONSTANTS.radius, z: 0 },
      velocity: { x: 0, y: 0, z: 20 },
      angularVelocity: { x: 0, y: 0, z: 0 },
      grounded: true,
    });
    let previousEnergy = kineticEnergy(ball);

    for (let step = 0; step < 240; step += 1) {
      ball = resolveGroundContact(ball, 1 / 120, MATCH_BALL_PROFILE);
      const energy = kineticEnergy(ball);
      expect(energy).toBeLessThanOrEqual(previousEnergy + 1e-8);
      previousEnergy = energy;
    }
  });
});