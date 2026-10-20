import { describe, expect, test } from 'vitest';
import { Scene } from 'three';
import { createFootballContactPlan } from '../../../../packages/sim/src/football/contactPlan';
import { createPlayerState } from '../../../../packages/sim/src/player/PlayerState';
import { ProceduralAthleteProxy } from './ProceduralAthleteProxy';

function yawDelta(a: number, b: number): number {
  const tau = Math.PI * 2;
  return ((b - a + Math.PI) % tau + tau) % tau - Math.PI;
}

describe('procedural athlete locomotion regressions', () => {
  test('ordinary jog stance keeps the support boot planted while the root advances', () => {
    const proxy = new ProceduralAthleteProxy(new Scene());
    const base = createPlayerState({ position: { x: 0, y: 0, z: 0 }, facingYaw: 0 });
    const strideSeconds = 0.42;
    const startPhase = 0.10;
    const dt = 0.05;
    const speed = 5;
    const start = {
      ...base,
      velocity: { x: 0, y: 0, z: speed },
      athleticMotion: {
        ...base.athleticMotion,
        gait: 'jog' as const,
        gaitPhase: startPhase,
        supportFoot: 'left' as const,
        nextFoot: 'right' as const,
        strideSeconds,
        plannedVelocity: { x: 0, z: speed },
      },
    };

    proxy.update({ player: start, simulationTick: 20, interpolationAlpha: 0 });
    const plantedAtStart = proxy.getFootWorldPosition('left');

    const end = {
      ...start,
      position: { x: 0, y: 0, z: speed * dt },
      athleticMotion: {
        ...start.athleticMotion,
        gaitPhase: (startPhase + dt / strideSeconds) % 1,
      },
    };
    proxy.update({ player: end, simulationTick: 23, interpolationAlpha: 0 });
    const plantedAfterRootAdvance = proxy.getFootWorldPosition('left');

    expect(plantedAtStart.distanceTo(plantedAfterRootAdvance)).toBeLessThanOrEqual(0.08);
    proxy.dispose();
  });

  test('rendered athlete turns into travel while authoritative action facing can remain on camera aim', () => {
    const proxy = new ProceduralAthleteProxy(new Scene());
    const base = createPlayerState({ position: { x: 0, y: 0, z: 0 }, facingYaw: 0 });
    const strafing = {
      ...base,
      athleticMotion: {
        ...base.athleticMotion,
        gait: 'jog' as const,
        plannedVelocity: { x: -4.5, z: 0 },
      },
    };

    proxy.update({ player: strafing, simulationTick: 40, interpolationAlpha: 1 });
    const travelYaw = Math.atan2(strafing.athleticMotion.plannedVelocity.x, strafing.athleticMotion.plannedVelocity.z);

    expect(Math.abs(yawDelta(strafing.facingYaw, 0))).toBeLessThan(0.001);
    expect(Math.abs(yawDelta(proxy.group.rotation.y, travelYaw))).toBeLessThan(0.001);
    proxy.dispose();
  });

  test('strike presentation starts moving toward contact during the declared prepare window', () => {
    const proxy = new ProceduralAthleteProxy(new Scene());
    const player = createPlayerState({ position: { x: 0, y: 0, z: 0 }, facingYaw: 0 });
    const plan = createFootballContactPlan({
      sourceId: 'feel-regression-strike',
      kind: 'shot',
      foot: 'right',
      surface: 'instep',
      prepareTick: 20,
      contactTick: 26,
      recoveryEndTick: 32,
      expectedBallPoint: { x: 0.15, y: 0.11, z: 0.82 },
      expectedFootPoint: { x: 0.15, y: 0.06, z: 0.68 },
      targetBallVelocity: { x: 0, y: 3.5, z: 24 },
      maxLinearImpulse: 15.5,
      maxAngularImpulse: 64,
      timingWindowTicks: 1,
      geometryTolerance: 0.24,
      quality: 1,
      reason: 'prepare-window-regression',
    });

    proxy.update({ player, plan, simulationTick: plan.prepareTick, interpolationAlpha: 0 });
    const prepareError = proxy.pose.contactErrorMeters;
    proxy.update({ player, plan, simulationTick: 23, interpolationAlpha: 0 });
    const midPrepareError = proxy.pose.contactErrorMeters;

    expect(midPrepareError).toBeLessThan(prepareError * 0.8);
    proxy.dispose();
  });
});
