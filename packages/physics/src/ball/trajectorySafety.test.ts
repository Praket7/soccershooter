import { describe, expect, test } from 'vitest';
import { BALL_CONSTANTS, createBallState, kineticEnergy } from './BallState';
import { BALL_SUBSTEP_DT, STANDARD_GOAL_FRAME, crossedGoalPlane, stepBall } from './trajectory';

describe('Stage 04 goal geometry and continuous collision safety', () => {
  test('goal-plane crossing requires the whole ball to be inside the scoring aperture', () => {
    const previous = createBallState({ position: { x: 0, y: 1, z: STANDARD_GOAL_FRAME.planeZ - 0.2 } });
    const scored = createBallState({ position: { x: 0, y: 1, z: STANDARD_GOAL_FRAME.planeZ + 0.2 } });

    const widePrevious = createBallState({
      position: { x: STANDARD_GOAL_FRAME.halfWidth, y: 1, z: STANDARD_GOAL_FRAME.planeZ - 0.2 },
    });
    const wide = createBallState({
      position: { x: STANDARD_GOAL_FRAME.halfWidth, y: 1, z: STANDARD_GOAL_FRAME.planeZ + 0.2 },
    });

    const highPrevious = createBallState({
      position: { x: 0, y: STANDARD_GOAL_FRAME.height, z: STANDARD_GOAL_FRAME.planeZ - 0.2 },
    });
    const high = createBallState({
      position: { x: 0, y: STANDARD_GOAL_FRAME.height, z: STANDARD_GOAL_FRAME.planeZ + 0.2 },
    });

    expect(crossedGoalPlane(previous, scored)).toBe(true);
    expect(crossedGoalPlane(widePrevious, wide)).toBe(false);
    expect(crossedGoalPlane(highPrevious, high)).toBe(false);
  });

  test('a legal high-speed shot cannot tunnel through a post in one 120 Hz substep', () => {
    const incoming = createBallState({
      position: { x: STANDARD_GOAL_FRAME.halfWidth - 0.02, y: 1.15, z: STANDARD_GOAL_FRAME.planeZ - 0.22 },
      velocity: { x: 0, y: 0, z: 42 },
      angularVelocity: { x: 0, y: 30, z: 0 },
    });
    const beforeEnergy = kineticEnergy(incoming);
    const after = stepBall(incoming, BALL_SUBSTEP_DT, undefined, STANDARD_GOAL_FRAME);
    expect(after.lastContact?.kind).toBe('goal-frame');
    expect(after.velocity.z).toBeLessThan(0);
    expect(kineticEnergy(after)).toBeLessThanOrEqual(beforeEnergy * 1.000001);
    expect(Math.abs(after.position.x - STANDARD_GOAL_FRAME.halfWidth)).toBeLessThan(BALL_CONSTANTS.radius + STANDARD_GOAL_FRAME.postRadius + 0.02);
  });

  test('a swept goal-frame impact still consumes exactly one fixed physics step', () => {
    const incoming = createBallState({
      position: { x: STANDARD_GOAL_FRAME.halfWidth - 0.02, y: 1.15, z: STANDARD_GOAL_FRAME.planeZ - 0.22 },
      velocity: { x: 0, y: 0, z: 42 },
      angularVelocity: { x: 0, y: 30, z: 0 },
      flightSeconds: 1.25,
    });
    const after = stepBall(incoming, BALL_SUBSTEP_DT, undefined, STANDARD_GOAL_FRAME);
    expect(after.lastContact?.kind).toBe('goal-frame');
    expect(after.flightSeconds).toBeCloseTo(incoming.flightSeconds + BALL_SUBSTEP_DT, 12);
  });

  test('a fast rolling ball still experiences aerodynamic drag while grounded', () => {
    let ball = createBallState({
      position: { x: 0, y: BALL_CONSTANTS.radius, z: 0 },
      velocity: { x: 0, y: 0, z: 20 },
      angularVelocity: { x: 20 / BALL_CONSTANTS.radius, y: 0, z: 0 },
      grounded: true,
    });

    for (let step = 0; step < 120; step += 1) {
      ball = stepBall(ball, BALL_SUBSTEP_DT);
    }

    expect(ball.grounded).toBe(true);
    expect(Math.hypot(ball.velocity.x, ball.velocity.z)).toBeLessThan(18);
  });
});