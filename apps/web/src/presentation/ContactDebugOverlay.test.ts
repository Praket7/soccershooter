import { describe, expect, test } from 'vitest';
import { Scene } from 'three';
import { createFootballContactPlan } from '../../../../packages/sim/src/football/contactPlan';
import { ContactDebugOverlay } from './ContactDebugOverlay';

describe('Stage 05R training contact ghost', () => {
  test('shows the planned foot, surface, and contact timing only when debug is enabled', () => {
    const scene = new Scene();
    const overlay = new ContactDebugOverlay(scene);
    const plan = createFootballContactPlan({
      sourceId: 'ghost-test',
      kind: 'dribble',
      foot: 'left',
      surface: 'outside',
      prepareTick: 4,
      contactTick: 10,
      recoveryEndTick: 18,
      expectedBallPoint: { x: -0.2, y: 0.11, z: 0.45 },
      expectedFootPoint: { x: -0.2, y: 0.05, z: 0.25 },
      targetBallVelocity: { x: 0, y: 0, z: 4 },
      maxLinearImpulse: 2,
      maxAngularImpulse: 12,
      timingWindowTicks: 1,
      geometryTolerance: 0.2,
      quality: 0.9,
      reason: 'planned-dribble',
    });

    overlay.update(plan, 7);
    expect(overlay.group.visible).toBe(false);

    overlay.setEnabled(true);
    overlay.update(plan, 7);
    expect(overlay.group.visible).toBe(true);
    expect(overlay.label).toContain('LEFT');
    expect(overlay.label).toContain('OUTSIDE');
    expect(overlay.label).toContain('3 TICKS');
    expect(overlay.footMarker.position.x).toBeCloseTo(plan.expectedFootPoint.x);
    expect(overlay.footMarker.position.z).toBeCloseTo(plan.expectedFootPoint.z);

    overlay.update(plan, plan.contactTick);
    expect(overlay.label).toContain('CONTACT');
    overlay.setEnabled(false);
    expect(overlay.group.visible).toBe(false);
    overlay.dispose();
  });
});
