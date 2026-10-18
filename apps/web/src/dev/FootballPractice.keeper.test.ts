import { describe, expect, test } from 'vitest';
import { BALL_CONSTANTS, createBallState } from '@soccershooter/physics/ball/BallState';
import { evaluateKeeperPlaneCrossing } from './FootballPractice';

describe('Stage 05 greybox keeper swept-plane timing', () => {
  test('evaluates lateral reach at the exact keeper-plane crossing instead of the end of the 120 Hz step', () => {
    const previous = createBallState({
      position: { x: 0.66, y: 1.0, z: 11.20 },
      velocity: { x: 12, y: 0, z: 24 },
      grounded: false,
    });
    const current = createBallState({
      position: { x: 0.76, y: 1.0, z: 11.40 },
      velocity: { x: 12, y: 0, z: 24 },
      grounded: false,
    });

    const crossing = evaluateKeeperPlaneCrossing(previous, current, 11.28, 0, 0.72, 2.18);

    expect(crossing).not.toBeNull();
    expect(crossing?.fraction).toBeCloseTo(0.4, 8);
    expect(crossing?.position.x).toBeCloseTo(0.70, 8);
    expect(Math.abs(current.position.x)).toBeGreaterThan(0.72);
    expect(Math.abs(crossing?.position.x ?? 999)).toBeLessThanOrEqual(0.72);
  });

  test('does not count a save when the exact crossing is outside reach even if the step endpoint is inside', () => {
    const previous = createBallState({
      position: { x: 0.78, y: BALL_CONSTANTS.radius + 0.6, z: 11.20 },
      velocity: { x: -12, y: 0, z: 24 },
      grounded: false,
    });
    const current = createBallState({
      position: { x: 0.68, y: BALL_CONSTANTS.radius + 0.6, z: 11.40 },
      velocity: { x: -12, y: 0, z: 24 },
      grounded: false,
    });

    const crossing = evaluateKeeperPlaneCrossing(previous, current, 11.28, 0, 0.72, 2.18);

    expect(crossing).toBeNull();
    expect(Math.abs(current.position.x)).toBeLessThanOrEqual(0.72);
  });
});
