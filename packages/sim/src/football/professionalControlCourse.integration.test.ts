import { describe, expect, test } from 'vitest';
import { BALL_CONSTANTS, createBallState, type BallState } from '../../../physics/src/ball/BallState';
import { MATCH_BALL_PROFILE } from '../../../physics/src/ball/aerodynamics';
import { BALL_SUBSTEP_DT, stepBall } from '../../../physics/src/ball/trajectory';
import { createPlayerState, type PlayerState } from '../player/PlayerState';
import { createFlatMovementWorld, DEFAULT_MOVEMENT_CONFIG, stepPlayerMovement } from '../player/movement';
import { stepPlannedDribble, createPlannedDribbleState } from './dribblePlanner';
import type { FootballActorSnapshot, FootballBallSnapshot } from './types';

const DT = 1 / 60;
const WORLD = createFlatMovementWorld({ minX: -100, maxX: 100, minZ: -100, maxZ: 100 });

function actorSnapshot(player: Readonly<PlayerState>): FootballActorSnapshot {
  const speed = Math.hypot(player.velocity.x, player.velocity.z);
  return {
    position: { ...player.position },
    velocity: { ...player.velocity },
    facingYaw: speed > 0.35 ? Math.atan2(player.velocity.x, player.velocity.z) : player.facingYaw,
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

describe('planned physical control integration', () => {
  test('each dribble impulse consumes a unique foot plan and leaves the ball free between contacts', () => {
    let player = createPlayerState({
      position: { x: 0, y: 0, z: -13 },
      facingYaw: 0,
      stamina: DEFAULT_MOVEMENT_CONFIG.staminaMax,
    });
    let ball = createBallState({ position: { x: 0, y: BALL_CONSTANTS.radius, z: -12.32 }, grounded: true });
    let dribble = createPlannedDribbleState();
    let observedFreeFrames = 0;
    const eventIds = new Set<string>();

    for (let tick = 0; tick < 180; tick += 1) {
      player = stepPlayerMovement(player, {
        moveX: 0,
        moveY: 1,
        aimYaw: 0,
        sprint: false,
        actionBits: 0,
      }, WORLD, DT);
      const previousPlan = dribble.activePlan;
      const beforeBall = ballSnapshot(ball);
      const result = stepPlannedDribble({
        tick,
        state: dribble,
        actor: actorSnapshot(player),
        motion: player.athleticMotion,
        ball: beforeBall,
        desiredDirection: { x: 0, z: 1 },
        precision: false,
        sprint: false,
        pressure: 0,
        moveIntentMagnitude: 1,
      });
      dribble = result.state;

      if (result.contactApplied) {
        expect(previousPlan).not.toBeNull();
        expect(previousPlan?.kind).toBe('dribble');
        expect(previousPlan?.foot).toMatch(/^(left|right)$/);
        expect(previousPlan?.contactTick).toBe(tick);
        expect(eventIds.has(previousPlan!.eventId)).toBe(false);
        eventIds.add(previousPlan!.eventId);
        expect(dribble.consumedEventIds).toContain(previousPlan!.eventId);
      } else {
        expect(result.ball).toEqual(beforeBall);
        observedFreeFrames += 1;
      }

      ball = { ...ball, velocity: { ...result.ball.velocity }, angularVelocity: { ...result.ball.angularVelocity } };
      ball = stepBall(ball, BALL_SUBSTEP_DT, MATCH_BALL_PROFILE, null);
      ball = stepBall(ball, BALL_SUBSTEP_DT, MATCH_BALL_PROFILE, null);
    }

    expect(eventIds.size).toBeGreaterThan(3);
    expect(observedFreeFrames).toBeGreaterThan(150);
  });

  test('a high-speed 180-degree request produces measurable braking before the reversal completes', () => {
    let player = createPlayerState({
      position: { x: 0, y: 0, z: 0 },
      velocity: { x: 0, y: 0, z: 8 },
      facingYaw: 0,
      stamina: DEFAULT_MOVEMENT_CONFIG.staminaMax,
    });
    const initialSpeed = Math.hypot(player.velocity.x, player.velocity.z);
    for (let tick = 0; tick < 6; tick += 1) {
      player = stepPlayerMovement(player, {
        moveX: 0,
        moveY: -1,
        aimYaw: 0,
        sprint: true,
        actionBits: 0,
      }, WORLD, DT);
    }
    const brakingSpeed = Math.hypot(player.velocity.x, player.velocity.z);
    // Six 60 Hz ticks are only 100 ms. Measured sprint deceleration sits near
    // 7–8 m/s², so braking is visible but does not instantly erase momentum.
    expect(brakingSpeed).toBeLessThan(initialSpeed * 0.90);
    expect(brakingSpeed).toBeGreaterThan(initialSpeed * 0.70);
    expect(player.position.z).toBeGreaterThan(0);
  });
});
