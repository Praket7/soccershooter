import { describe, expect, test } from 'vitest';
import { BALL_CONSTANTS, createBallState, type BallState } from '../../../physics/src/ball/BallState';
import { MATCH_BALL_PROFILE } from '../../../physics/src/ball/aerodynamics';
import { BALL_SUBSTEP_DT, stepBall } from '../../../physics/src/ball/trajectory';
import { createPlayerState, type PlayerState } from '../player/PlayerState';
import { createFlatMovementWorld, DEFAULT_MOVEMENT_CONFIG, stepPlayerMovement } from '../player/movement';
import { buildControlTouch, type ControlFailureReason } from './controlEnvelope';
import { createFootballRuntimeState, markControlTouch, stepFootballRuntime } from './runtime';
import { applyBallContact, type FootballActorSnapshot, type FootballBallSnapshot, type FootballHorizontalDirection } from './types';

const DT = 1 / 60;
const WORLD = createFlatMovementWorld();

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function actorSnapshot(player: Readonly<PlayerState>): FootballActorSnapshot {
  const speed = Math.hypot(player.velocity.x, player.velocity.z);
  const movementBalance = player.locomotion === 'sharp-cut' ? 0.68 : player.grounded ? 1 : 0.58;
  const speedBalance = clamp(1 - Math.max(0, speed - DEFAULT_MOVEMENT_CONFIG.jogSpeed) * 0.035, 0.72, 1);
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

function direction(degrees: number): FootballHorizontalDirection {
  const radians = degrees * Math.PI / 180;
  return { x: Math.sin(radians), z: Math.cos(radians) };
}

interface ManeuverFrame {
  direction: FootballHorizontalDirection;
  sprint: boolean;
  precision?: boolean;
}

interface ManeuverResult {
  maxSeparation: number;
  failures: ControlFailureReason[];
  behindBodyFailures: number;
  outOfReachFailures: number;
}

function runManeuver(frames: readonly ManeuverFrame[]): ManeuverResult {
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
  let maxSeparation = 0;
  const failures: ControlFailureReason[] = [];

  for (const frame of frames) {
    player = stepPlayerMovement(player, {
      moveX: -frame.direction.x,
      moveY: frame.direction.z,
      aimYaw: 0,
      sprint: frame.sprint,
      actionBits: 0,
    }, WORLD, DT);
    runtime = stepFootballRuntime(runtime, 0, DT).state;

    if (runtime.controlTouchCooldown <= 0) {
      const touch = buildControlTouch({
        actor: actorSnapshot(player),
        ball: ballSnapshot(ball),
        desiredDirection: frame.direction,
        precision: frame.precision ?? false,
        sprint: frame.sprint,
        pressure: 0,
        moveIntentMagnitude: 1,
      });
      if (touch.eligible && touch.command) {
        const contacted = applyBallContact(ballSnapshot(ball), touch.command);
        ball = {
          ...ball,
          velocity: { ...contacted.velocity },
          angularVelocity: { ...contacted.angularVelocity },
        };
        runtime = markControlTouch(runtime, frame.sprint, touch.touchMode);
      } else {
        failures.push(touch.reason);
      }
    }

    ball = stepBall(ball, BALL_SUBSTEP_DT, MATCH_BALL_PROFILE, null);
    ball = stepBall(ball, BALL_SUBSTEP_DT, MATCH_BALL_PROFILE, null);
    maxSeparation = Math.max(
      maxSeparation,
      Math.hypot(ball.position.x - player.position.x, ball.position.z - player.position.z),
    );
  }

  if (failures[0] === 'idle-no-touch') failures.shift();
  return {
    maxSeparation,
    failures,
    behindBodyFailures: failures.filter((reason) => reason === 'behind-body').length,
    outOfReachFailures: failures.filter((reason) => reason === 'out-of-reach').length,
  };
}

function straightThenTurn(turnDegrees: number, sprint: boolean): ManeuverFrame[] {
  return [
    ...Array.from({ length: 90 }, () => ({ direction: direction(0), sprint })),
    ...Array.from({ length: 120 }, () => ({ direction: direction(turnDegrees), sprint })),
  ];
}

function sprintReleasePlant(turnDegrees: number): ManeuverFrame[] {
  return [
    ...Array.from({ length: 90 }, () => ({ direction: direction(0), sprint: true })),
    ...Array.from({ length: 150 }, () => ({ direction: direction(turnDegrees), sprint: false })),
  ];
}

function repeatedSlalom(): ManeuverFrame[] {
  const frames: ManeuverFrame[] = Array.from({ length: 60 }, () => ({ direction: direction(0), sprint: false }));
  for (let repeat = 0; repeat < 5; repeat += 1) {
    frames.push(...Array.from({ length: 20 }, () => ({ direction: direction(45), sprint: false })));
    frames.push(...Array.from({ length: 20 }, () => ({ direction: direction(-45), sprint: false })));
  }
  return frames;
}

describe('physical dribble maneuver quality', () => {
  test('a 90 degree sprint cut stays recoverable instead of entering a failure cascade', () => {
    const result = runManeuver(straightThenTurn(90, true));
    expect(result.failures).toEqual([]);
    expect(result.maxSeparation).toBeLessThan(1.5);
  });

  test('a 120 degree sprint cut remains a difficult controlled arc rather than losing the ball several metres away', () => {
    const result = runManeuver(straightThenTurn(120, true));
    expect(result.failures).toEqual([]);
    expect(result.maxSeparation).toBeLessThan(1.55);
  });

  test('releasing sprint into a 150 degree plant can recover a ball that crosses just behind the stride', () => {
    const result = runManeuver(sprintReleasePlant(150));
    expect(result.behindBodyFailures).toBe(0);
    expect(result.outOfReachFailures).toBe(0);
    expect(result.maxSeparation).toBeLessThan(1.3);
  });

  test('repeated ordinary 45 degree changes stay playable without behind-body or out-of-reach lockout', () => {
    const result = runManeuver(repeatedSlalom());
    expect(result.behindBodyFailures).toBe(0);
    expect(result.outOfReachFailures).toBe(0);
    expect(result.maxSeparation).toBeLessThan(1.3);
  });

  test('a perfectly centered clean carry does not invent sideways touch jitter', () => {
    const actor: FootballActorSnapshot = {
      position: { x: 0, y: 0, z: 0 },
      velocity: { x: 0, y: 0, z: 5.2 },
      facingYaw: 0,
      balance: 1,
      pressure: 0,
      sprinting: false,
      preferredFoot: 'right',
    };
    const source: FootballBallSnapshot = {
      position: { x: 0, y: BALL_CONSTANTS.radius, z: 0.52 },
      velocity: { x: 0, y: 0, z: 5 },
      angularVelocity: { x: 5 / BALL_CONSTANTS.radius, y: 0, z: 0 },
      radius: BALL_CONSTANTS.radius,
      mass: BALL_CONSTANTS.mass,
      grounded: true,
    };
    const touch = buildControlTouch({
      actor,
      ball: source,
      desiredDirection: { x: 0, z: 1 },
      precision: false,
      sprint: false,
      pressure: 0,
      moveIntentMagnitude: 1,
    });
    expect(touch.eligible).toBe(true);
    const next = applyBallContact(source, touch.command!);
    expect(Math.abs(next.velocity.x)).toBeLessThan(0.001);
  });

  test('the first full-sprint 90 degree cut bends the ball into an arc instead of snapping almost sideways', () => {
    const actor: FootballActorSnapshot = {
      position: { x: 0, y: 0, z: 0 },
      velocity: { x: 0, y: 0, z: 7.4 },
      facingYaw: 0,
      balance: 1,
      pressure: 0,
      sprinting: true,
      preferredFoot: 'right',
    };
    const source: FootballBallSnapshot = {
      position: { x: 0, y: BALL_CONSTANTS.radius, z: 0.78 },
      velocity: { x: 0, y: 0, z: 7.2 },
      angularVelocity: { x: 7.2 / BALL_CONSTANTS.radius, y: 0, z: 0 },
      radius: BALL_CONSTANTS.radius,
      mass: BALL_CONSTANTS.mass,
      grounded: true,
    };
    const touch = buildControlTouch({
      actor,
      ball: source,
      desiredDirection: { x: -1, z: 0 },
      precision: false,
      sprint: true,
      pressure: 0,
      moveIntentMagnitude: 1,
    });
    expect(touch.eligible).toBe(true);
    expect(touch.touchMode).toBe('effort-turn');
    const next = applyBallContact(source, touch.command!);
    const deflectionDegrees = Math.atan2(Math.abs(next.velocity.x), Math.max(0.001, next.velocity.z)) * 180 / Math.PI;
    expect(deflectionDegrees).toBeGreaterThan(20);
    expect(deflectionDegrees).toBeLessThan(58);
  });
});
