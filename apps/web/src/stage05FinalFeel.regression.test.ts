import { describe, expect, test } from 'vitest';
import { BALL_CONSTANTS, createBallState, type BallState } from '../../../packages/physics/src/ball/BallState';
import { MATCH_BALL_PROFILE } from '../../../packages/physics/src/ball/aerodynamics';
import { BALL_SUBSTEP_DT, STANDARD_GOAL_FRAME, stepBall } from '../../../packages/physics/src/ball/trajectory';
import { createPlayerState, type PlayerState } from '../../../packages/sim/src/player/PlayerState';
import { createFlatMovementWorld, DEFAULT_MOVEMENT_CONFIG, stepPlayerMovement } from '../../../packages/sim/src/player/movement';
import { buildControlTouch, type ControlFailureReason } from '../../../packages/sim/src/football/controlEnvelope';
import { createFootballRuntimeState, markControlTouch, stepFootballRuntime } from '../../../packages/sim/src/football/runtime';
import { applyBallContact, type FootballActorSnapshot, type FootballBallSnapshot, type FootballHorizontalDirection } from '../../../packages/sim/src/football/types';
import { PLAYER_VISUAL_LAYOUT, playerVisualFootY } from './presentation/PlayerVisualLayout';
import { resolveBallAwareCameraFocus } from './camera/FootballPracticeCamera';
import { ThirdPersonCamera, type CameraSnapshot } from './camera/ThirdPersonCamera';
import { intersectAimRayWithPlaneZ } from './input/WorldAim';

const DT = 1 / 60;
const WORLD = createFlatMovementWorld();
const MIN_LOWER_BODY_BALL_CLEARANCE = 0.24;
const MIN_FRONT_BOOT_BALL_CENTER = PLAYER_VISUAL_LAYOUT.footForward
  + PLAYER_VISUAL_LAYOUT.footLength / 2
  + BALL_CONSTANTS.radius;

function direction(degrees: number): FootballHorizontalDirection {
  const radians = degrees * Math.PI / 180;
  return { x: Math.sin(radians), z: Math.cos(radians) };
}

function actorSnapshot(player: Readonly<PlayerState>): FootballActorSnapshot {
  const speed = Math.hypot(player.velocity.x, player.velocity.z);
  const movementBalance = player.locomotion === 'sharp-cut' ? 0.68 : player.grounded ? 1 : 0.58;
  const speedBalance = Math.min(1, Math.max(0.72, 1 - Math.max(0, speed - DEFAULT_MOVEMENT_CONFIG.jogSpeed) * 0.035));
  return {
    position: { ...player.position },
    velocity: { ...player.velocity },
    facingYaw: speed > 0.35 ? Math.atan2(player.velocity.x, player.velocity.z) : player.facingYaw,
    balance: movementBalance * speedBalance,
    pressure: 0,
    sprinting: player.locomotion === 'sprint',
    preferredFoot: 'right',
  };
}

function ballSnapshot(ball: Readonly<BallState>): FootballBallSnapshot {
  return {
    position: { ...ball.position },
    velocity: { ...ball.velocity },
    angularVelocity: { ...ball.angularVelocity },
    radius: BALL_CONSTANTS.radius,
    mass: BALL_CONSTANTS.mass,
    grounded: ball.grounded,
  };
}

function cameraForward(snapshot: Readonly<CameraSnapshot>) {
  const dx = snapshot.target.x - snapshot.position.x;
  const dy = snapshot.target.y - snapshot.position.y;
  const dz = snapshot.target.z - snapshot.position.z;
  const length = Math.hypot(dx, dy, dz);
  return { x: dx / length, y: dy / length, z: dz / length };
}

function settleCamera(camera: ThirdPersonCamera, position: Readonly<PlayerState['position']>, frames = 90): CameraSnapshot {
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

  test('precision, trap, and sharp-turn target pockets stay outside the rendered boot face', () => {
    const player = createPlayerState({
      position: { x: 0, y: 0, z: -13 },
      facingYaw: 0,
      velocity: { x: 0, y: 0, z: 3.4 },
    });
    const actor = actorSnapshot(player);
    const movingBall = createBallState({
      position: { x: 0, y: BALL_CONSTANTS.radius, z: -12.45 },
      velocity: { x: 0, y: 0, z: 3.1 },
      grounded: true,
    });

    const precision = buildControlTouch({
      actor,
      ball: ballSnapshot(movingBall),
      desiredDirection: direction(0),
      precision: true,
      sprint: false,
      pressure: 0,
      moveIntentMagnitude: 1,
    });
    const trap = buildControlTouch({
      actor,
      ball: ballSnapshot(movingBall),
      desiredDirection: direction(0),
      precision: false,
      sprint: false,
      pressure: 0,
      moveIntentMagnitude: 0,
      receiveMode: 'kill',
    });
    const sharpTurn = buildControlTouch({
      actor,
      ball: ballSnapshot(movingBall),
      desiredDirection: direction(120),
      precision: true,
      sprint: false,
      pressure: 0,
      moveIntentMagnitude: 1,
    });

    expect(precision.touchDistance).toBeGreaterThanOrEqual(MIN_FRONT_BOOT_BALL_CENTER);
    expect(trap.touchDistance).toBeGreaterThanOrEqual(MIN_FRONT_BOOT_BALL_CENTER);
    expect(sharpTurn.touchDistance).toBeGreaterThanOrEqual(MIN_FRONT_BOOT_BALL_CENTER);
  });

  test('ordinary eight-direction WASD changes stay recoverable without a loss cascade or crossing the player root', () => {
    let player = createPlayerState({
      position: { x: 0, y: 0, z: -13 },
      facingYaw: 0,
      stamina: DEFAULT_MOVEMENT_CONFIG.staminaMax,
    });
    let ball = createBallState({
      position: { x: 0, y: BALL_CONSTANTS.radius, z: -12.32 },
      grounded: true,
    });
    let runtime = createFootballRuntimeState();
    const failures: ControlFailureReason[] = [];
    let consecutiveFailures = 0;
    let maxConsecutiveFailures = 0;
    let maxSeparation = 0;
    let minSeparation = Number.POSITIVE_INFINITY;

    const requested = [
      ...Array.from({ length: 60 }, () => direction(0)),
      ...[45, 90, 135, 180, -135, -90, -45, 0].flatMap((degrees) =>
        Array.from({ length: 24 }, () => direction(degrees))),
    ];

    for (const desired of requested) {
      player = stepPlayerMovement(player, {
        moveX: -desired.x,
        moveY: desired.z,
        aimYaw: 0,
        sprint: false,
        actionBits: 0,
      }, WORLD, DT);
      runtime = stepFootballRuntime(runtime, 0, DT).state;

      if (runtime.controlTouchCooldown <= 0) {
        const touch = buildControlTouch({
          actor: actorSnapshot(player),
          ball: ballSnapshot(ball),
          desiredDirection: desired,
          precision: false,
          sprint: false,
          pressure: 0,
          moveIntentMagnitude: 1,
        });
        if (touch.eligible && touch.command) {
          const contacted = applyBallContact(ballSnapshot(ball), touch.command);
          ball = { ...ball, velocity: { ...contacted.velocity }, angularVelocity: { ...contacted.angularVelocity } };
          runtime = markControlTouch(runtime, false, touch.touchMode);
          consecutiveFailures = 0;
        } else if (touch.reason !== 'idle-no-touch') {
          failures.push(touch.reason);
          consecutiveFailures += 1;
          maxConsecutiveFailures = Math.max(maxConsecutiveFailures, consecutiveFailures);
        }
      }

      ball = stepBall(ball, BALL_SUBSTEP_DT, MATCH_BALL_PROFILE, null);
      ball = stepBall(ball, BALL_SUBSTEP_DT, MATCH_BALL_PROFILE, null);
      const separation = Math.hypot(ball.position.x - player.position.x, ball.position.z - player.position.z);
      minSeparation = Math.min(minSeparation, separation);
      maxSeparation = Math.max(maxSeparation, separation);
    }

    expect(failures.filter((reason) => reason === 'out-of-reach')).toHaveLength(0);
    expect(maxConsecutiveFailures).toBeLessThanOrEqual(2);
    expect(maxSeparation).toBeLessThan(1.42);
    expect(minSeparation).toBeGreaterThanOrEqual(MIN_LOWER_BODY_BALL_CLEARANCE);
  });
});
