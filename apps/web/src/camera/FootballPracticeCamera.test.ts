import { describe, expect, test } from 'vitest';
import { STANDARD_GOAL_FRAME } from '@soccershooter/physics/ball/trajectory';
import {
  buildPracticeGoalCameraObstacles,
  resolveBallAwareCameraFocus,
} from './FootballPracticeCamera';

describe('Stage 05 owner camera feedback', () => {
  test('ball-aware focus keeps the player primary while biasing toward a loose lateral ball', () => {
    const focus = resolveBallAwareCameraFocus(
      { x: 0, y: 0, z: 0 },
      { x: 4, y: 0.11, z: 0.5 },
    );
    expect(focus.x).toBeGreaterThan(0.45);
    expect(focus.x).toBeLessThanOrEqual(0.9);
    expect(Math.abs(focus.z)).toBeLessThan(0.2);
    expect(focus.y).toBe(0);
  });

  test('camera focus bias is capped even when the ball has escaped far away', () => {
    const focus = resolveBallAwareCameraFocus(
      { x: 2, y: 0, z: -4 },
      { x: 20, y: 0.11, z: 12 },
    );
    expect(Math.hypot(focus.x - 2, focus.z + 4)).toBeLessThanOrEqual(0.900001);
  });

  test('both visible goal frames become camera collision obstacles for posts and bars', () => {
    const obstacles = buildPracticeGoalCameraObstacles(STANDARD_GOAL_FRAME, -15.2);
    expect(obstacles).toHaveLength(6);
    expect(obstacles.map((item) => item.id)).toEqual([
      'practice-goal-left-post',
      'practice-goal-right-post',
      'practice-goal-crossbar',
      'opposite-goal-left-post',
      'opposite-goal-right-post',
      'opposite-goal-crossbar',
    ]);
    for (const obstacle of obstacles) {
      expect(obstacle.maxX).toBeGreaterThan(obstacle.minX);
      expect(obstacle.maxY).toBeGreaterThan(obstacle.minY);
      expect(obstacle.maxZ).toBeGreaterThan(obstacle.minZ);
    }
  });
});
