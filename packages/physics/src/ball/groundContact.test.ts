import { describe, expect, test } from 'vitest';
import { BALL_CONSTANTS, createBallState, kineticEnergy } from './BallState';
import { MATCH_BALL_PROFILE } from './aerodynamics';
import { resolveGroundContact } from './groundContact';
import { simulateBall } from './trajectory';

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

  test('match turf rebound from a 2 m FIFA-style drop stays inside the professional surface envelope', () => {
    const drop = createBallState({
      // FIFA measures release height from the underside of the ball.
      position: { x: 0, y: 2 + BALL_CONSTANTS.radius, z: 0 },
      velocity: { x: 0, y: 0, z: 0 },
    });
    const trace = simulateBall(drop, { seconds: 3, profile: MATCH_BALL_PROFILE });
    let contacted = false;
    let reboundUnderside = 0;
    for (const sample of trace.samples) {
      if (!contacted && sample.state.lastContact?.kind === 'ground') contacted = true;
      else if (contacted) reboundUnderside = Math.max(reboundUnderside, sample.state.position.y - BALL_CONSTANTS.radius);
    }
    expect(reboundUnderside).toBeGreaterThanOrEqual(0.60);
    expect(reboundUnderside).toBeLessThanOrEqual(0.85);
  });

  test('match turf ball roll from a 1 m FIFA-style ramp stays inside the professional surface envelope', () => {
    // A thin-shell ball rolling without slip converts mgh into translation plus
    // rotation. This is the ideal ramp-exit speed for the same 1 m release
    // height used by the FIFA ball-roll apparatus, before surface deceleration.
    const inertiaRatio = BALL_CONSTANTS.momentOfInertia / (BALL_CONSTANTS.mass * BALL_CONSTANTS.radius ** 2);
    const rampExitSpeed = Math.sqrt(2 * BALL_CONSTANTS.gravity * 1 / (1 + inertiaRatio));
    const ball = createBallState({
      position: { x: 0, y: BALL_CONSTANTS.radius, z: 0 },
      velocity: { x: 0, y: 0, z: rampExitSpeed },
      angularVelocity: { x: rampExitSpeed / BALL_CONSTANTS.radius, y: 0, z: 0 },
      grounded: true,
    });
    const trace = simulateBall(ball, { seconds: 15, profile: MATCH_BALL_PROFILE });
    const settled = trace.samples.find((sample) => Math.hypot(sample.state.velocity.x, sample.state.velocity.z) < 0.05);
    expect(settled).toBeDefined();
    const rollDistance = settled!.state.position.z;
    expect(rollDistance).toBeGreaterThanOrEqual(4);
    expect(rollDistance).toBeLessThanOrEqual(8);
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