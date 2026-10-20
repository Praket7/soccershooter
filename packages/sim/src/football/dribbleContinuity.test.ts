import { describe, expect, test } from 'vitest';
import { createFootballContactPlan } from './contactPlan';
import { suspendPlannedDribble } from './dribbleContinuity';
import type { PlannedDribbleState } from './dribblePlanner';

describe('professional dribble action continuity', () => {
  test('suspending control for a shot clears only the pending intercept and preserves foot cadence', () => {
    const activePlan = createFootballContactPlan({
      sourceId: 'continuity-test',
      kind: 'dribble',
      foot: 'right',
      surface: 'instep',
      prepareTick: 38,
      contactTick: 42,
      recoveryEndTick: 47,
      expectedBallPoint: { x: 0.1, y: 0.11, z: 2.2 },
      expectedFootPoint: { x: 0.1, y: 0.06, z: 2.2 },
      targetBallVelocity: { x: 0, y: 0, z: 4.8 },
      maxLinearImpulse: 3.8,
      maxAngularImpulse: 120,
      timingWindowTicks: 2,
      geometryTolerance: 0.29,
      quality: 0.95,
      reason: 'normal-right-instep',
    });
    const state: PlannedDribbleState = {
      activePlan,
      consumedEventIds: ['contact:already-used'],
      lastContactTick: 31,
      lastContactFoot: 'left',
      looseBall: false,
    };

    const suspended = suspendPlannedDribble(state);
    expect(suspended.activePlan).toBeNull();
    expect(suspended.lastContactTick).toBe(31);
    expect(suspended.lastContactFoot).toBe('left');
    expect(suspended.consumedEventIds).toEqual(['contact:already-used']);
    expect(suspended.looseBall).toBe(false);
    expect(suspended.consumedEventIds).not.toBe(state.consumedEventIds);
  });
});
