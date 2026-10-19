import { describe, expect, test } from 'vitest';
import { BALL_CONSTANTS, createBallState, type BallState } from '../../../physics/src/ball/BallState';
import { MATCH_BALL_PROFILE } from '../../../physics/src/ball/aerodynamics';
import { BALL_SUBSTEP_DT, stepBall } from '../../../physics/src/ball/trajectory';
import { createPlayerState, type PlayerState } from '../player/PlayerState';
import { createFlatMovementWorld, DEFAULT_MOVEMENT_CONFIG, stepPlayerMovement } from '../player/movement';
import { buildControlTouch, type ControlFailureReason, type ControlTouchResult } from './controlEnvelope';
import { createFootballRuntimeState, markControlTouch, stepFootballRuntime, type FootballRuntimeState } from './runtime';
import { applyBallContact, type FootballActorSnapshot, type FootballBallSnapshot, type FootballHorizontalDirection } from './types';

const DT = 1 / 60;
const WORLD = createFlatMovementWorld({ minX: -100, maxX: 100, minZ: -100, maxZ: 100 });

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function direction(degrees: number): FootballHorizontalDirection {
  const radians = degrees * Math.PI / 180;
  return { x: Math.sin(radians), z: Math.cos(radians) };
}

function directionTo(player: Readonly<PlayerState>, ball: Readonly<BallState>): FootballHorizontalDirection {
  const x = ball.position.x - player.position.x;
  const z = ball.position.z - player.position.z;
  const length = Math.max(1e-9, Math.hypot(x, z));
  return { x: x / length, z: z / length };
}

function actorSnapshot(player: Readonly<PlayerState>, pressure = 0): FootballActorSnapshot {
  const speed = Math.hypot(player.velocity.x, player.velocity.z);
  const movementBalance = player.locomotion === 'sharp-cut' ? 0.68 : player.grounded ? 1 : 0.58;
  const speedBalance = clamp(1 - Math.max(0, speed - DEFAULT_MOVEMENT_CONFIG.jogSpeed) * 0.035, 0.72, 1);
  return {
    position: { ...player.position },
    velocity: { ...player.velocity },
    facingYaw: speed > 0.35 ? Math.atan2(player.velocity.x, player.velocity.z) : player.facingYaw,
    balance: movementBalance * speedBalance,
    pressure,
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

interface CourseState {
  player: PlayerState;
  ball: BallState;
  runtime: FootballRuntimeState;
  maxSeparation: number;
  touches: number;
  failures: ControlFailureReason[];
  errors: number[];
}

interface CourseFrame {
  direction: FootballHorizontalDirection;
  sprint?: boolean;
  precision?: boolean;
  pressure?: number;
}

function createCourseState(ballDistance = 0.68): CourseState {
  return {
    player: createPlayerState({
      position: { x: 0, y: 0, z: 0 },
      facingYaw: 0,
      stamina: DEFAULT_MOVEMENT_CONFIG.staminaMax,
    }),
    ball: createBallState({
      position: { x: 0, y: BALL_CONSTANTS.radius, z: ballDistance },
      grounded: true,
    }),
    runtime: createFootballRuntimeState(),
    maxSeparation: ballDistance,
    touches: 0,
    failures: [],
    errors: [],
  };
}

function stepCourse(state: CourseState, frame: CourseFrame): { touch: ControlTouchResult | null; contacted: boolean } {
  state.player = stepPlayerMovement(state.player, {
    moveX: -frame.direction.x,
    moveY: frame.direction.z,
    aimYaw: 0,
    sprint: frame.sprint ?? false,
    actionBits: 0,
  }, WORLD, DT);
  state.runtime = stepFootballRuntime(state.runtime, 0, DT).state;

  let touch: ControlTouchResult | null = null;
  let contacted = false;
  if (state.runtime.controlTouchCooldown <= 0) {
    touch = buildControlTouch({
      actor: actorSnapshot(state.player, frame.pressure ?? 0),
      ball: ballSnapshot(state.ball),
      desiredDirection: frame.direction,
      precision: frame.precision ?? false,
      sprint: frame.sprint ?? false,
      pressure: frame.pressure ?? 0,
      moveIntentMagnitude: 1,
    });
    if (touch.eligible && touch.command) {
      const before = { ...state.ball.position };
      const contactedBall = applyBallContact(ballSnapshot(state.ball), touch.command);
      expect(contactedBall.position).toEqual(before);
      state.ball = {
        ...state.ball,
        velocity: { ...contactedBall.velocity },
        angularVelocity: { ...contactedBall.angularVelocity },
      };
      state.runtime = markControlTouch(state.runtime, frame.sprint ?? false, touch.touchMode);
      state.touches += 1;
      state.errors.push(touch.touchErrorMagnitude);
      contacted = true;
    } else {
      state.failures.push(touch.reason);
    }
  }

  state.ball = stepBall(state.ball, BALL_SUBSTEP_DT, MATCH_BALL_PROFILE, null);
  state.ball = stepBall(state.ball, BALL_SUBSTEP_DT, MATCH_BALL_PROFILE, null);
  state.maxSeparation = Math.max(
    state.maxSeparation,
    Math.hypot(state.ball.position.x - state.player.position.x, state.ball.position.z - state.player.position.z),
  );
  return { touch, contacted };
}

function runFrames(state: CourseState, frames: readonly CourseFrame[]): void {
  for (const frame of frames) stepCourse(state, frame);
}

describe('professional physical ball-control course', () => {
  test('clean carry, slalom, sprint, planted cut, and close control remain one smooth learnable sequence', () => {
    const state = createCourseState();
    const frames: CourseFrame[] = [
      ...Array.from({ length: 90 }, () => ({ direction: direction(0) })),
      ...Array.from({ length: 30 }, () => ({ direction: direction(38) })),
      ...Array.from({ length: 30 }, () => ({ direction: direction(-38) })),
      ...Array.from({ length: 75 }, () => ({ direction: direction(0), sprint: true })),
      // Skilled change of direction: release sprint to plant instead of demanding
      // an arcade-perfect full-speed pivot. Separate maneuver tests still require
      // a held-sprint 90 degree cut to remain physically recoverable.
      ...Array.from({ length: 60 }, () => ({ direction: direction(90), sprint: false })),
      ...Array.from({ length: 60 }, () => ({ direction: direction(55), precision: true })),
      ...Array.from({ length: 60 }, () => ({ direction: direction(0) })),
    ];

    runFrames(state, frames);
    const meaningfulFailures = state.failures.filter((reason) => reason !== 'idle-no-touch');

    expect(meaningfulFailures).toEqual([]);
    expect(state.touches).toBeGreaterThan(25);
    expect(state.maxSeparation).toBeLessThan(1.55);
    expect(Math.hypot(state.ball.velocity.x, state.ball.velocity.z)).toBeLessThan(7);
  });

  test('a nearby loose ball can be physically picked up and carried after the player turns back for it', () => {
    const state = createCourseState();
    state.ball = createBallState({
      position: { x: -0.34, y: BALL_CONSTANTS.radius, z: -0.56 },
      velocity: { x: -0.2, y: 0, z: 0.35 },
      grounded: true,
    });
    state.player = createPlayerState({
      position: { x: 0, y: 0, z: 0 },
      velocity: { x: 0, y: 0, z: 4.6 },
      facingYaw: 0,
      stamina: DEFAULT_MOVEMENT_CONFIG.staminaMax,
    });

    let pickupFrame = -1;
    for (let frame = 0; frame < 45; frame += 1) {
      const chase = directionTo(state.player, state.ball);
      const result = stepCourse(state, { direction: chase, precision: true });
      if (pickupFrame < 0 && result.contacted) pickupFrame = frame;
    }
    expect(pickupFrame).toBeGreaterThanOrEqual(0);
    expect(pickupFrame).toBeLessThan(12);

    state.failures.length = 0;
    state.maxSeparation = 0;
    runFrames(state, Array.from({ length: 90 }, () => ({ direction: direction(0), precision: true })));
    expect(state.failures.filter((reason) => reason !== 'idle-no-touch')).toEqual([]);
    expect(state.maxSeparation).toBeLessThan(1.38);
  });

  test('a genuinely dropped ball stays free until the player physically closes the gap, then becomes recoverable', () => {
    const state = createCourseState(1.82);
    let firstContactFrame = -1;
    let separationAtFirstContact = Number.POSITIVE_INFINITY;
    let sawOutOfReach = false;

    for (let frame = 0; frame < 90; frame += 1) {
      const chase = directionTo(state.player, state.ball);
      const result = stepCourse(state, { direction: chase });
      if (result.touch?.reason === 'out-of-reach') sawOutOfReach = true;
      if (firstContactFrame < 0 && result.contacted) {
        firstContactFrame = frame;
        separationAtFirstContact = Math.hypot(
          state.ball.position.x - state.player.position.x,
          state.ball.position.z - state.player.position.z,
        );
      }
    }

    expect(sawOutOfReach).toBe(true);
    expect(firstContactFrame).toBeGreaterThan(0);
    expect(firstContactFrame).toBeLessThan(30);
    expect(separationAtFirstContact).toBeLessThan(1.49);
  });

  test('pressure produces readable bounded heavy-touch error while clean carry stays precise', () => {
    const clean = createCourseState();
    const pressured = createCourseState();
    const straight = Array.from({ length: 120 }, () => ({ direction: direction(0) }));

    runFrames(clean, straight);
    runFrames(pressured, straight.map((frame) => ({ ...frame, pressure: 0.78 })));

    const cleanMean = clean.errors.reduce((sum, value) => sum + value, 0) / Math.max(1, clean.errors.length);
    const pressuredMean = pressured.errors.reduce((sum, value) => sum + value, 0) / Math.max(1, pressured.errors.length);
    expect(cleanMean).toBeLessThan(0.02);
    expect(pressuredMean).toBeGreaterThan(cleanMean + 0.025);
    expect(Math.max(...pressured.errors)).toBeLessThan(0.55);
    expect(pressured.maxSeparation).toBeLessThan(1.5);
    expect(pressured.failures.filter((reason) => reason !== 'idle-no-touch')).toEqual([]);
  });
});
