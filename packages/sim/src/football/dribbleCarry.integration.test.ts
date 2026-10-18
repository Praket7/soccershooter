import { describe, expect, test } from 'vitest';
import { BALL_CONSTANTS, createBallState, type BallState } from '@soccershooter/physics/ball/BallState';
import { MATCH_BALL_PROFILE } from '@soccershooter/physics/ball/aerodynamics';
import { BALL_SUBSTEP_DT, stepBall } from '@soccershooter/physics/ball/trajectory';
import { PlayerActionBits, createPlayerState, type PlayerState } from '../player/PlayerState';
import { createFlatMovementWorld, DEFAULT_MOVEMENT_CONFIG, stepPlayerMovement } from '../player/movement';
import { buildControlTouch, type ControlFailureReason } from './controlEnvelope';
import { createFootballRuntimeState, markControlTouch, stepFootballRuntime } from './runtime';
import { applyBallContact, type FootballActorSnapshot, type FootballBallSnapshot } from './types';

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

interface CarrySample {
  tick: number;
  separation: number;
  playerSpeed: number;
  ballSpeed: number;
  playerZ: number;
  ballZ: number;
  touch: string;
}

function runCarry(sprint: boolean, ticks = 120): { maxSeparation: number; samples: CarrySample[]; failures: ControlFailureReason[] } {
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
  const samples: CarrySample[] = [];
  const failures: ControlFailureReason[] = [];

  for (let tick = 0; tick < ticks; tick += 1) {
    const intent = {
      moveX: 0,
      moveY: 1,
      aimYaw: 0,
      sprint,
      actionBits: 0,
    };

    player = stepPlayerMovement(player, intent, WORLD, DT);
    runtime = stepFootballRuntime(runtime, 0, DT).state;

    let touchLabel = 'cooldown';
    if (runtime.controlTouchCooldown <= 0) {
      const touch = buildControlTouch({
        actor: actorSnapshot(player),
        ball: ballSnapshot(ball),
        desiredDirection: { x: 0, z: 1 },
        precision: false,
        sprint,
        pressure: 0,
        moveIntentMagnitude: 1,
      });
      touchLabel = `${touch.touchMode}:${touch.reason}`;
      if (touch.eligible && touch.command) {
        const contacted = applyBallContact(ballSnapshot(ball), touch.command);
        ball = {
          ...ball,
          velocity: { ...contacted.velocity },
          angularVelocity: { ...contacted.angularVelocity },
        };
        runtime = markControlTouch(runtime, touch.touchMode === 'sprint', touch.touchMode);
      } else {
        failures.push(touch.reason);
      }
    }

    // FootballPractice runs at 60 Hz while the authoritative football is 120 Hz.
    ball = stepBall(ball, BALL_SUBSTEP_DT, MATCH_BALL_PROFILE, null);
    ball = stepBall(ball, BALL_SUBSTEP_DT, MATCH_BALL_PROFILE, null);

    const separation = Math.hypot(ball.position.x - player.position.x, ball.position.z - player.position.z);
    maxSeparation = Math.max(maxSeparation, separation);
    if (tick < 20 || touchLabel !== 'cooldown' || separation > 1.1) {
      samples.push({
        tick,
        separation,
        playerSpeed: Math.hypot(player.velocity.x, player.velocity.z),
        ballSpeed: Math.hypot(ball.velocity.x, ball.velocity.z),
        playerZ: player.position.z,
        ballZ: ball.position.z,
        touch: touchLabel,
      });
    }
  }

  return { maxSeparation, samples, failures };
}

function diagnostic(result: ReturnType<typeof runCarry>): string {
  return JSON.stringify({
    maxSeparation: result.maxSeparation,
    failures: result.failures.slice(0, 20),
    samples: result.samples.slice(-35),
  }, null, 2);
}

describe('full physical dribble carry integration', () => {
  test('normal two-second carry remains a compact competent possession', () => {
    const result = runCarry(false);
    expect(result.failures, diagnostic(result)).toEqual([]);
    expect(result.maxSeparation, diagnostic(result)).toBeLessThan(1.12);
  });

  test('sprint two-second carry remains a recoverable knock-on sequence', () => {
    const result = runCarry(true);
    expect(result.failures, diagnostic(result)).toEqual([]);
    expect(result.maxSeparation, diagnostic(result)).toBeLessThan(1.38);
  });
});
