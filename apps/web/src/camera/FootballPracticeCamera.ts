import type { GoalFrame } from '@soccershooter/physics/ball/trajectory';
import type { Vec3 } from '@soccershooter/sim/player/PlayerState';
import type { CameraObstacle } from './ThirdPersonCamera';

const MAX_BALL_FOCUS_BIAS = 0.9;
const BALL_FOCUS_DEADZONE = 0.9;
const BALL_FOCUS_GAIN = 0.32;
const GOAL_CAMERA_PADDING = 0.08;

export interface FootballCameraContext {
  velocity?: { x: number; z: number };
  trajectory?: readonly { position: { x: number; z: number } }[];
  contactPoint?: { x: number; z: number } | null;
  plantDemand?: number;
  actionPreparation?: boolean;
  contactResolved?: boolean;
}

export const OPPOSITE_PRACTICE_GOAL_PLANE_Z = -15.2;

/**
 * Keeps the player as the camera anchor while optionally adding a capped look
 * bias toward a loose ball. Manual center-reticle aim is authoritative: while
 * the player is in camera-control/aim mode, free-ball presentation is not
 * allowed to translate the camera anchor underneath a stationary reticle.
 *
 * Passive framing is still available for uncaptured/spectator-style views.
 * This preserves ball awareness without making live aim drift as the ball moves.
 */
export function resolveBallAwareCameraFocus(
  playerPosition: Readonly<Vec3>,
  ballPosition: Readonly<Vec3>,
  manualAimActive = true,
  context: Readonly<FootballCameraContext> = {},
): Vec3 {
  if (manualAimActive) {
    return { x: playerPosition.x, y: playerPosition.y, z: playerPosition.z };
  }

  const target = { x: playerPosition.x, z: playerPosition.z };
  const addCappedBias = (point: { x: number; z: number }, weight: number, cap: number): void => {
    const dx = point.x - playerPosition.x;
    const dz = point.z - playerPosition.z;
    const distance = Math.hypot(dx, dz);
    if (distance <= 1e-9) return;
    const amount = Math.min(cap, distance * weight);
    target.x += dx / distance * amount;
    target.z += dz / distance * amount;
  };

  const ballDx = ballPosition.x - playerPosition.x;
  const ballDz = ballPosition.z - playerPosition.z;
  const ballDistance = Math.hypot(ballDx, ballDz);
  if (ballDistance > BALL_FOCUS_DEADZONE) {
    const amount = Math.min(MAX_BALL_FOCUS_BIAS, (ballDistance - BALL_FOCUS_DEADZONE) * BALL_FOCUS_GAIN);
    target.x += ballDx / ballDistance * amount;
    target.z += ballDz / ballDistance * amount;
  }
  if (context.velocity) {
    addCappedBias({ x: playerPosition.x + context.velocity.x * 0.18, z: playerPosition.z + context.velocity.z * 0.18 }, 0.22, 0.42);
  }
  const future = context.trajectory?.at(-1)?.position;
  if (future) addCappedBias(future, 0.18, 0.5);
  if (context.contactPoint) addCappedBias(context.contactPoint, context.actionPreparation ? 0.28 : 0.16, 0.48);
  const plantDemand = Math.max(0, Math.min(1, context.plantDemand ?? 0));
  if (plantDemand > 0 && future) addCappedBias(future, plantDemand * 0.16, 0.28);
  const offset = { x: target.x - playerPosition.x, z: target.z - playerPosition.z };
  const total = Math.hypot(offset.x, offset.z);
  if (context.contactResolved) {
    // The existing camera spring eases this small contact-point bias back to
    // the normal player/ball frame without adding shake or a hard snap.
    offset.x *= 0.72;
    offset.z *= 0.72;
  }
  const maxFocusOffset = MAX_BALL_FOCUS_BIAS + 0.78;
  if (total > maxFocusOffset) {
    offset.x *= maxFocusOffset / total;
    offset.z *= maxFocusOffset / total;
  }
  return {
    x: playerPosition.x + offset.x,
    y: playerPosition.y,
    z: playerPosition.z + offset.z,
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
