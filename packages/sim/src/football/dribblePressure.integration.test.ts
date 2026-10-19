import { describe, expect, test } from 'vitest';
import { BALL_CONSTANTS, createBallState, type BallState } from '../../../physics/src/ball/BallState';
import { MATCH_BALL_PROFILE } from '../../../physics/src/ball/aerodynamics';
import { BALL_SUBSTEP_DT, stepBall } from '../../../physics/src/ball/trajectory';
import { createPlayerState, type PlayerState } from '../player/PlayerState';
import { createFlatMovementWorld, stepPlayerMovement } from '../player/movement';
import { createPlannedDribbleState, stepPlannedDribble } from './runtime';
import type { FootballActorSnapshot, FootballBallSnapshot } from './types';

const DT = 1 / 60;
const WORLD = createFlatMovementWorld({ minX: -140, maxX: 140, minZ: -140, maxZ: 140 });

function actor(player: Readonly<PlayerState>, pressure: number, balance: number): FootballActorSnapshot {
  const speed = Math.hypot(player.velocity.x, player.velocity.z);
  return {
    position: { ...player.position },
    velocity: { ...player.velocity },
    facingYaw: speed > 0.3 ? Math.atan2(player.velocity.x, player.velocity.z) : player.facingYaw,
    balance,
    pressure,
    sprinting: player.locomotion === 'sprint',
    preferredFoot: 'right',
  };
}

function snapshot(ball: Readonly<BallState>): FootballBallSnapshot {
  return {
    position: { ...ball.position },
    velocity: { ...ball.velocity },
    angularVelocity: { ...ball.angularVelocity },
    radius: BALL_CONSTANTS.radius,
    mass: BALL_CONSTANTS.mass,
    grounded: ball.grounded,
  };
}

function applyBall(ball: Readonly<BallState>, result: ReturnType<typeof stepPlannedDribble>): BallState {
  if (!result.contactApplied) return ball as BallState;
  return {
    ...ball,
    velocity: { ...result.ball.velocity },
    angularVelocity: { ...result.ball.angularVelocity },
  };
}

async function nextContact(pressure: number, balance: number) {
  let player = createPlayerState({ position: { x: 0, y: 0, z: 0 }, facingYaw: 0 });
  let ball = createBallState({
    position: { x: 0.18, y: BALL_CONSTANTS.radius, z: 0.72 },
    velocity: { x: 1.3, y: 0, z: 2.4 },
    grounded: true,
  });
  let planner = createPlannedDribbleState();
  let plannedQuality = 1;

  for (let tick = 0; tick < 80; tick += 1) {
    player = stepPlayerMovement(player, { moveX: 0, moveY: 1, aimYaw: 0, sprint: false, actionBits: 0 }, WORLD, DT);
    const result = stepPlannedDribble({
      tick,
      state: planner,
      actor: actor(player, pressure, balance),
      motion: player.athleticMotion,
      ball: snapshot(ball),
      desiredDirection: { x: 0, z: 1 },
      precision: false,
      sprint: false,
      pressure,
      moveIntentMagnitude: 1,
      receiveMode: null,
    });
    planner = result.state;
    if (planner.activePlan) plannedQuality = planner.activePlan.quality;
    if (result.contactApplied) return { player, ball: result.ball, quality: plannedQuality };
    ball = applyBall(ball, result);
    ball = stepBall(stepBall(ball, BALL_SUBSTEP_DT, MATCH_BALL_PROFILE, null), BALL_SUBSTEP_DT, MATCH_BALL_PROFILE, null);
  }
  throw new Error('expected a legal contact');
}

interface ZigzagMetrics {
  contacts: number;
  maxSeparation: number;
  maxExitSpeed: number;
  looseFrames: number;
}

function runZigzag(mode: 'sprint' | 'precision'): ZigzagMetrics {
  let player = createPlayerState({ position: { x: 0, y: 0, z: 0 }, facingYaw: 0 });
  let ball = createBallState({ position: { x: 0, y: BALL_CONSTANTS.radius, z: 0.68 }, grounded: true });
  let planner = createPlannedDribbleState();
  let contacts = 0;
  let maxSeparation = 0;
  let maxExitSpeed = 0;
  let looseFrames = 0;

  for (let tick = 0; tick < 240; tick += 1) {
    const phase = Math.floor(tick / 18) % 2;
    const moveX = phase === 0 ? -0.78 : 0.78;
    const moveY = 0.63;
    const sprint = mode === 'sprint';
    const precision = mode === 'precision';
    const desiredLength = Math.hypot(-moveX, moveY);
    const desiredDirection = { x: -moveX / desiredLength, z: moveY / desiredLength };

    player = stepPlayerMovement(player, { moveX, moveY, aimYaw: 0, sprint, actionBits: 0 }, WORLD, DT);
    const result = stepPlannedDribble({
      tick,
      state: planner,
      actor: actor(player, 0, 1),
      motion: player.athleticMotion,
      ball: snapshot(ball),
      desiredDirection,
      precision,
      sprint,
      pressure: 0,
      moveIntentMagnitude: 1,
      receiveMode: null,
    });
    planner = result.state;

    if (result.contactApplied) {
      contacts += 1;
      maxExitSpeed = Math.max(maxExitSpeed, Math.hypot(result.ball.velocity.x, result.ball.velocity.z));
    }
    if (planner.looseBall) looseFrames += 1;
    ball = applyBall(ball, result);
    ball = stepBall(stepBall(ball, BALL_SUBSTEP_DT, MATCH_BALL_PROFILE, null), BALL_SUBSTEP_DT, MATCH_BALL_PROFILE, null);
    maxSeparation = Math.max(maxSeparation, Math.hypot(player.position.x - ball.position.x, player.position.z - ball.position.z));
  }

  return { contacts, maxSeparation, maxExitSpeed, looseFrames };
}

describe('Stage 05R off-balance and pressure dribbling', () => {
  test('pressure and poor balance degrade the next contact without stealing directional intent', async () => {
    const clean = await nextContact(0, 1);
    const pressured = await nextContact(0.82, 0.58);

    expect(pressured.quality).toBeLessThan(clean.quality - 0.25);
    expect(pressured.ball.velocity.z).toBeGreaterThan(0.8);
    // The pace-matched startup touch is deliberately softer now, so preserve
    // the meaningful lateral-error relationship without requiring the old
    // higher absolute launch speed.
    expect(pressured.ball.velocity.x).toBeGreaterThan(clean.ball.velocity.x + 0.12);
    expect(Math.hypot(pressured.ball.velocity.x, pressured.ball.velocity.z)).toBeLessThanOrEqual(6.2);
  });

  test('repeated full-speed zigzag produces a wider, looser pocket than slowing into precision', () => {
    const sprint = runZigzag('sprint');
    const precision = runZigzag('precision');

    expect(sprint.contacts).toBeGreaterThanOrEqual(4);
    expect(precision.contacts).toBeGreaterThan(sprint.contacts);
    const comparison = JSON.stringify({ sprint, precision });
    expect(sprint.maxSeparation, comparison).toBeGreaterThan(precision.maxSeparation + 0.16);
    expect(sprint.looseFrames, comparison).toBeGreaterThanOrEqual(precision.looseFrames);
  });
});
