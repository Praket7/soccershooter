import { describe, expect, test } from 'vitest';
import { Scene } from 'three';
import { createFootballContactPlan } from '../../../../packages/sim/src/football/contactPlan';
import { createPlayerState } from '../../../../packages/sim/src/player/PlayerState';
import { ProceduralAthleteProxy } from './ProceduralAthleteProxy';

function contactPlan(expectedFootPoint: { x: number; y: number; z: number }) {
  return createFootballContactPlan({
    sourceId: 'proxy-test',
    kind: 'dribble',
    foot: 'right',
    surface: 'inside',
    prepareTick: 4,
    contactTick: 10,
    recoveryEndTick: 18,
    expectedBallPoint: { x: expectedFootPoint.x, y: 0.11, z: expectedFootPoint.z + 0.2 },
    expectedFootPoint,
    targetBallVelocity: { x: 0, y: 0, z: 3 },
    maxLinearImpulse: 2,
    maxAngularImpulse: 12,
    timingWindowTicks: 1,
    geometryTolerance: 0.2,
    quality: 0.9,
    reason: 'planned-dribble',
  });
}

describe('Stage 05R procedural athlete proxy', () => {
  test('keeps its support foot within the plant-slide tolerance while the root moves', () => {
    const proxy = new ProceduralAthleteProxy(new Scene());
    const moving = createPlayerState({ position: { x: 0, y: 0, z: 0 }, facingYaw: 0 });
    const planted = {
      ...moving,
      position: { x: 0, y: 0, z: 0 },
      athleticMotion: {
        ...moving.athleticMotion,
        gait: 'plant' as const,
        supportFoot: 'left' as const,
        plantIntensity: 0.8,
      },
    };

    proxy.update({ player: planted, simulationTick: 20, interpolationAlpha: 0 });
    const plantedFoot = proxy.getFootWorldPosition('left');
    proxy.update({
      player: { ...planted, position: { x: 0.03, y: 0, z: 0.02 } },
      simulationTick: 21,
      interpolationAlpha: 0.8,
    });
    const movedFoot = proxy.getFootWorldPosition('left');

    expect(plantedFoot.distanceTo(movedFoot)).toBeLessThanOrEqual(0.06);
    proxy.dispose();
  });

  test('places the planned contact foot at the authoritative foot point on the contact tick', () => {
    const proxy = new ProceduralAthleteProxy(new Scene());
    const player = createPlayerState({ position: { x: 0, y: 0, z: 0 }, facingYaw: 0 });
    const plan = contactPlan({ x: 0.15, y: 0.05, z: 0.62 });

    proxy.update({ player, plan, simulationTick: 10, interpolationAlpha: 0 });

    expect(proxy.pose.contactTick).toBe(10);
    expect(proxy.pose.contactFoot).toBe('right');
    expect(proxy.pose.contactVisible).toBe(true);
    expect(proxy.pose.contactErrorMeters).toBeLessThanOrEqual(plan.geometryTolerance);
    expect(proxy.getFootContactWorldPosition('right').distanceTo({
      x: plan.expectedFootPoint.x,
      y: plan.expectedFootPoint.y,
      z: plan.expectedFootPoint.z,
    })).toBeLessThanOrEqual(plan.geometryTolerance);
    proxy.dispose();
  });

  test('keeps anatomical leg lengths fixed through both a planned touch and a missed reach', () => {
    const proxy = new ProceduralAthleteProxy(new Scene());
    const player = createPlayerState({ position: { x: 0, y: 0, z: 0 }, facingYaw: 0 });
    const upper = proxy.group.getObjectByName('right-upper-leg') as import('three').Mesh;
    const lower = proxy.group.getObjectByName('right-lower-leg') as import('three').Mesh;

    proxy.update({ player, plan: contactPlan({ x: 0.15, y: 0.05, z: 0.62 }), simulationTick: 10, interpolationAlpha: 0 });
    expect(upper.scale.y).toBeCloseTo(0.525, 4);
    expect(lower.scale.y).toBeCloseTo(0.525, 4);
    proxy.update({ player, plan: contactPlan({ x: 1.2, y: 0.05, z: 0.62 }), simulationTick: 10, interpolationAlpha: 0 });
    expect(upper.scale.y).toBeCloseTo(0.525, 4);
    expect(lower.scale.y).toBeCloseTo(0.525, 4);
    expect(proxy.pose.contactVisible).toBe(false);
    proxy.dispose();
  });

  test('does not visually fabricate a contact when the foot target exceeds the presentation reach', () => {
    const proxy = new ProceduralAthleteProxy(new Scene());
    const player = createPlayerState({ position: { x: 0, y: 0, z: 0 }, facingYaw: 0 });
    const plan = contactPlan({ x: 1.2, y: 0.05, z: 0.62 });

    proxy.update({ player, plan, simulationTick: 10, interpolationAlpha: 0 });

    expect(proxy.pose.contactVisible).toBe(false);
    expect(proxy.pose.contactErrorMeters).toBeGreaterThan(0.06);
    proxy.dispose();
  });
});
