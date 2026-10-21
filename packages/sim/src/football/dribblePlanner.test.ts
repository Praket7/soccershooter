import { describe, expect, test } from 'vitest';
import { BALL_CONSTANTS, createBallState } from '../../../physics/src/ball/BallState';
import { MATCH_BALL_PROFILE } from '../../../physics/src/ball/aerodynamics';
import { BALL_SUBSTEP_DT, stepBall } from '../../../physics/src/ball/trajectory';
import { createPlayerState } from '../player/PlayerState';
import { createFlatMovementWorld, DEFAULT_MOVEMENT_CONFIG, stepPlayerMovement } from '../player/movement';
import type { AthleticMotionState } from '../player/athleticMotion';
import * as runtimeModule from './runtime';
import type { FootballActorSnapshot, FootballBallSnapshot, FootballHorizontalDirection } from './types';

interface PlannerState {
  activePlan: null | {
    eventId: string;
    kind: 'dribble' | 'trap' | 'pass' | 'shot';
    foot: 'left' | 'right';
    surface: 'inside' | 'outside' | 'instep' | 'sole' | 'toe';
    prepareTick: number;
    contactTick: number;
    recoveryEndTick: number;
    expectedBallPoint: { x: number; y: number; z: number };
    expectedFootPoint: { x: number; y: number; z: number };
    targetBallVelocity: { x: number; y: number; z: number };
  };
  consumedEventIds: readonly string[];
  lastContactTick: number;
  lastContactFoot: 'left' | 'right' | null;
  looseBall: boolean;
}

interface PlannerStep {
  state: PlannerState;
  ball: FootballBallSnapshot;
  contactApplied: boolean;
  reason: string;
}

interface PlannerApi {
  createPlannedDribbleState?: () => PlannerState;
  stepPlannedDribble?: (input: {
    tick: number;
    state: Readonly<PlannerState>;
    actor: Readonly<FootballActorSnapshot>;
    motion: Readonly<AthleticMotionState>;
    ball: Readonly<FootballBallSnapshot>;
    desiredDirection: FootballHorizontalDirection;
    precision: boolean;
    sprint: boolean;
    pressure: number;
    moveIntentMagnitude: number;
    receiveMode?: 'kill' | 'controlled-exit' | null;
  }) => PlannerStep;
  stepTechniqueCarry?: (input: Parameters<NonNullable<PlannerApi['stepPlannedDribble']>>[0] & {
    techniqueContactTick: number;
    reserveContactTicks: number;
  }) => PlannerStep | null;
}

const api = runtimeModule as unknown as PlannerApi;

function requireApi(): Required<PlannerApi> | null {
  expect(typeof api.createPlannedDribbleState).toBe('function');
  expect(typeof api.stepPlannedDribble).toBe('function');
  if (!api.createPlannedDribbleState || !api.stepPlannedDribble) return null;
  return api as Required<PlannerApi>;
}

function actor(speed = 4.4): FootballActorSnapshot {
  return {
    position: { x: 0, y: 0, z: 0 },
    velocity: { x: 0, y: 0, z: speed },
    facingYaw: 0,
    balance: 1,
    pressure: 0,
    sprinting: false,
    preferredFoot: 'right',
  };
}

function ball(overrides: Partial<FootballBallSnapshot> = {}): FootballBallSnapshot {
  return {
    position: { x: 0, y: 0.11, z: 0.58 },
    velocity: { x: 0, y: 0, z: 4.2 },
    angularVelocity: { x: 4.2 / 0.11, y: 0, z: 0 },
    radius: 0.11,
    mass: 0.436,
    grounded: true,
    ...overrides,
  };
}

function motion(overrides: Partial<AthleticMotionState> = {}): AthleticMotionState {
  return {
    gait: 'jog',
    gaitPhase: 0.18,
    supportFoot: 'left',
    nextFoot: 'right',
    strideSeconds: 0.42,
    plantIntensity: 0,
    turnDemand: 0,
    bodyYaw: 0,
    bodyYawRate: 0,
    brakingDemand: 0,
    propulsionDemand: 0.9,
    bodyLean: { forward: 0.12, lateral: 0 },
    realizedAcceleration: { x: 0, z: 0 },
    plannedVelocity: { x: 0, z: 5.0 },
    trajectory: [
      { time: 0.15, position: { x: 0, z: 0.68 }, velocity: { x: 0, z: 4.7 } },
      { time: 0.30, position: { x: 0, z: 1.41 }, velocity: { x: 0, z: 5.0 } },
      { time: 0.45, position: { x: 0, z: 2.16 }, velocity: { x: 0, z: 5.0 } },
    ],
    ...overrides,
  };
}

function step(
  plannerApi: Required<PlannerApi>,
  state: PlannerState,
  tick: number,
  options: {
    actor?: FootballActorSnapshot;
    ball?: FootballBallSnapshot;
    motion?: AthleticMotionState;
    direction?: FootballHorizontalDirection;
    precision?: boolean;
    move?: number;
    receiveMode?: 'kill' | 'controlled-exit' | null;
  } = {},
): PlannerStep {
  return plannerApi.stepPlannedDribble({
    tick,
    state,
    actor: options.actor ?? actor(),
    motion: options.motion ?? motion(),
    ball: options.ball ?? ball(),
    desiredDirection: options.direction ?? { x: 0, z: 1 },
    precision: options.precision ?? false,
    sprint: false,
    pressure: 0,
    moveIntentMagnitude: options.move ?? 1,
    receiveMode: options.receiveMode ?? null,
  });
}

describe('Stage 05R contact-planned normal and precision dribbling', () => {
  test('skill windup keeps gait-timed carry contacts active until its reserved move-contact window', () => {
    expect(typeof api.stepTechniqueCarry).toBe('function');
    const plannerApi = requireApi();
    if (!plannerApi || !api.stepTechniqueCarry) return;
    const input = {
      tick: 10,
      state: plannerApi.createPlannedDribbleState(),
      actor: actor(),
      motion: motion(),
      ball: ball(),
      desiredDirection: { x: 0, z: 1 },
      precision: false,
      sprint: false,
      pressure: 0,
      moveIntentMagnitude: 1,
      techniqueContactTick: 54,
      reserveContactTicks: 6,
    };
    const windup = plannerApi.stepTechniqueCarry(input);
    expect(windup?.state.activePlan).not.toBeNull();
    expect(windup?.contactApplied).toBe(false);

    const contactTick = windup!.state.activePlan!.contactTick;
    const carryContact = plannerApi.stepTechniqueCarry({
      ...input,
      tick: contactTick,
      state: windup!.state,
      ball: ball({ position: { ...windup!.state.activePlan!.expectedBallPoint } }),
    });
    expect(carryContact?.contactApplied).toBe(true);
    expect(plannerApi.stepTechniqueCarry({ ...input, tick: 48 })).toBeNull();
  });

  test('a skill windup keeps the ball in the runner pocket through live cuts', () => {
    expect(typeof api.stepTechniqueCarry).toBe('function');
    const plannerApi = requireApi();
    if (!plannerApi || !api.stepTechniqueCarry) return;
    let state = plannerApi.createPlannedDribbleState();
    let player = createPlayerState({ stamina: DEFAULT_MOVEMENT_CONFIG.staminaMax });
    let liveBall = createBallState({
      position: { x: 0, y: BALL_CONSTANTS.radius, z: 0.68 },
      grounded: true,
    });
    let maximumSeparation = 0;
    let carryContacts = 0;
    const world = createFlatMovementWorld({ minX: -100, maxX: 100, minZ: -100, maxZ: 100 });

    for (let tick = 0; tick < 38; tick += 1) {
      const moveX = tick < 10 ? 0 : tick < 24 ? -0.6 : 0.6;
      const moveY = 1;
      player = stepPlayerMovement(player, {
        moveX, moveY, aimYaw: 0, sprint: true, actionBits: 0,
      }, world, 1 / 60);
      const rawDirection = { x: -moveX, z: moveY };
      const directionLength = Math.hypot(rawDirection.x, rawDirection.z);
      const direction = { x: rawDirection.x / directionLength, z: rawDirection.z / directionLength };
      const runner: FootballActorSnapshot = {
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
      const liveBallSnapshot: FootballBallSnapshot = {
        position: { ...liveBall.position },
        velocity: { ...liveBall.velocity },
        angularVelocity: { ...liveBall.angularVelocity },
        radius: BALL_CONSTANTS.radius,
        mass: BALL_CONSTANTS.mass,
        grounded: liveBall.grounded,
      };
      const result = api.stepTechniqueCarry({
        tick,
        state,
        actor: runner,
        motion: player.athleticMotion,
        ball: liveBallSnapshot,
        desiredDirection: direction,
        precision: false,
        sprint: true,
        pressure: 0,
        moveIntentMagnitude: 1,
        techniqueContactTick: 44,
        reserveContactTicks: 6,
      });
      expect(result).not.toBeNull();
      state = result!.state;
      if (result!.contactApplied) {
        carryContacts += 1;
        liveBall = {
          ...liveBall,
          velocity: { ...result!.ball.velocity },
          angularVelocity: { ...result!.ball.angularVelocity },
        };
      }
      maximumSeparation = Math.max(maximumSeparation,
        Math.hypot(liveBall.position.x - player.position.x, liveBall.position.z - player.position.z));
      liveBall = stepBall(liveBall, BALL_SUBSTEP_DT, MATCH_BALL_PROFILE, null);
      liveBall = stepBall(liveBall, BALL_SUBSTEP_DT, MATCH_BALL_PROFILE, null);
    }

    expect(carryContacts).toBeGreaterThanOrEqual(3);
    expect(state.looseBall).toBe(false);
    expect(maximumSeparation).toBeLessThan(1.25);
  });

  test('standing still beside a settled ball produces no repeated micro-touch plan', () => {
    const plannerApi = requireApi();
    if (!plannerApi) return;
    const initial = plannerApi.createPlannedDribbleState();
    const result = step(plannerApi, initial, 40, {
      actor: actor(0),
      ball: ball({ velocity: { x: 0, y: 0, z: 0 }, angularVelocity: { x: 0, y: 0, z: 0 } }),
      motion: motion({ gait: 'idle', supportFoot: 'both', plannedVelocity: { x: 0, z: 0 }, trajectory: [] }),
      move: 0,
    });
    expect(result.contactApplied).toBe(false);
    expect(result.state.activePlan).toBeNull();
    expect(result.ball).toEqual(ball({ velocity: { x: 0, y: 0, z: 0 }, angularVelocity: { x: 0, y: 0, z: 0 } }));
  });

  test('straight jog schedules a real foot contact and leaves the ball untouched before that tick', () => {
    const plannerApi = requireApi();
    if (!plannerApi) return;
    const initialBall = ball();
    const planned = step(plannerApi, plannerApi.createPlannedDribbleState(), 100, { ball: initialBall });
    expect(planned.contactApplied).toBe(false);
    expect(planned.state.activePlan).not.toBeNull();
    expect(planned.ball).toEqual(initialBall);
    expect(planned.state.activePlan?.foot).toBe('right');
    expect(planned.state.activePlan?.contactTick).toBeGreaterThan(100);

    const beforeContact = step(plannerApi, planned.state, planned.state.activePlan!.contactTick - 1, { ball: initialBall });
    expect(beforeContact.contactApplied).toBe(false);
    expect(beforeContact.ball).toEqual(initialBall);
  });

  test('successive clean carry contacts alternate feet instead of selecting a random preferred foot every time', () => {
    const plannerApi = requireApi();
    if (!plannerApi) return;
    const firstPlan = step(plannerApi, plannerApi.createPlannedDribbleState(), 10);
    const plan = firstPlan.state.activePlan!;
    const contactBall = ball({ position: { ...plan.expectedBallPoint } });
    const firstContact = step(plannerApi, firstPlan.state, plan.contactTick, { ball: contactBall });
    expect(firstContact.contactApplied).toBe(true);
    expect(firstContact.state.lastContactFoot).toBe('right');

    const next = step(plannerApi, firstContact.state, plan.contactTick + 1, {
      ball: firstContact.ball,
      motion: motion({ supportFoot: 'right', nextFoot: 'left', gaitPhase: 0.62 }),
    });
    expect(next.state.activePlan).not.toBeNull();
    expect(next.state.activePlan?.foot).toBe('left');
  });

  test('a laterally wide but reachable ball moves the planned foot intercept rather than receiving an immediate lateral servo impulse', () => {
    const plannerApi = requireApi();
    if (!plannerApi) return;
    const wideBall = ball({
      position: { x: 0.34, y: 0.11, z: 0.58 },
      velocity: { x: 0.15, y: 0, z: 4.0 },
    });
    const result = step(plannerApi, plannerApi.createPlannedDribbleState(), 20, { ball: wideBall });
    expect(result.contactApplied).toBe(false);
    expect(result.ball).toEqual(wideBall);
    expect(result.state.activePlan).not.toBeNull();
    expect(result.state.activePlan!.expectedFootPoint.x).toBeGreaterThan(0.22);
  });

  test('precision control plans a lower-speed, earlier next contact than normal carry', () => {
    const plannerApi = requireApi();
    if (!plannerApi) return;
    const normal = step(plannerApi, plannerApi.createPlannedDribbleState(), 50);
    const precision = step(plannerApi, plannerApi.createPlannedDribbleState(), 50, { precision: true });
    const normalSpeed = Math.hypot(normal.state.activePlan!.targetBallVelocity.x, normal.state.activePlan!.targetBallVelocity.z);
    const precisionSpeed = Math.hypot(precision.state.activePlan!.targetBallVelocity.x, precision.state.activePlan!.targetBallVelocity.z);
    expect(precisionSpeed).toBeLessThan(normalSpeed);
    expect(precision.state.activePlan!.contactTick).toBeLessThanOrEqual(normal.state.activePlan!.contactTick);
  });

  test('explicit receive kill is a distinct planned sole contact', () => {
    const plannerApi = requireApi();
    if (!plannerApi) return;
    const result = step(plannerApi, plannerApi.createPlannedDribbleState(), 70, {
      actor: actor(0.2),
      ball: ball({ velocity: { x: 0, y: 0, z: 5.4 } }),
      move: 0,
      receiveMode: 'kill',
    });
    expect(result.state.activePlan?.kind).toBe('trap');
    expect(result.state.activePlan?.surface).toBe('sole');
  });

  test('an overrun contact becomes a genuine loose-ball state instead of silently recentering', () => {
    const plannerApi = requireApi();
    if (!plannerApi) return;
    const planned = step(plannerApi, plannerApi.createPlannedDribbleState(), 90);
    const contactTick = planned.state.activePlan!.contactTick;
    const escaped = ball({ position: { x: 1.6, y: 0.11, z: 2.1 }, velocity: { x: 1.2, y: 0, z: 5.5 } });
    const miss = step(plannerApi, planned.state, contactTick, { ball: escaped });
    expect(miss.contactApplied).toBe(false);
    expect(miss.state.looseBall).toBe(true);
    expect(miss.state.activePlan).toBeNull();
    expect(miss.ball).toEqual(escaped);
  });

  test('a missed touch stays dispossessed until the player turns back and recovers the ball', () => {
    const plannerApi = requireApi();
    if (!plannerApi) return;
    const planned = step(plannerApi, plannerApi.createPlannedDribbleState(), 90);
    const contactTick = planned.state.activePlan!.contactTick;
    const escaped = ball({ position: { x: 1.6, y: 0.11, z: 2.1 }, velocity: { x: 1.2, y: 0, z: 5.5 } });
    const lost = step(plannerApi, planned.state, contactTick, { ball: escaped });

    expect(lost.state.looseBall).toBe(true);
    expect(lost.state.activePlan).toBeNull();
    expect(lost.reason).toBe('geometry-miss');

    const stillLost = step(plannerApi, lost.state, contactTick + 1, { ball: escaped });
    expect(stillLost.state.looseBall).toBe(true);
    expect(stillLost.reason).toBe('loose-ball-chase');

    const recovered = step(plannerApi, stillLost.state, 14, {
      ball: ball({ position: { x: 0, y: 0.11, z: 0.58 } }),
    });
    expect(recovered.state.looseBall).toBe(false);
    expect(recovered.reason).toBe('contact-planned');
  });
});
