import { describe, expect, it } from 'vitest';
import { createStrikeContactPlan, stepStrikeContact } from './strikePlanner';
import type { FootballBallSnapshot, FootballVec3 } from './types';

const actorPosition: FootballVec3 = { x: 0, y: 0, z: 0 };
const ball: FootballBallSnapshot = {
  position: { x: 0.1, y: 0.11, z: 0.42 },
  velocity: { x: 0, y: 0, z: 0 },
  angularVelocity: { x: 0, y: 0, z: 0 },
  radius: 0.11,
  mass: 0.43,
  grounded: true,
};

const request = {
  kind: 'shot' as const,
  sourceId: 'shot-1',
  tick: 20,
  gaitPhase: 0.18,
  strideSeconds: 0.58,
  actorPosition,
  ball,
  targetBallVelocity: { x: 0, y: 4, z: 20 },
  preferredFoot: 'right' as const,
  balance: 1,
};

describe('strike contact planning', () => {
  it('starts support-step presentation immediately before a deterministic foot contact beat', () => {
    const plan = createStrikeContactPlan(request);
    expect(plan).not.toBeNull();
    expect(plan!.kind).toBe('shot');
    expect(plan!.foot).toBe('right');
    expect(plan!.prepareTick).toBe(request.tick);
    expect(plan!.contactTick).toBeGreaterThan(plan!.prepareTick);
    expect(plan!.eventId).toBe(createStrikeContactPlan(request)!.eventId);
  });

  it('waits through preparation and cancels if the ball leaves legal foot geometry', () => {
    const plan = createStrikeContactPlan(request)!;
    expect(stepStrikeContact(plan, plan.prepareTick, actorPosition, ball).status).toBe('preparing');
    const escaped = { ...ball, position: { x: 2, y: 0.11, z: 0.42 } };
    expect(stepStrikeContact(plan, plan.contactTick, actorPosition, escaped).status).toBe('missed');
  });

  it('keeps rushed off-balance strikes possible with degraded quality', () => {
    const balanced = createStrikeContactPlan(request)!;
    const rushed = createStrikeContactPlan({ ...request, tick: 20, balance: 0.25 })!;
    expect(rushed.quality).toBeLessThan(balanced.quality);
    expect(stepStrikeContact(rushed, rushed.contactTick, actorPosition, ball).status).toBe('contact');
  });

  it('gives the step-over a forgiving but bounded live contact envelope', () => {
    const plan = createStrikeContactPlan({ ...request, timingWindowTicks: 3, maximumContactReach: 0.92 })!;
    const slightlyWide = { ...ball, position: { x: 0.1, y: 0.11, z: 0.84 } };
    expect(stepStrikeContact(plan, plan.contactTick, actorPosition, slightlyWide).status).toBe('contact');
    const loose = { ...ball, position: { x: 0.1, y: 0.11, z: 1.0 } };
    expect(stepStrikeContact(plan, plan.contactTick, actorPosition, loose).status).toBe('missed');
  });

  it('does not give ordinary strikes the skill-move contact envelope', () => {
    const plan = createStrikeContactPlan({ ...request, timingWindowTicks: 3 })!;
    const outsideOrdinaryReach = { ...ball, position: { x: 0.1, y: 0.11, z: 0.8 } };
    expect(stepStrikeContact(plan, plan.contactTick, actorPosition, outsideOrdinaryReach).status).toBe('missed');
  });

  it('allows Elastico recovery range without turning it into unbounded magnet contact', () => {
    const plan = createStrikeContactPlan({ ...request, timingWindowTicks: 4, maximumContactReach: 1.04 })!;
    const recoveryTouch = { ...ball, position: { x: 0.1, y: 0.11, z: 0.9 } };
    const escaped = { ...ball, position: { x: 0.1, y: 0.11, z: 1.1 } };
    expect(stepStrikeContact(plan, plan.contactTick, actorPosition, recoveryTouch).status).toBe('contact');
    expect(stepStrikeContact(plan, plan.contactTick, actorPosition, escaped).status).toBe('missed');
  });

  it('supports the full planned step-over windup without throwing', () => {
    const plan = createStrikeContactPlan({ ...request, contactDelayTicks: 44, maximumContactReach: 1.16 });
    expect(plan?.contactTick).toBe(request.tick + 44);
  });
});
