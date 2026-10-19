import { describe, expect, test } from 'vitest';
import * as runtimeModule from './runtime';
import type { BallContactCommand, FootballBallSnapshot, FootballVec3 } from './types';

interface PlannedContactSeed {
  sourceId: string;
  kind: 'dribble' | 'trap' | 'pass' | 'shot';
  foot: 'left' | 'right';
  surface: 'inside' | 'outside' | 'instep' | 'sole' | 'toe';
  prepareTick: number;
  contactTick: number;
  recoveryEndTick: number;
  expectedBallPoint: FootballVec3;
  expectedFootPoint: FootballVec3;
  targetBallVelocity: FootballVec3;
  maxLinearImpulse: number;
  maxAngularImpulse: number;
  timingWindowTicks: number;
  geometryTolerance: number;
  quality: number;
  reason: string;
}

interface PlannedContact extends PlannedContactSeed {
  eventId: string;
}

interface ExecuteResult {
  applied: boolean;
  reason: string;
  ball: FootballBallSnapshot;
  consumedEventIds: readonly string[];
}

interface ContactPlanApi {
  createFootballContactPlan?: (seed: PlannedContactSeed) => PlannedContact;
  executePlannedFootballContact?: (input: {
    plan: PlannedContact | null;
    tick: number;
    actorPosition: FootballVec3;
    ball: FootballBallSnapshot;
    command: BallContactCommand;
    consumedEventIds?: readonly string[];
  }) => ExecuteResult;
}

const api = runtimeModule as unknown as ContactPlanApi;

const BALL: FootballBallSnapshot = {
  position: { x: 0.12, y: 0.11, z: 0.54 },
  velocity: { x: 0, y: 0, z: 2.4 },
  angularVelocity: { x: 0, y: 0, z: 0 },
  radius: 0.11,
  mass: 0.436,
  grounded: true,
};

const COMMAND: BallContactCommand = {
  kind: 'control-touch',
  deltaVelocity: { x: 0.3, y: 0, z: 1.1 },
  angularVelocityDelta: { x: 1, y: 0, z: -0.4 },
  maxImpulse: 4,
  diagnostic: 'stage05r-test',
};

function seed(overrides: Partial<PlannedContactSeed> = {}): PlannedContactSeed {
  return {
    sourceId: 'owner',
    kind: 'dribble',
    foot: 'right',
    surface: 'inside',
    prepareTick: 100,
    contactTick: 104,
    recoveryEndTick: 112,
    expectedBallPoint: { x: 0.12, y: 0.11, z: 0.54 },
    expectedFootPoint: { x: 0.1, y: 0.08, z: 0.5 },
    targetBallVelocity: { x: 0.5, y: 0, z: 4.8 },
    maxLinearImpulse: 4,
    maxAngularImpulse: 20,
    timingWindowTicks: 1,
    geometryTolerance: 0.18,
    quality: 0.92,
    reason: 'natural-right-stride',
    ...overrides,
  };
}

function requireApi(): Required<ContactPlanApi> | null {
  expect(typeof api.createFootballContactPlan).toBe('function');
  expect(typeof api.executePlannedFootballContact).toBe('function');
  if (!api.createFootballContactPlan || !api.executePlannedFootballContact) return null;
  return api as Required<ContactPlanApi>;
}

describe('Stage 05R football contact provenance', () => {
  test('same state creates the same foot surface contact tick and replay-safe event id', () => {
    const contactApi = requireApi();
    if (!contactApi) return;
    const a = contactApi.createFootballContactPlan(seed());
    const b = contactApi.createFootballContactPlan(seed());
    expect(a).toEqual(b);
    expect(a.eventId).toBeTruthy();
    expect(a.foot).toBe('right');
    expect(a.surface).toBe('inside');
    expect(a.contactTick).toBe(104);
  });

  test('a player ball impulse cannot happen without a legal contact plan', () => {
    const contactApi = requireApi();
    if (!contactApi) return;
    const result = contactApi.executePlannedFootballContact({
      plan: null,
      tick: 104,
      actorPosition: { x: 0, y: 0, z: 0 },
      ball: BALL,
      command: COMMAND,
    });
    expect(result.applied).toBe(false);
    expect(result.reason).toBe('no-plan');
    expect(result.ball).toEqual(BALL);
  });

  test('contact geometry is revalidated at the contact tick and a miss leaves the ball free', () => {
    const contactApi = requireApi();
    if (!contactApi) return;
    const plan = contactApi.createFootballContactPlan(seed());
    const missedBall: FootballBallSnapshot = {
      ...BALL,
      position: { x: 1.25, y: 0.11, z: 1.7 },
    };
    const result = contactApi.executePlannedFootballContact({
      plan,
      tick: plan.contactTick,
      actorPosition: { x: 0, y: 0, z: 0 },
      ball: missedBall,
      command: COMMAND,
    });
    expect(result.applied).toBe(false);
    expect(result.reason).toBe('geometry-miss');
    expect(result.ball).toEqual(missedBall);
  });

  test('a stale plan expires instead of silently chasing the ball forever', () => {
    const contactApi = requireApi();
    if (!contactApi) return;
    const plan = contactApi.createFootballContactPlan(seed());
    const result = contactApi.executePlannedFootballContact({
      plan,
      tick: plan.recoveryEndTick + 1,
      actorPosition: { x: 0, y: 0, z: 0 },
      ball: BALL,
      command: COMMAND,
    });
    expect(result.applied).toBe(false);
    expect(result.reason).toBe('expired');
    expect(result.ball).toEqual(BALL);
  });

  test('the same event id cannot apply twice during rollback or replay', () => {
    const contactApi = requireApi();
    if (!contactApi) return;
    const plan = contactApi.createFootballContactPlan(seed());
    const first = contactApi.executePlannedFootballContact({
      plan,
      tick: plan.contactTick,
      actorPosition: { x: 0, y: 0, z: 0 },
      ball: BALL,
      command: COMMAND,
    });
    expect(first.applied).toBe(true);
    expect(first.consumedEventIds).toContain(plan.eventId);

    const second = contactApi.executePlannedFootballContact({
      plan,
      tick: plan.contactTick,
      actorPosition: { x: 0, y: 0, z: 0 },
      ball: first.ball,
      command: COMMAND,
      consumedEventIds: first.consumedEventIds,
    });
    expect(second.applied).toBe(false);
    expect(second.reason).toBe('already-consumed');
    expect(second.ball).toEqual(first.ball);
  });
});
