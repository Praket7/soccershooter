import { describe, expect, test } from 'vitest';
import { createPlayerState } from '@soccershooter/sim/player/PlayerState';
import { ThirdPersonCamera, type CameraObstacle } from './ThirdPersonCamera';

describe('Stage 03 third-person camera contract', () => {
  test('camera observes authoritative state without mutating it', () => {
    const player = createPlayerState({ position: { x: 2, y: 0.2, z: -3 }, facingYaw: 0.4 });
    const before = structuredClone(player);
    const camera = new ThirdPersonCamera();
    camera.update(player, { yawDelta: 0.2, pitchDelta: -0.1 }, 1 / 60, []);
    expect(player).toEqual(before);
  });

  test('manual look yaw responds in the same rendered update rather than being delayed by smoothing', () => {
    const camera = new ThirdPersonCamera({ initialYaw: 0 });
    const snapshot = camera.update(createPlayerState(), { yawDelta: 0.2, pitchDelta: 0 }, 1 / 60, []);
    expect(snapshot.yaw).toBeCloseTo(0.2, 10);
  });

  test('camera follow catches most player displacement within 100 ms without snapping', () => {
    const camera = new ThirdPersonCamera({ initialYaw: 0 });
    camera.update(createPlayerState({ position: { x: 0, y: 0, z: 0 } }), { yawDelta: 0, pitchDelta: 0 }, 1 / 60, []);
    const moved = createPlayerState({ position: { x: 1, y: 0, z: 0 } });
    let snapshot = camera.update(moved, { yawDelta: 0, pitchDelta: 0 }, 1 / 60, []);
    for (let frame = 1; frame < 6; frame += 1) {
      snapshot = camera.update(moved, { yawDelta: 0, pitchDelta: 0 }, 1 / 60, []);
    }
    expect(snapshot.target.x).toBeGreaterThan(0.72);
    expect(snapshot.target.x).toBeLessThan(0.95);
  });

  test('trackpad zoom changes desired camera distance smoothly and clamps to a safe play envelope', () => {
    const camera = new ThirdPersonCamera({ distance: 5.6, minDistance: 3.4, maxDistance: 8.8 });
    const player = createPlayerState();
    const initial = camera.update(player, { yawDelta: 0, pitchDelta: 0 }, 1 / 60, []);
    expect(initial.userDistance).toBeCloseTo(5.6, 8);

    camera.adjustZoom(1);
    const firstOut = camera.update(player, { yawDelta: 0, pitchDelta: 0 }, 1 / 60, []);
    expect(firstOut.userDistance).toBeGreaterThan(initial.userDistance);
    expect(firstOut.userDistance).toBeLessThan(firstOut.desiredDistance);

    camera.adjustZoom(100);
    for (let frame = 0; frame < 120; frame += 1) camera.update(player, { yawDelta: 0, pitchDelta: 0 }, 1 / 60, []);
    const maxed = camera.update(player, { yawDelta: 0, pitchDelta: 0 }, 1 / 60, []);
    expect(maxed.desiredDistance).toBe(8.8);
    expect(maxed.userDistance).toBeLessThanOrEqual(8.8 + 1e-8);

    camera.adjustZoom(-100);
    for (let frame = 0; frame < 120; frame += 1) camera.update(player, { yawDelta: 0, pitchDelta: 0 }, 1 / 60, []);
    const mined = camera.update(player, { yawDelta: 0, pitchDelta: 0 }, 1 / 60, []);
    expect(mined.desiredDistance).toBe(3.4);
    expect(mined.userDistance).toBeGreaterThanOrEqual(3.4 - 1e-8);
  });

  test('camera spring arm shortens before a wall and cannot clip its collision volume through it', () => {
    const wall: CameraObstacle = { id: 'wall', minX: -4, maxX: 4, minY: 0, maxY: 4, minZ: -3, maxZ: -2.8 };
    const camera = new ThirdPersonCamera({ initialYaw: 0, initialPitch: 0.32, distance: 5.6 });
    const snapshot = camera.update(createPlayerState(), { yawDelta: 0, pitchDelta: 0 }, 1 / 60, [wall]);
    expect(snapshot.collision.active).toBe(true);
    expect(snapshot.armLength).toBeLessThan(3);
    expect(snapshot.position.z).toBeGreaterThan(wall.maxZ - 1e-6);
  });

  test('zooming outward never overrides obstruction collision', () => {
    const wall: CameraObstacle = { id: 'wall', minX: -4, maxX: 4, minY: 0, maxY: 4, minZ: -3, maxZ: -2.8 };
    const camera = new ThirdPersonCamera({ initialYaw: 0, initialPitch: 0.32, distance: 5.6 });
    camera.adjustZoom(1);
    const snapshot = camera.update(createPlayerState(), { yawDelta: 0, pitchDelta: 0 }, 1 / 60, [wall]);
    expect(snapshot.desiredDistance).toBeGreaterThan(5.6);
    expect(snapshot.collision.active).toBe(true);
    expect(snapshot.position.z).toBeGreaterThan(wall.maxZ - 1e-6);
  });

  test('obstruction recovery expands smoothly rather than snapping to full arm length', () => {
    const wall: CameraObstacle = { id: 'wall', minX: -4, maxX: 4, minY: 0, maxY: 4, minZ: -3, maxZ: -2.8 };
    const camera = new ThirdPersonCamera({ initialYaw: 0, initialPitch: 0.32, distance: 5.6 });
    const obstructed = camera.update(createPlayerState(), { yawDelta: 0, pitchDelta: 0 }, 1 / 60, [wall]);
    const firstClear = camera.update(createPlayerState(), { yawDelta: 0, pitchDelta: 0 }, 1 / 60, []);
    expect(firstClear.armLength).toBeGreaterThan(obstructed.armLength);
    expect(firstClear.armLength).toBeLessThan(5.6);
  });

  test('sprint FOV response stays inside the restrained design envelope', () => {
    const camera = new ThirdPersonCamera();
    const normal = camera.update(createPlayerState(), { yawDelta: 0, pitchDelta: 0 }, 1 / 60, [], 0);
    const sprint = camera.update(createPlayerState(), { yawDelta: 0, pitchDelta: 0 }, 1 / 60, [], 1);
    expect(sprint.fov - normal.fov).toBeGreaterThan(0);
    expect(sprint.fov - normal.fov).toBeLessThanOrEqual(2.5);
  });
});