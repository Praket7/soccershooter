import { describe, expect, test } from 'vitest';
import { BALL_CONSTANTS, createBallState, type BallState } from '../../../physics/src/ball/BallState';
import { MATCH_BALL_PROFILE } from '../../../physics/src/ball/aerodynamics';
import { BALL_SUBSTEP_DT, stepBall } from '../../../physics/src/ball/trajectory';
import { createPlayerState, type PlayerState } from '../player/PlayerState';
import { createFlatMovementWorld, DEFAULT_MOVEMENT_CONFIG, stepPlayerMovement } from '../player/movement';
import * as runtimeModule from './runtime';
import type { FootballActorSnapshot, FootballBallSnapshot } from './types';

const DT = 1 / 60;
const WORLD = createFlatMovementWorld({ minX: -100, maxX: 100, minZ: -100, maxZ: 100 });

interface PlannerState {
  activePlan: null | { foot: 'left' | 'right'; contactTick: number };
  consumedEventIds: readonly string[];
  lastContactTick: number;
  lastContactFoot: 'left' | 'right' | null;
  looseBall: boolean;
}

interface PlannerApi {
  createPlannedDribbleState?: () => PlannerState;
  stepPlannedDribble?: (input: any) => {
    state: PlannerState;
    ball: FootballBallSnapshot;
    contactApplied: boolean;
    reason: string;
  };
}

const api = runtimeModule as unknown as PlannerApi;

function requireApi(): Required<PlannerApi> | null {
  expect(typeof api.createPlannedDribbleState).toBe('function');
  expect(typeof api.stepPlannedDribble).toBe('function');
  if (!api.createPlannedDribbleState || !api.stepPlannedDribble) return null;
  return api as Required<PlannerApi>;
}

function actor(player: Readonly<PlayerState>): FootballActorSnapshot {
  const speed = Math.hypot(player.velocity.x, player.velocity.z);
  return {
    position: { ...player.position },
    velocity: { ...player.velocity },
    facingYaw: speed > 0.3 ? Math.atan2(player.velocity.x, player.velocity.z) : player.facingYaw,
    balance: player.athleticMotion.gait === 'plant' ? 0.76 : 1,
    pressure: 0,
    sprinting: false,
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

function separation(player: Readonly<PlayerState>, ball: Readonly<BallState>): number {
  return Math.hypot(player.position.x - ball.position.x, player.position.z - ball.position.z);
}

describe('Stage 05R planned-contact dribble integration', () => {
  test('three seconds of straight jog is a sequence of alternating physical contacts with free-ball travel between them', () => {
    const plannerApi = requireApi();
    if (!plannerApi) return;

    let player = createPlayerState({ position: { x: 0, y: 0, z: 0 }, facingYaw: 0 });
    let ball = createBallState({ position: { x: 0, y: BALL_CONSTANTS.radius, z: 0.68 }, grounded: true });
    let planner = plannerApi.createPlannedDribbleState();
    const contactTicks: number[] = [];
    const feet: Array<'left' | 'right'> = [];
    let freeTravelFrames = 0;
    let maxSeparation = separation(player, ball);

    for (let tick = 0; tick < 180; tick += 1) {
      player = stepPlayerMovement(player, {
        moveX: 0,
        moveY: 1,
        aimYaw: 0,
        sprint: false,
        actionBits: 0,
      }, WORLD, DT, DEFAULT_MOVEMENT_CONFIG);

      const beforePosition = { ...ball.position };
      const result = plannerApi.stepPlannedDribble({
        tick,
        state: planner,
        actor: actor(player),
        motion: player.athleticMotion,
        ball: snapshot(ball),
        desiredDirection: { x: 0, z: 1 },
        precision: false,
        sprint: false,
        pressure: 0,
        moveIntentMagnitude: 1,
        receiveMode: null,
      });
      planner = result.state;

      if (result.contactApplied) {
        expect(result.ball.position).toEqual(beforePosition);
        ball = {
          ...ball,
          velocity: { ...result.ball.velocity },
          angularVelocity: { ...result.ball.angularVelocity },
        };
        contactTicks.push(tick);
        if (planner.lastContactFoot) feet.push(planner.lastContactFoot);
      } else if (Math.hypot(ball.velocity.x, ball.velocity.z) > 0.2) {
        freeTravelFrames += 1;
      }

      ball = stepBall(ball, BALL_SUBSTEP_DT, MATCH_BALL_PROFILE, null);
      ball = stepBall(ball, BALL_SUBSTEP_DT, MATCH_BALL_PROFILE, null);
      maxSeparation = Math.max(maxSeparation, separation(player, ball));
    }

    expect(contactTicks.length).toBeGreaterThanOrEqual(6);
    expect(contactTicks.length).toBeLessThanOrEqual(14);
    expect(new Set(feet)).toEqual(new Set(['left', 'right']));
    expect(freeTravelFrames).toBeGreaterThan(80);
    expect(maxSeparation).toBeLessThan(1.65);

    for (let index = 1; index < contactTicks.length; index += 1) {
      expect(contactTicks[index]! - contactTicks[index - 1]!).toBeGreaterThanOrEqual(10);
    }
  });
});
