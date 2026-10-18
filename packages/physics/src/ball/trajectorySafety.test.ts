import { describe, expect, test } from 'vitest';
import { BALL_CONSTANTS, createBallState, kineticEnergy } from './BallState';
import { BALL_SUBSTEP_DT, STANDARD_GOAL_FRAME, crossedGoalPlane, stepBall } from './trajectory';

describe('Stage 04 goal geometry and continuous collision safety', () => {
  test('goal-plane crossing requires the whole ball to be inside the scoring aperture', () => {
    const previous = createBallState({ position: { x: 0, y: 1, z: STANDARD_GOAL_FRAME.planeZ - 0.2 } });
    const scored = createBallState({ position: { x: 0, y: 1, z: STANDARD_GOAL_FRAME.planeZ + 0.2 } });
    const wide = createBallState({ position: { x: STANDARD_GOAL_FRAME.halfWidth, y: 1, z: STANDARD_GOAL_FRAME.planeZ + 0.2 } });
    const high = createBallState({ position: { x: 0, y: STANDARD_GOAL_FRAME.height, z: STANDARD_GOAL_FRAME.planeZ + 0.2 } });
    expect(crossedGoalPlane(previous, scored)).toBe(true);
    expect(crossedGoalPlane(previous, wide)).toBe(false);
    expect(crossedGoalPlane(previous, high)).toBe(false);
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
});
