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
});
