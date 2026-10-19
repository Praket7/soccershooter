import { describe, expect, test } from 'vitest';
import { BALL_CONSTANTS } from '../../../packages/physics/src/ball/BallState';
import { STANDARD_GOAL_FRAME } from '../../../packages/physics/src/ball/trajectory';
import { createPlayerState } from '../../../packages/sim/src/player/PlayerState';
import { PLAYER_VISUAL_LAYOUT, playerVisualFootY } from './presentation/PlayerVisualLayout';
import { resolveBallAwareCameraFocus } from './camera/FootballPracticeCamera';
import { ThirdPersonCamera, type CameraSnapshot } from './camera/ThirdPersonCamera';
import { intersectAimRayWithPlaneZ } from './input/WorldAim';

const DT = 1 / 60;

function cameraForward(snapshot: Readonly<CameraSnapshot>) {
  const dx = snapshot.target.x - snapshot.position.x;
  const dy = snapshot.target.y - snapshot.position.y;
  const dz = snapshot.target.z - snapshot.position.z;
  const length = Math.hypot(dx, dy, dz);
  return { x: dx / length, y: dy / length, z: dz / length };
}

function settleCamera(camera: ThirdPersonCamera, position: { x: number; y: number; z: number }, frames = 90): CameraSnapshot {
  const player = createPlayerState({ position });
  let snapshot = camera.update(player, { yawDelta: 0, pitchDelta: 0 }, DT, [], 0);
  for (let frame = 1; frame < frames; frame += 1) {
    snapshot = camera.update(player, { yawDelta: 0, pitchDelta: 0 }, DT, [], 0);
  }
  return snapshot;
}

describe('Stage 05 final owner-feel regressions', () => {
  test('loose-ball framing cannot translate the center-reticle world target while the user gives no look input', () => {
    const player = createPlayerState({ position: { x: 0, y: 0, z: -13 } });
    const camera = new ThirdPersonCamera();

    const centeredFocus = resolveBallAwareCameraFocus(player.position, { x: 0, y: BALL_CONSTANTS.radius, z: -12.3 });
    const centered = settleCamera(camera, centeredFocus);
    const centeredHit = intersectAimRayWithPlaneZ(centered.position, cameraForward(centered), STANDARD_GOAL_FRAME.planeZ);
    expect(centeredHit).not.toBeNull();

    const looseFocus = resolveBallAwareCameraFocus(player.position, { x: 5.5, y: BALL_CONSTANTS.radius, z: -11.5 });
    const loose = settleCamera(camera, looseFocus, 150);
    const looseHit = intersectAimRayWithPlaneZ(loose.position, cameraForward(loose), STANDARD_GOAL_FRAME.planeZ);
    expect(looseHit).not.toBeNull();

    expect(Math.abs((looseHit?.x ?? 0) - (centeredHit?.x ?? 0))).toBeLessThan(0.08);
  });

  test('the visible torso leaves a real foot zone instead of occupying the ball-control pocket', () => {
    const torsoBottom = PLAYER_VISUAL_LAYOUT.torsoCenterY - PLAYER_VISUAL_LAYOUT.torsoHeight / 2;
    expect(torsoBottom).toBeGreaterThanOrEqual(0.5);
    expect(playerVisualFootY(0)).toBeCloseTo(0, 6);
  });
});
