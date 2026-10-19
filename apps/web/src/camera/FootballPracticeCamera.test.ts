import { describe, expect, test } from 'vitest';
import { STANDARD_GOAL_FRAME } from '@soccershooter/physics/ball/trajectory';
import {
  buildPracticeGoalCameraObstacles,
  resolveBallAwareCameraFocus,
} from './FootballPracticeCamera';

describe('Stage 05 owner camera feedback', () => {
  test('manual reticle aim keeps the player as the exact camera anchor even when the ball is loose', () => {
    const player = { x: 1.2, y: 0, z: -3.4 };
    const focus = resolveBallAwareCameraFocus(
      player,
      { x: 6, y: 0.11, z: 1.5 },
      true,
    );
    expect(focus).toEqual(player);
  });

  test('passive ball-aware framing keeps the player primary while biasing toward a loose lateral ball', () => {
    const focus = resolveBallAwareCameraFocus(
      { x: 0, y: 0, z: 0 },
      { x: 4, y: 0.11, z: 0.5 },
      false,
    );
    expect(focus.x).toBeGreaterThan(0.45);
    expect(focus.x).toBeLessThanOrEqual(0.9);
    expect(Math.abs(focus.z)).toBeLessThan(0.2);
    expect(focus.y).toBe(0);
  });

  test('passive camera focus bias is capped even when the ball has escaped far away', () => {
    const focus = resolveBallAwareCameraFocus(
      { x: 2, y: 0, z: -4 },
      { x: 20, y: 0.11, z: 12 },
      false,
    );
    expect(Math.hypot(focus.x - 2, focus.z + 4)).toBeLessThanOrEqual(0.900001);
  });

  test('passive framing anticipates the near path and contact point within a bounded offset', () => {
    const player = { x: 0, y: 0, z: 0 };
    const focus = resolveBallAwareCameraFocus(player, { x: 0.4, y: 0.11, z: 0.5 }, false, {
      velocity: { x: 4, z: 0 },
      trajectory: [{ position: { x: 0.8, z: 0.2 } }, { position: { x: 1.4, z: 0.5 } }],
      contactPoint: { x: 0.2, z: 1.4 },
      plantDemand: 0.8,
      actionPreparation: true,
    });
    expect(focus.x).toBeGreaterThan(0.3);
    expect(focus.z).toBeGreaterThan(0.3);
    expect(Math.hypot(focus.x, focus.z)).toBeLessThanOrEqual(1.680001);
  });

  test('manual reticle framing ignores every football context signal', () => {
    const player = { x: 0.3, y: 0, z: -1 };
    expect(resolveBallAwareCameraFocus(player, { x: 8, y: 0.1, z: 6 }, true, {
      velocity: { x: 9, z: 8 },
      contactPoint: { x: -12, z: 14 },
      plantDemand: 1,
      actionPreparation: true,
    })).toEqual(player);
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
