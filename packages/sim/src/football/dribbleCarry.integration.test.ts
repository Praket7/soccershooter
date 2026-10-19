import { describe, expect, test } from 'vitest';
import { BALL_CONSTANTS, createBallState, type BallState } from '../../../physics/src/ball/BallState';
import { MATCH_BALL_PROFILE } from '../../../physics/src/ball/aerodynamics';
import { BALL_SUBSTEP_DT, stepBall } from '../../../physics/src/ball/trajectory';
import { createPlayerState, type PlayerState } from '../player/PlayerState';
import { createFlatMovementWorld, DEFAULT_MOVEMENT_CONFIG, stepPlayerMovement } from '../player/movement';
import { createPlannedDribbleState, stepPlannedDribble } from './dribblePlanner';
import type { FootballActorSnapshot, FootballBallSnapshot } from './types';

const DT = 1 / 60;
const WORLD = createFlatMovementWorld();

function actorSnapshot(player: Readonly<PlayerState>): FootballActorSnapshot {
  const speed = Math.hypot(player.velocity.x, player.velocity.z);
  const movementBalance = player.locomotion === 'sharp-cut' ? 0.68 : player.grounded ? 1 : 0.58;
  const speedBalance = Math.max(0.72, Math.min(1, 1 - Math.max(0, speed - DEFAULT_MOVEMENT_CONFIG.jogSpeed) * 0.035));
  return {
    position: { ...player.position }, velocity: { ...player.velocity }, facingYaw: speed > 0.35 ? Math.atan2(player.velocity.x, player.velocity.z) : player.facingYaw,
    balance: movementBalance * speedBalance, pressure: 0, sprinting: player.locomotion === 'sprint', preferredFoot: 'right',
  };
}

function ballSnapshot(ball: Readonly<BallState>): FootballBallSnapshot {
  return {
    position: { ...ball.position }, velocity: { ...ball.velocity }, angularVelocity: { ...ball.angularVelocity },
    radius: BALL_CONSTANTS.radius, mass: BALL_CONSTANTS.mass, grounded: ball.grounded,
  };
}

interface CarrySample { tick: number; separation: number; playerSpeed: number; ballSpeed: number; playerZ: number; ballZ: number; touch: string; }

function runCarry(sprint: boolean, ticks = 120): { maxSeparation: number; samples: CarrySample[]; failures: string[] } {
  let player = createPlayerState({ position: { x: 0, y: 0, z: -13 }, facingYaw: 0, stamina: DEFAULT_MOVEMENT_CONFIG.staminaMax });
  let ball = createBallState({ position: { x: 0, y: BALL_CONSTANTS.radius, z: -12.32 }, grounded: true });
  let dribble = createPlannedDribbleState();
  let maxSeparation = 0;
  const samples: CarrySample[] = [];
  const failures: string[] = [];

  for (let tick = 0; tick < ticks; tick += 1) {
    const intent = { moveX: 0, moveY: 1, aimYaw: 0, sprint, actionBits: 0 };
    player = stepPlayerMovement(player, intent, WORLD, DT);
    const planned = stepPlannedDribble({
      tick,
      state: dribble,
      actor: actorSnapshot(player),
      motion: player.athleticMotion,
      ball: ballSnapshot(ball),
      desiredDirection: { x: 0, z: 1 },
      precision: false,
      sprint,
      pressure: 0,
      moveIntentMagnitude: 1,
    });
    dribble = planned.state;
    const touchLabel = planned.reason;
    if (planned.contactApplied) {
      ball = { ...ball, velocity: { ...planned.ball.velocity }, angularVelocity: { ...planned.ball.angularVelocity } };
    } else if (['loose-ball-chase', 'no-viable-intercept', 'geometry-miss', 'missed-window', 'expired'].includes(planned.reason)) {
      failures.push(planned.reason);
    }
    ball = stepBall(ball, BALL_SUBSTEP_DT, MATCH_BALL_PROFILE, null);
    ball = stepBall(ball, BALL_SUBSTEP_DT, MATCH_BALL_PROFILE, null);
    const separation = Math.hypot(ball.position.x - player.position.x, ball.position.z - player.position.z);
    maxSeparation = Math.max(maxSeparation, separation);
    if (tick < 20 || planned.contactApplied || separation > 1.1) samples.push({
      tick, separation, playerSpeed: Math.hypot(player.velocity.x, player.velocity.z),
      ballSpeed: Math.hypot(ball.velocity.x, ball.velocity.z), playerZ: player.position.z, ballZ: ball.position.z, touch: touchLabel,
    });
  }
  return { maxSeparation, samples, failures };
}

function diagnostic(result: ReturnType<typeof runCarry>): string {
  return JSON.stringify({ maxSeparation: result.maxSeparation, failures: result.failures.slice(0, 20), samples: result.samples.slice(-35) }, null, 2);
}

describe('contact-planned physical dribble carry', () => {
  test('normal two-second carry emits only planned contacts and stays inside the compact physical pocket', () => {
    const result = runCarry(false);
    expect(result.failures, diagnostic(result)).toEqual([]);
    expect(result.samples.filter((sample) => sample.touch === 'contact').length).toBeGreaterThan(3);
    expect(result.maxSeparation, diagnostic(result)).toBeLessThan(1.12);
  });

  test('sprint carry uses fewer, longer contact events while keeping the ball a recoverable free object', () => {
    const normal = runCarry(false);
    const sprint = runCarry(true);
    expect(sprint.failures, diagnostic(sprint)).toEqual([]);
    expect(sprint.samples.filter((sample) => sample.touch === 'contact').length)
      .toBeLessThan(normal.samples.filter((sample) => sample.touch === 'contact').length);
    expect(sprint.maxSeparation, diagnostic(sprint)).toBeLessThan(1.38);
  });
});
