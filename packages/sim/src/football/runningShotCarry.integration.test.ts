import { describe, expect, test } from 'vitest';
import { BALL_CONSTANTS, createBallState, type BallState } from '../../../physics/src/ball/BallState';
import { MATCH_BALL_PROFILE } from '../../../physics/src/ball/aerodynamics';
import { BALL_SUBSTEP_DT, stepBall } from '../../../physics/src/ball/trajectory';
import { createPlayerState, PlayerActionBits, type PlayerState } from '../player/PlayerState';
import { createFlatMovementWorld, stepPlayerMovement } from '../player/movement';
import { createPlannedDribbleState, stepPlannedDribble, type PlannedDribbleState } from './dribblePlanner';
import { createStrikeContactPlan } from './strikePlanner';
import type { FootballActorSnapshot, FootballBallSnapshot } from './types';

const DT = 1 / 60;
const WORLD = createFlatMovementWorld();

function actorSnapshot(player: Readonly<PlayerState>): FootballActorSnapshot {
  return {
    position: { ...player.position },
    velocity: { ...player.velocity },
    facingYaw: Math.hypot(player.velocity.x, player.velocity.z) > 0.35
      ? Math.atan2(player.velocity.x, player.velocity.z)
      : player.facingYaw,
    balance: player.grounded ? 1 : 0.58,
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

function advanceBall(ball: BallState): BallState {
  let next = stepBall(ball, BALL_SUBSTEP_DT, MATCH_BALL_PROFILE, null);
  next = stepBall(next, BALL_SUBSTEP_DT, MATCH_BALL_PROFILE, null);
  return next;
}

function applyDribbleStep(
  tick: number,
  player: PlayerState,
  ball: BallState,
  dribble: PlannedDribbleState,
): { ball: BallState; dribble: PlannedDribbleState; touched: boolean; reason: string } {
  const planned = stepPlannedDribble({
    tick,
    state: dribble,
    actor: actorSnapshot(player),
    motion: player.athleticMotion,
    ball: ballSnapshot(ball),
    desiredDirection: { x: 0, z: 1 },
    precision: false,
    sprint: false,
    pressure: 0,
    moveIntentMagnitude: 1,
  });
  const nextBall = planned.contactApplied
    ? { ...ball, velocity: { ...planned.ball.velocity }, angularVelocity: { ...planned.ball.angularVelocity } }
    : ball;
  return { ball: nextBall, dribble: planned.state, touched: planned.contactApplied, reason: planned.reason };
}

describe('held-run carry to strike integration', () => {
  test('holding W through a 150 ms shot charge leaves a legal next strike beat on release', () => {
    let player = createPlayerState({ position: { x: 0, y: 0, z: -13 }, facingYaw: 0 });
    let ball = createBallState({ position: { x: 0, y: BALL_CONSTANTS.radius, z: -12.32 }, grounded: true });
    let dribble = createPlannedDribbleState();
    const setupTouchTicks: number[] = [];

    // Match the browser regression: establish a running dribble first.
    for (let tick = 0; tick < 48; tick += 1) {
      player = stepPlayerMovement(player, { moveX: 0, moveY: 1, aimYaw: 0, sprint: false, actionBits: 0 }, WORLD, DT);
      const carried = applyDribbleStep(tick, player, ball, dribble);
      ball = advanceBall(carried.ball);
      dribble = carried.dribble;
    }

    // Keep W held while charging for ~150 ms.
    for (let tick = 48; tick < 57; tick += 1) {
      player = stepPlayerMovement(player, {
        moveX: 0,
        moveY: 1,
        aimYaw: 0,
        sprint: false,
        actionBits: PlayerActionBits.ShootHeld,
      }, WORLD, DT);
      const carried = applyDribbleStep(tick, player, ball, dribble);
      if (carried.touched && carried.dribble.lastContactTick === tick) setupTouchTicks.push(tick);
      ball = advanceBall(carried.ball);
      dribble = carried.dribble;
    }

    const releaseActor = actorSnapshot(player);
    const releaseBall = ballSnapshot(ball);
    const separation = Math.hypot(
      releaseBall.position.x - releaseActor.position.x,
      releaseBall.position.y - releaseActor.position.y,
      releaseBall.position.z - releaseActor.position.z,
    );
    const strike = createStrikeContactPlan({
      kind: 'shot',
      sourceId: 'held-run-integration',
      tick: 57,
      gaitPhase: player.athleticMotion.gaitPhase,
      strideSeconds: player.athleticMotion.strideSeconds,
      actorPosition: releaseActor.position,
      actorVelocity: releaseActor.velocity,
      ball: releaseBall,
      targetBallVelocity: { x: 0, y: 2.5, z: 24 },
      preferredFoot: 'right',
      balance: 1,
    });

    expect(strike, JSON.stringify({
      setupTouchTicks,
      separation,
      playerZ: releaseActor.position.z,
      playerSpeed: Math.hypot(releaseActor.velocity.x, releaseActor.velocity.z),
      ballZ: releaseBall.position.z,
      ballSpeed: Math.hypot(releaseBall.velocity.x, releaseBall.velocity.z),
      lastContactTick: dribble.lastContactTick,
      activePlan: dribble.activePlan?.reason ?? null,
    }, null, 2)).not.toBeNull();
    expect(strike!.contactTick - 57).toBeGreaterThanOrEqual(2);
    expect(strike!.contactTick - 57).toBeLessThanOrEqual(8);
  });
});
