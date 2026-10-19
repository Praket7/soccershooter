import { describe, expect, test } from 'vitest';
import { STANDARD_GOAL_FRAME } from '@soccershooter/physics/ball/trajectory';
import { createPlayerState } from '@soccershooter/sim/player/PlayerState';
import {
  buildPracticeGoalCameraObstacles,
  resolveBallAwareCameraFocus,
} from './FootballPracticeCamera';
import { ThirdPersonCamera } from './ThirdPersonCamera';

describe('Stage 05 Football Practice camera integration', () => {
  test('production manual-aim wiring keeps the player anchor stable while the free ball moves', () => {
    const displayPlayer = createPlayerState({ position: { x: 0, y: 0, z: 0 } });
    const focus = resolveBallAwareCameraFocus(displayPlayer.position, { x: 4, y: 0.11, z: 0.5 }, true);
    const cameraPlayer = createPlayerState({ ...displayPlayer, position: focus });
    const camera = new ThirdPersonCamera();
    const snapshot = camera.update(
      cameraPlayer,
      { yawDelta: 0, pitchDelta: 0 },
      1 / 60,
      buildPracticeGoalCameraObstacles(STANDARD_GOAL_FRAME),
      0,
    );

    expect(focus).toEqual(displayPlayer.position);
    expect(snapshot.target.x).toBeCloseTo(0, 6);
  });

  test('passive framing can still bias toward a loose ball when manual aim is not active', () => {
    const displayPlayer = createPlayerState({ position: { x: 0, y: 0, z: 0 } });
    const focus = resolveBallAwareCameraFocus(displayPlayer.position, { x: 4, y: 0.11, z: 0.5 }, false);
    expect(focus.x).toBeGreaterThan(0.45);
    expect(focus.x).toBeLessThanOrEqual(0.9);
    expect(focus.x).toBeLessThan(4);
  });

  test('production-style wiring collides with the visible opposite goal instead of clipping through its post', () => {
    const displayPlayer = createPlayerState({ position: { x: 3.66, y: 0, z: -13 } });
    const focus = resolveBallAwareCameraFocus(displayPlayer.position, { x: 3.66, y: 0.11, z: -13 }, true);
    const cameraPlayer = createPlayerState({ ...displayPlayer, position: focus });
    const camera = new ThirdPersonCamera();
    const snapshot = camera.update(
      cameraPlayer,
      { yawDelta: 0, pitchDelta: 0 },
      1 / 60,
      buildPracticeGoalCameraObstacles(STANDARD_GOAL_FRAME),
      0,
    );

    expect(snapshot.collision.active).toBe(true);
    expect(snapshot.collision.obstacleId).toBe('opposite-goal-right-post');
    expect(snapshot.armLength).toBeLessThan(snapshot.userDistance);
  });
});
