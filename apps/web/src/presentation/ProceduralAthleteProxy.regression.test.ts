import { describe, expect, test } from 'vitest';
import { Mesh, Scene, Vector3 } from 'three';
import { createFootballContactPlan } from '../../../../packages/sim/src/football/contactPlan';
import { createPlayerState } from '../../../../packages/sim/src/player/PlayerState';
import { PLAYER_VISUAL_LAYOUT } from './PlayerVisualLayout';
import { ProceduralAthleteProxy } from './ProceduralAthleteProxy';

function yawDelta(a: number, b: number): number {
  const tau = Math.PI * 2;
  return ((b - a + Math.PI) % tau + tau) % tau - Math.PI;
}

describe('procedural athlete locomotion regressions', () => {
  test('keeps animated limb segment geometry full length so joints stay connected', () => {
    const proxy = new ProceduralAthleteProxy(new Scene());
    const segments = ['left-upper-leg', 'left-lower-leg', 'left-upper-arm', 'left-lower-arm']
      .map((name) => proxy.group.getObjectByName(name) as Mesh);

    for (const segment of segments) {
      segment.geometry.computeBoundingBox();
      expect(segment.geometry.boundingBox!.getSize(new Vector3()).y, segment.name).toBeGreaterThan(0.98);
    }
    proxy.dispose();
  });

  test('keeps both hip joints attached to the animated pelvis through hard plants', () => {
    const proxy = new ProceduralAthleteProxy(new Scene());
    const base = createPlayerState({ position: { x: 0, y: 0, z: 0 }, facingYaw: 0 });
    const planted = {
      ...base,
      athleticMotion: {
        ...base.athleticMotion,
        gait: 'plant' as const,
        bodyYaw: 0.22,
        bodyYawRate: 3.8,
        plantIntensity: 0.92,
        turnDemand: -0.75,
        bodyLean: { forward: 0.19, lateral: -0.2 },
        plannedVelocity: { x: 5.5, z: -1.2 },
      },
    };

    proxy.update({ player: planted, simulationTick: 1, interpolationAlpha: 1 });
    proxy.group.updateMatrixWorld(true);
    const trunk = proxy.group.getObjectByName('athlete-trunk')!;
    for (const foot of ['left', 'right'] as const) {
      const side = foot === 'left' ? -1 : 1;
      const expectedHip = proxy.group.worldToLocal(trunk.localToWorld(new Vector3(side * 0.15, 0.91, 0)));
      const thigh = proxy.group.getObjectByName(`${foot}-upper-leg`) as Mesh;
      const upperAxis = new Vector3(0, 1, 0).applyQuaternion(thigh.quaternion);
      const proximalEnd = thigh.position.clone().addScaledVector(upperAxis, -thigh.scale.y / 2);
      expect(proximalEnd.distanceTo(expectedHip), `${foot} hip gap`).toBeLessThan(0.002);
    }
    proxy.dispose();
  });

  test('keeps the boots grounded through jogging and sprint strides instead of lifting the whole leg', () => {
    const proxy = new ProceduralAthleteProxy(new Scene());
    const base = createPlayerState({ position: { x: 0, y: 0, z: 0 }, facingYaw: 0 });
    let highestBootBottom = 0;
    for (let tick = 0; tick < 120; tick += 1) {
      const gaitPhase = (tick / 60 / 0.34) % 1;
      const supportFoot = gaitPhase >= 0.06 && gaitPhase < 0.40
        ? 'left' as const
        : gaitPhase >= 0.56 && gaitPhase < 0.90
          ? 'right' as const
          : 'both' as const;
      const player = {
        ...base,
        position: { x: 0, y: 0, z: tick / 60 * 6 },
        velocity: { x: 0, y: 0, z: 6 },
        athleticMotion: {
          ...base.athleticMotion,
          gait: 'sprint' as const,
          gaitPhase,
          supportFoot,
          strideSeconds: 0.34,
          plannedVelocity: { x: 0, z: 6 },
        },
      };
      proxy.update({ player, simulationTick: tick, interpolationAlpha: 1 });
      for (const foot of ['left', 'right'] as const) {
        const bottomY = proxy.getFootWorldPosition(foot).y - 0.05;
        highestBootBottom = Math.max(highestBootBottom, bottomY);
        if (proxy.pose.supportFoot === foot) {
          expect(bottomY, `${foot} planted boot at tick ${tick}`).toBeLessThanOrEqual(0.01);
        }
      }
    }
    expect(highestBootBottom, 'swing boots should lift only enough to clear the turf').toBeLessThanOrEqual(0.16);
    proxy.dispose();
  });

  test('does not play a full-speed stride while the player is still physically stationary', () => {
    const proxy = new ProceduralAthleteProxy(new Scene());
    const base = createPlayerState({ position: { x: 0, y: 0, z: 0 }, facingYaw: 0 });
    const accelerating = {
      ...base,
      velocity: { x: 0, y: 0, z: 0 },
      athleticMotion: {
        ...base.athleticMotion,
        gait: 'sprint' as const,
        gaitPhase: 0.25,
        supportFoot: 'both' as const,
        strideSeconds: 0.34,
        plannedVelocity: { x: 0, z: 8.8 },
      },
    };
    proxy.update({ player: accelerating, simulationTick: 1, interpolationAlpha: 0 });
    const rightFoot = proxy.group.worldToLocal(proxy.getFootWorldPosition('right'));

    expect(rightFoot.z, 'stride reach should follow realized speed, not requested top speed').toBeLessThan(0.15);
    proxy.dispose();
  });

  test('carries swing feet with the moving body instead of letting the legs drag behind at sprint pace', () => {
    const proxy = new ProceduralAthleteProxy(new Scene());
    const base = createPlayerState({ position: { x: 0, y: 0, z: 0 }, facingYaw: 0 });
    const strideSeconds = 0.34;
    const speed = 8.8;
    const makeRunner = (tick: number) => ({
      ...base,
      position: { x: 0, y: 0, z: speed * tick / 60 },
      velocity: { x: 0, y: 0, z: speed },
      athleticMotion: {
        ...base.athleticMotion,
        gait: 'sprint' as const,
        gaitPhase: (0.25 + tick / 60 / strideSeconds) % 1,
        supportFoot: 'both' as const,
        strideSeconds,
      },
    });

    proxy.update({ player: makeRunner(0), simulationTick: 0, interpolationAlpha: 0 });
    for (let tick = 1; tick <= 8; tick += 1) {
      const player = makeRunner(tick);
      proxy.update({ player, simulationTick: tick, interpolationAlpha: 0 });
      const localFoot = proxy.group.worldToLocal(proxy.getFootWorldPosition('right'));
      const phase = player.athleticMotion.gaitPhase;
      const strideLength = Math.min(0.72, speed * strideSeconds * 0.62);
      const expectedZ = PLAYER_VISUAL_LAYOUT.footForward
        + Math.sin(phase * Math.PI * 2) * strideLength * 0.32;
      expect(Math.abs(localFoot.z - expectedZ), `right swing foot relative to pelvis at sprint tick ${tick}`).toBeLessThan(0.012);
    }
    proxy.dispose();
  });

  test('feet settle under the hips promptly after movement stops instead of dragging behind', () => {
    const proxy = new ProceduralAthleteProxy(new Scene());
    const base = createPlayerState({ position: { x: 0, y: 0, z: 0 }, facingYaw: 0 });
    const running = {
      ...base,
      velocity: { x: 0, y: 0, z: 5 },
      athleticMotion: {
        ...base.athleticMotion,
        gait: 'jog' as const,
        gaitPhase: 0.25,
        supportFoot: 'both' as const,
        strideSeconds: 0.42,
      },
    };
    proxy.update({ player: running, simulationTick: 1, interpolationAlpha: 0 });

    const stopped = {
      ...base,
      position: { ...running.position },
      velocity: { x: 0, y: 0, z: 0 },
      athleticMotion: {
        ...base.athleticMotion,
        gait: 'idle' as const,
        gaitPhase: 0,
        supportFoot: 'both' as const,
      },
    };
    for (let tick = 2; tick <= 7; tick += 1) {
      proxy.update({ player: stopped, simulationTick: tick, interpolationAlpha: 0 });
    }

    for (const [foot, side] of [['left', -1], ['right', 1]] as const) {
      const local = proxy.group.worldToLocal(proxy.getFootWorldPosition(foot));
      expect(Math.hypot(local.x - side * 0.15, local.z - 0.08), `${foot} idle foot offset`).toBeLessThan(0.035);
      expect(local.y).toBeLessThanOrEqual(0.15);
    }
    proxy.dispose();
  });

  test('renders a distinct human silhouette with separated kit and face details', () => {
    const proxy = new ProceduralAthleteProxy(new Scene());
    const torso = proxy.group.getObjectByName('athlete-torso') as Mesh;
    const shorts = proxy.group.getObjectByName('athlete-shorts') as Mesh;
    const head = proxy.group.getObjectByName('athlete-head') as Mesh;
    const hand = proxy.group.getObjectByName('left-hand') as Mesh;
    const eye = proxy.group.getObjectByName('athlete-left-eye') as Mesh;
    const collar = proxy.group.getObjectByName('athlete-jersey-collar') as Mesh;
    const number = proxy.group.getObjectByName('athlete-back-number') as Mesh;

    expect(torso).toBeDefined();
    expect(shorts).toBeDefined();
    expect(head).toBeDefined();
    expect(hand).toBeDefined();
    expect(eye).toBeDefined();
    expect(collar).toBeDefined();
    expect(number).toBeDefined();
    expect((torso.material as import('three').MeshStandardMaterial).color.getHex()).toBe(0x76243d);
    expect(torso.material).not.toBe(shorts.material);
    expect(head.material).not.toBe(torso.material);
    expect(torso.geometry.type).toBe('LatheGeometry');
    expect((torso.material as import('three').Material).transparent).toBe(false);
    expect((torso.material as import('three').Material).opacity).toBe(1);
    proxy.dispose();
  });

  test('torso tips into forward acceleration and back into braking', () => {
    const proxy = new ProceduralAthleteProxy(new Scene());
    const base = createPlayerState({ position: { x: 0, y: 0, z: 0 }, facingYaw: 0 });
    const poseForLean = (forward: number) => {
      proxy.update({
        player: { ...base, athleticMotion: { ...base.athleticMotion, bodyLean: { forward, lateral: 0 } } },
        simulationTick: 1,
        interpolationAlpha: 1,
      });
      return proxy.group.getObjectByName('athlete-trunk')!.rotation.x;
    };
    const accelerationTilt = poseForLean(0.12);
    const brakingTilt = poseForLean(-0.12);

    expect(accelerationTilt).toBeGreaterThan(0);
    expect(brakingTilt).toBeLessThan(0);
    proxy.dispose();
  });

  test('hips counter-rotate against the shoulders during a fast direction change', () => {
    const proxy = new ProceduralAthleteProxy(new Scene());
    const base = createPlayerState({ position: { x: 0, y: 0, z: 0 }, facingYaw: 0 });
    const turning = {
      ...base,
      athleticMotion: {
        ...base.athleticMotion,
        gait: 'sprint' as const,
        bodyYawRate: 3.2,
        turnDemand: 0.8,
        plantIntensity: 0.6,
        bodyLean: { forward: 0.04, lateral: 0.08 },
        plannedVelocity: { x: 4, z: 5 },
      },
    };
    proxy.update({ player: turning, simulationTick: 1, interpolationAlpha: 1 });
    const trunk = proxy.group.getObjectByName('athlete-trunk')!;
    const pelvis = proxy.group.getObjectByName('athlete-pelvis')!;

    expect(Math.sign(trunk.rotation.y)).toBe(-1);
    expect(Math.sign(pelvis.rotation.y)).toBe(1);
    expect(Math.abs(trunk.rotation.y - pelvis.rotation.y)).toBeGreaterThan(0.06);
    proxy.dispose();
  });
  test('swing leg folds through recovery instead of staying rigid at the knee', () => {
    const base = createPlayerState({ position: { x: 0, y: 0, z: 0 }, facingYaw: 0 });
    const poseAt = (phase: number) => {
      const proxy = new ProceduralAthleteProxy(new Scene());
      proxy.update({
        player: {
          ...base,
          velocity: { x: 0, y: 0, z: 7.5 },
          athleticMotion: {
            ...base.athleticMotion,
            gait: 'sprint',
            gaitPhase: phase,
            strideSeconds: 0.34,
            plannedVelocity: { x: 0, z: 7.5 },
          },
        },
        simulationTick: Math.round(phase * 60),
        interpolationAlpha: 0,
      });
      const kneeHeight = proxy.group.getObjectByName('right-upper-leg')!.position.y;
      proxy.dispose();
      return kneeHeight;
    };
    const extended = poseAt(0.5);
    const recovered = poseAt(0.25);

    expect(recovered - extended).toBeGreaterThan(0.08);
  });

  test('running arms swing opposite their same-side legs', () => {
    const proxy = new ProceduralAthleteProxy(new Scene());
    const base = createPlayerState({ position: { x: 0, y: 0, z: 0 }, facingYaw: 0 });
    const moving = {
      ...base,
      velocity: { x: 0, y: 0, z: 5 },
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

  test('the proxy faces its real travel vector instead of animating a sideways run', () => {
    const proxy = new ProceduralAthleteProxy(new Scene());
    const base = createPlayerState({ position: { x: 0, y: 0, z: 0 }, facingYaw: 0 });
    const forward = {
      ...base,
      velocity: { x: 1, y: 0, z: 5 },
      athleticMotion: {
        ...base.athleticMotion,
        gait: 'sprint' as const,
        supportFoot: 'left' as const,
        strideSeconds: 0.34,
        plantIntensity: 0.8,
        bodyYaw: 0.2,
        plannedVelocity: { x: 1, z: 5 },
      },
    };
    proxy.update({ player: forward, simulationTick: 40, interpolationAlpha: 1 });
    const turned = {
      ...forward,
      athleticMotion: { ...forward.athleticMotion, bodyYaw: 0.28 },
    };
    proxy.update({ player: turned, simulationTick: 41, interpolationAlpha: 1 });
    expect(Math.abs(yawDelta(turned.athleticMotion.bodyYaw, proxy.group.rotation.y))).toBeLessThan(0.001);
    expect(Math.abs(yawDelta(Math.atan2(1, 5), proxy.group.rotation.y))).toBeLessThan(0.1);
    proxy.dispose();
  });

  test('the body does not snap to a newly planned travel lane ahead of its physical turn', () => {
    const proxy = new ProceduralAthleteProxy(new Scene());
    const base = createPlayerState({ position: { x: 0, y: 0, z: 0 }, facingYaw: 0 });
    const turning = {
      ...base,
      athleticMotion: {
        ...base.athleticMotion,
        bodyYaw: 0.1,
        plannedVelocity: { x: 0, z: -5 },
      },
    };

    proxy.update({ player: turning, simulationTick: 1, interpolationAlpha: 1 });

    expect(Math.abs(yawDelta(turning.athleticMotion.bodyYaw, proxy.group.rotation.y))).toBeLessThan(0.05);
    proxy.dispose();
  });

  test('body yaw passes through the old alignment threshold without snapping to the travel vector', () => {
    const proxy = new ProceduralAthleteProxy(new Scene());
    const base = createPlayerState({ position: { x: 0, y: 0, z: 0 }, facingYaw: 0 });
    const before = {
      ...base,
      athleticMotion: {
        ...base.athleticMotion,
        bodyYaw: -0.40,
        plannedVelocity: { x: 0, z: 0 },
      },
    };
    proxy.update({ player: before, simulationTick: 1, interpolationAlpha: 1 });
    const beforeYaw = proxy.group.rotation.y;
    const after = {
      ...before,
      athleticMotion: {
        ...before.athleticMotion,
        bodyYaw: -0.33,
        plannedVelocity: { x: 0, z: 5 },
      },
    };
    proxy.update({ player: after, simulationTick: 2, interpolationAlpha: 1 });

    expect(Math.abs(yawDelta(beforeYaw, proxy.group.rotation.y))).toBeLessThan(0.08);
    proxy.dispose();
  });

  test('stopping after a forward run keeps the last travel heading instead of snapping sideways', () => {
    const proxy = new ProceduralAthleteProxy(new Scene());
    const base = createPlayerState({ position: { x: 0, y: 0, z: 0 }, facingYaw: -Math.PI / 2 });
    const running = {
      ...base,
      athleticMotion: {
        ...base.athleticMotion,
        bodyYaw: 0,
        plannedVelocity: { x: 0, z: 5 },
      },
    };
    proxy.update({ player: running, simulationTick: 10, interpolationAlpha: 1 });
    const stopped = {
      ...running,
      athleticMotion: { ...running.athleticMotion, plannedVelocity: { x: 0, z: 0 } },
    };
    proxy.update({ player: stopped, simulationTick: 11, interpolationAlpha: 1 });

    expect(Math.abs(yawDelta(0, proxy.group.rotation.y))).toBeLessThan(0.001);
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
    let largestStepTick = -1;
    let crossedFeet = false;
    for (let tick = 0; tick < 36; tick += 1) {
      const angle = tick / 60 * angularSpeed;
      const gaitPhase = (0.55 + tick * (1 / 60 / 0.34)) % 1;
      const supportFoot = gaitPhase >= 0.06 && gaitPhase < 0.40
        ? 'left' as const
        : gaitPhase >= 0.56 && gaitPhase < 0.90
          ? 'right' as const
          : 'both' as const;
      const player = {
        ...base,
        position: {
          x: radius * Math.sin(angle),
          y: 0,
          z: radius * (1 - Math.cos(angle)),
        },
        velocity: {
          x: radius * angularSpeed * Math.cos(angle),
          y: 0,
          z: radius * angularSpeed * Math.sin(angle),
        },
        athleticMotion: {
          ...base.athleticMotion,
          gait: 'sprint' as const,
          gaitPhase,
          supportFoot,
          strideSeconds: 0.34,
          plantIntensity: 0.8,
          bodyYaw: Math.atan2(
            radius * angularSpeed * Math.cos(angle),
            radius * angularSpeed * Math.sin(angle),
          ),
          plannedVelocity: {
            x: radius * angularSpeed * Math.cos(angle),
            z: radius * angularSpeed * Math.sin(angle),
          },
        },
      };
      proxy.update({ player, simulationTick: 40 + tick, interpolationAlpha: 1 });
      const foot = proxy.getFootWorldPosition('left');
      if (previousFoot) {
        const step = foot.distanceTo(previousFoot);
        if (step > largestStep) {
          largestStep = step;
          largestStepTick = tick;
        }
      }
      previousFoot = foot;
      const leftLocal = proxy.group.worldToLocal(proxy.getFootWorldPosition('left'));
      const rightLocal = proxy.group.worldToLocal(proxy.getFootWorldPosition('right'));
      crossedFeet ||= leftLocal.x >= rightLocal.x;
    }

    // At sprint pace the foot's world-space step includes pelvis translation
    // as well as its own swing. The root advances up to ~0.12 m/tick here;
    // allow that smooth carry plus a bounded turning stride without mistaking
    // it for the old foot-plant snap.
    expect(largestStep, `tick ${largestStepTick}`).toBeLessThan(0.205);
    expect(crossedFeet).toBe(false);
    proxy.dispose();
  });

  test('right-foot step-over sweeps from inside to outside before the left-foot exit', () => {
    const proxy = new ProceduralAthleteProxy(new Scene());
    const player = createPlayerState({ position: { x: 0, y: 0, z: 0 }, facingYaw: 0 });
    const cue = { kind: 'stepover' as const, startTick: 10, contactTick: 40, endTick: 50, feintFoot: 'right' as const, exitFoot: 'left' as const };
    const sample = (tick: number) => {
      proxy.update({ player, simulationTick: tick, interpolationAlpha: 0, stepOver: cue });
      return proxy.group.worldToLocal(proxy.getFootWorldPosition('right'));
    };
    const inside = sample(17);
    const around = sample(25);
    const outside = sample(37);
    const contact = sample(40);
    const planted = sample(49);

    expect(inside.x).toBeLessThan(-0.08);
    expect(around.z).toBeGreaterThan(0.50);
    expect(outside.x).toBeGreaterThan(0.08);
    expect(contact.x).toBeGreaterThan(0.08);
    expect(planted.distanceTo(contact)).toBeLessThan(0.08);
    let previous: Vector3 | null = null;
    let largestStep = 0;
    for (let tick = 10; tick <= 50; tick += 1) {
      const foot = sample(tick);
      if (previous) largestStep = Math.max(largestStep, foot.distanceTo(previous));
      previous = foot;
    }
    expect(largestStep).toBeLessThan(0.15);
    proxy.update({ player, simulationTick: 30, interpolationAlpha: 0, stepOver: cue });
    const trunk = proxy.group.getObjectByName('athlete-trunk')!;
    const head = proxy.group.getObjectByName('stepover-head')!;
    expect(Math.abs(trunk.rotation.z)).toBeGreaterThan(0.1);
    expect(Math.sign(head.rotation.z)).toBe(-Math.sign(trunk.rotation.z));
    proxy.dispose();
  });

  test('elastico foot path sells the outside touch then snaps across the body', () => {
    const proxy = new ProceduralAthleteProxy(new Scene());
    const player = createPlayerState({ position: { x: 0, y: 0, z: 0 }, facingYaw: 0 });
    const cue = { kind: 'elastico' as const, startTick: 10, contactTick: 25, endTick: 34, feintFoot: 'right' as const, exitFoot: 'left' as const };
    let lastTick = 9;
    const sample = (tick: number) => {
      for (let frame = lastTick + 1; frame <= tick; frame += 1) {
        proxy.update({ player, simulationTick: frame, interpolationAlpha: 0, stepOver: cue });
      }
      lastTick = tick;
      return proxy.group.worldToLocal(proxy.getFootWorldPosition('right'));
    };
    const outside = sample(18);
    const cut = sample(27);
    const exit = sample(34);

    expect(outside.x).toBeGreaterThan(0.20);
    expect(cut.x).toBeLessThan(-0.1);
    expect(exit.x).toBeLessThan(0);
    proxy.dispose();
  });

  test('elastico recovery does not add a post-contact hop or extra upward body beat', () => {
    const proxy = new ProceduralAthleteProxy(new Scene());
    const player = createPlayerState({ position: { x: 0, y: 0, z: 0 }, facingYaw: 0 });
    const cue = { kind: 'elastico' as const, startTick: 10, contactTick: 25, endTick: 49, feintFoot: 'right' as const, exitFoot: 'left' as const };
    let maximumRecoveryLift = Number.NEGATIVE_INFINITY;
    let maximumRecoveryArmSweep = 0;

    for (let tick = cue.contactTick; tick <= cue.endTick; tick += 1) {
      proxy.update({ player, simulationTick: tick, interpolationAlpha: 0, stepOver: cue });
      maximumRecoveryLift = Math.max(maximumRecoveryLift, proxy.group.getObjectByName('athlete-trunk')!.position.y);
      maximumRecoveryArmSweep = Math.max(maximumRecoveryArmSweep, Math.abs(proxy.group.getObjectByName('right-elbow')!.position.z));
      expect(proxy.group.position.y).toBe(0);
    }

    expect(maximumRecoveryLift).toBeLessThanOrEqual(0.001);
    expect(maximumRecoveryArmSweep).toBeLessThanOrEqual(0.001);
    proxy.dispose();
  });

  test('rendered athlete follows the shared movement heading while action facing remains on camera aim', () => {
    const proxy = new ProceduralAthleteProxy(new Scene());
    const base = createPlayerState({ position: { x: 0, y: 0, z: 0 }, facingYaw: 0 });
    const strafing = {
      ...base,
      velocity: { x: -4.5, y: 0, z: 0 },
      athleticMotion: {
        ...base.athleticMotion,
        gait: 'jog' as const,
        bodyYaw: -Math.PI / 2,
        plannedVelocity: { x: -4.5, z: 0 },
      },
    };

    proxy.update({ player: strafing, simulationTick: 40, interpolationAlpha: 1 });
    const travelYaw = strafing.athleticMotion.bodyYaw;

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
