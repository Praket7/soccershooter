import { describe, expect, test } from 'vitest';
import { BALL_CONSTANTS, createBallState, type BallState } from '../../../physics/src/ball/BallState';
import { MATCH_BALL_PROFILE } from '../../../physics/src/ball/aerodynamics';
import { BALL_SUBSTEP_DT, stepBall } from '../../../physics/src/ball/trajectory';
import { createPlayerState, PlayerActionBits, type PlayerState } from '../player/PlayerState';
import { createFlatMovementWorld, stepPlayerMovement } from '../player/movement';
import { createPlannedDribbleState, stepPlannedDribble, type PlannedDribbleState } from './dribblePlanner';
import { buildShot } from './shooting';
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

function runReleaseAt(chargeStartTick: number) {
  let player = createPlayerState({ position: { x: 0, y: 0, z: -13 }, facingYaw: 0 });
  let ball = createBallState({ position: { x: 0, y: BALL_CONSTANTS.radius, z: -12.32 }, grounded: true });
  let dribble = createPlannedDribbleState();
  const chargeTicks = 9;
  const releaseTick = chargeStartTick + chargeTicks;
  const setupTouchTicks: number[] = [];

  for (let tick = 0; tick < releaseTick; tick += 1) {
    const charging = tick >= chargeStartTick;
    player = stepPlayerMovement(player, {
      moveX: 0,
      moveY: 1,
      aimYaw: 0,
      sprint: false,
      actionBits: charging ? PlayerActionBits.ShootHeld : 0,
    }, WORLD, DT);
    const carried = applyDribbleStep(tick, player, ball, dribble);
    if (charging && carried.touched && carried.dribble.lastContactTick === tick) setupTouchTicks.push(tick);
    ball = advanceBall(carried.ball);
    dribble = carried.dribble;
  }

  const releaseActor = actorSnapshot(player);
  const releaseBall = ballSnapshot(ball);
  const shot = buildShot({
    style: 'normal',
    shooter: releaseActor,
    ball: releaseBall,
    aim: { x: 0, z: 1 },
    charge: 0.55,
    spinInput: 0.18,
    pressure: 0,
    balance: releaseActor.balance,
    contactFoot: 'right',
  });
  const strike = shot.command ? createStrikeContactPlan({
    kind: 'shot',
    sourceId: `held-run-${chargeStartTick}`,
    tick: releaseTick,
    gaitPhase: player.athleticMotion.gaitPhase,
    strideSeconds: player.athleticMotion.strideSeconds,
    actorPosition: releaseActor.position,
    actorVelocity: releaseActor.velocity,
    ball: releaseBall,
    targetBallVelocity: shot.launchVelocity,
    preferredFoot: 'right',
    balance: releaseActor.balance,
  }) : null;

  return {
    chargeStartTick,
    releaseTick,
    player,
    releaseActor,
    releaseBall,
    dribble,
    setupTouchTicks,
    shot,
    strike,
    separation: Math.hypot(
      releaseBall.position.x - releaseActor.position.x,
      releaseBall.position.y - releaseActor.position.y,
      releaseBall.position.z - releaseActor.position.z,
    ),
  };
}

function diagnostic(result: ReturnType<typeof runReleaseAt>): string {
  return JSON.stringify({
    chargeStartTick: result.chargeStartTick,
    releaseTick: result.releaseTick,
    setupTouchTicks: result.setupTouchTicks,
    separation: result.separation,
    gaitPhase: result.player.athleticMotion.gaitPhase,
    playerZ: result.releaseActor.position.z,
    playerSpeed: Math.hypot(result.releaseActor.velocity.x, result.releaseActor.velocity.z),
    ballZ: result.releaseBall.position.z,
    ballSpeed: Math.hypot(result.releaseBall.velocity.x, result.releaseBall.velocity.z),
    shotLegal: result.shot.legal,
    shotReason: result.shot.reason,
    lastContactTick: result.dribble.lastContactTick,
    activePlan: result.dribble.activePlan?.reason ?? null,
  }, null, 2);
}

describe('held-run carry to strike integration', () => {
  test('150 ms W+shot release stays legal across plausible running gait phases', () => {
    for (let chargeStartTick = 22; chargeStartTick <= 58; chargeStartTick += 2) {
      const result = runReleaseAt(chargeStartTick);
      expect(result.shot.legal, diagnostic(result)).toBe(true);
      expect(result.shot.command, diagnostic(result)).toBeDefined();
      expect(result.strike, diagnostic(result)).not.toBeNull();
      expect(result.strike!.contactTick - result.releaseTick, diagnostic(result)).toBeGreaterThanOrEqual(2);
      expect(result.strike!.contactTick - result.releaseTick, diagnostic(result)).toBeLessThanOrEqual(8);
    }
  });
});
