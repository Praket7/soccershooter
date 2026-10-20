import { describe, expect, test } from 'vitest';
import { Mesh, Scene, Vector3 } from 'three';
import { createFootballContactPlan } from '../../../../packages/sim/src/football/contactPlan';
import { createPlayerState } from '../../../../packages/sim/src/player/PlayerState';
import { ProceduralAthleteProxy } from './ProceduralAthleteProxy';

function yawDelta(a: number, b: number): number {
  const tau = Math.PI * 2;
  return ((b - a + Math.PI) % tau + tau) % tau - Math.PI;
}

describe('procedural athlete locomotion regressions', () => {
  test('running arms swing opposite their same-side legs', () => {
    const proxy = new ProceduralAthleteProxy(new Scene());
    const base = createPlayerState({ position: { x: 0, y: 0, z: 0 }, facingYaw: 0 });
    const moving = {
      ...base,
      athleticMotion: {
        ...base.athleticMotion,
        gait: 'jog' as const,
        strideSeconds: 0.42,
        plannedVelocity: { x: 0, z: 5 },
        gaitPhase: 0.10,
      },
    };
    proxy.update({ player: moving, simulationTick: 20, interpolationAlpha: 0 });
    const armAtStart = proxy.group.getObjectByName('left-upper-arm') as Mesh;
    const startRotation = armAtStart.quaternion.clone();
    proxy.update({
      player: { ...moving, athleticMotion: { ...moving.athleticMotion, gaitPhase: 0.35 } },
      simulationTick: 21,
      interpolationAlpha: 0,
    });

    expect(armAtStart.quaternion.angleTo(startRotation)).toBeGreaterThan(0.04);
    expect(proxy.group.getObjectByName('left-lower-arm')).toBeDefined();
    proxy.dispose();
  });

  test('a front-to-back reversal rotates through planted steps instead of flipping the body', () => {
    const proxy = new ProceduralAthleteProxy(new Scene());
    const base = createPlayerState({ position: { x: 0, y: 0, z: 0 }, facingYaw: 0 });
    const forward = {
      ...base,
      velocity: { x: 0, y: 0, z: 5 },
      athleticMotion: {
        ...base.athleticMotion,
        gait: 'sprint' as const,
        supportFoot: 'left' as const,
        strideSeconds: 0.34,
        plantIntensity: 0.8,
        plannedVelocity: { x: 0, z: 5 },
      },
    };
    proxy.update({ player: forward, simulationTick: 40, interpolationAlpha: 1 });
    const startYaw = proxy.group.rotation.y;
    const backward = {
      ...forward,
      velocity: { x: 0, y: 0, z: -5 },
      athleticMotion: { ...forward.athleticMotion, plannedVelocity: { x: 0, z: -5 } },
    };

    proxy.update({ player: backward, simulationTick: 41, interpolationAlpha: 1 });
    expect(Math.abs(yawDelta(startYaw, proxy.group.rotation.y))).toBeLessThan(0.2);
    let previousYaw = proxy.group.rotation.y;
    let largestStep = 0;
    for (let tick = 42; tick <= 76; tick += 1) {
      proxy.update({ player: backward, simulationTick: tick, interpolationAlpha: 1 });
      const step = Math.abs(yawDelta(previousYaw, proxy.group.rotation.y));
      largestStep = Math.max(largestStep, step);
      previousYaw = proxy.group.rotation.y;
    }

    expect(largestStep).toBeLessThan(0.13);
    expect(Math.abs(yawDelta(startYaw, proxy.group.rotation.y))).toBeGreaterThan(2.3);
    expect(Math.abs(yawDelta(startYaw, proxy.group.rotation.y))).toBeLessThan(Math.PI);
    proxy.dispose();
  });

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

  test('tight sprint turns release and replant the support foot without a visual snap', () => {
    const proxy = new ProceduralAthleteProxy(new Scene());
    const base = createPlayerState({ position: { x: 0, y: 0, z: 0 }, facingYaw: 0 });
    const radius = 2;
    const angularSpeed = 3.5;
    let previousFoot: Vector3 | null = null;
    let largestStep = 0;
    let crossedFeet = false;
    for (let tick = 0; tick < 36; tick += 1) {
      const angle = tick / 60 * angularSpeed;
      const player = {
        ...base,
        position: {
          x: radius * Math.sin(angle),
          y: 0,
          z: radius * (1 - Math.cos(angle)),
        },
        athleticMotion: {
          ...base.athleticMotion,
          gait: 'sprint' as const,
          gaitPhase: 0.55,
          supportFoot: 'left' as const,
          strideSeconds: 0.34,
          plantIntensity: 0.8,
          plannedVelocity: {
            x: radius * angularSpeed * Math.cos(angle),
            z: radius * angularSpeed * Math.sin(angle),
          },
        },
      };
      proxy.update({ player, simulationTick: 40 + tick, interpolationAlpha: 1 });
      const foot = proxy.getFootWorldPosition('left');
      if (previousFoot) largestStep = Math.max(largestStep, foot.distanceTo(previousFoot));
      previousFoot = foot;
      const leftLocal = proxy.group.worldToLocal(proxy.getFootWorldPosition('left'));
      const rightLocal = proxy.group.worldToLocal(proxy.getFootWorldPosition('right'));
      crossedFeet ||= leftLocal.x >= rightLocal.x;
    }

    expect(largestStep).toBeLessThan(0.18);
    expect(crossedFeet).toBe(false);
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
