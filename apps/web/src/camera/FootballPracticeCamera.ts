import type { GoalFrame } from '@soccershooter/physics/ball/trajectory';
import type { Vec3 } from '@soccershooter/sim/player/PlayerState';
import type { CameraObstacle } from './ThirdPersonCamera';

const MAX_BALL_FOCUS_BIAS = 0.9;
const BALL_FOCUS_DEADZONE = 0.9;
const BALL_FOCUS_GAIN = 0.32;
const GOAL_CAMERA_PADDING = 0.08;

export const OPPOSITE_PRACTICE_GOAL_PLANE_Z = -15.2;

/**
 * Keeps the player as the camera anchor while adding a capped look bias toward
 * a loose ball. The ball never drives locomotion or possession; this is purely
 * presentation so the owner can read where the free ball went during cuts.
 */
export function resolveBallAwareCameraFocus(
  playerPosition: Readonly<Vec3>,
  ballPosition: Readonly<Vec3>,
): Vec3 {
  const dx = ballPosition.x - playerPosition.x;
  const dz = ballPosition.z - playerPosition.z;
  const distance = Math.hypot(dx, dz);
  if (distance <= BALL_FOCUS_DEADZONE || distance <= 1e-9) {
    return { x: playerPosition.x, y: playerPosition.y, z: playerPosition.z };
  }

  const bias = Math.min(
    MAX_BALL_FOCUS_BIAS,
    (distance - BALL_FOCUS_DEADZONE) * BALL_FOCUS_GAIN,
  );
  return {
    x: playerPosition.x + dx / distance * bias,
    y: playerPosition.y,
    z: playerPosition.z + dz / distance * bias,
  };
}

function goalMembers(
  prefix: 'practice-goal' | 'opposite-goal',
  frame: Readonly<GoalFrame>,
  planeZ: number,
): CameraObstacle[] {
  const r = frame.postRadius + GOAL_CAMERA_PADDING;
  const post = (side: 'left' | 'right', x: number): CameraObstacle => ({
    id: `${prefix}-${side}-post`,
    minX: x - r,
    maxX: x + r,
    minY: 0,
    maxY: frame.height + r,
    minZ: planeZ - r,
    maxZ: planeZ + r,
  });
  return [
    post('left', -frame.halfWidth),
    post('right', frame.halfWidth),
    {
      id: `${prefix}-crossbar`,
      minX: -frame.halfWidth - r,
      maxX: frame.halfWidth + r,
      minY: frame.height - r,
      maxY: frame.height + r,
      minZ: planeZ - r,
      maxZ: planeZ + r,
    },
  ];
}

/** Camera collision geometry for both greybox goals visible in Football Practice. */
export function buildPracticeGoalCameraObstacles(
  frame: Readonly<GoalFrame>,
  oppositeGoalPlaneZ = OPPOSITE_PRACTICE_GOAL_PLANE_Z,
): CameraObstacle[] {
  return [
    ...goalMembers('practice-goal', frame, frame.planeZ),
    ...goalMembers('opposite-goal', frame, oppositeGoalPlaneZ),
  ];
}
