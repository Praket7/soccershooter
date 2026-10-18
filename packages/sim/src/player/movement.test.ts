import { describe, expect, test } from 'vitest';
import type { InputIntent } from '../index';
import { createPlayerState } from './PlayerState';
import {
  DEFAULT_MOVEMENT_CONFIG,
  createFlatMovementWorld,
  normalizeMoveIntent,
  recordMovementTrace,
  replayMovementTrace,
  stepPlayerMovement,
  type MovementWorld,
} from './movement';

const DT = 1 / 30;
const CONTROL_DT = 1 / 60;
const FORWARD: InputIntent = { moveX: 0, moveY: 1, aimYaw: 0, sprint: false, actionBits: 0 };
const SPRINT: InputIntent = { ...FORWARD, sprint: true };
const NEUTRAL: InputIntent = { moveX: 0, moveY: 0, aimYaw: 0, sprint: false, actionBits: 0 };

function horizontalSpeed(state: ReturnType<typeof createPlayerState>): number {
  return Math.hypot(state.velocity.x, state.velocity.z);
}

describe('Stage 03 deterministic movement', () => {
  test('diagonal input is radially normalized and cannot exceed unit magnitude', () => {
    const normalized = normalizeMoveIntent(1, 1);
    expect(Math.hypot(normalized.x, normalized.y)).toBeCloseTo(1, 10);
    expect(normalized.x).toBeCloseTo(Math.SQRT1_2, 10);
    expect(normalized.y).toBeCloseTo(Math.SQRT1_2, 10);
  });

  test('camera-relative right input moves toward screen-right at zero camera yaw', () => {
    const world = createFlatMovementWorld();
    const right: InputIntent = { moveX: 1, moveY: 0, aimYaw: 0, sprint: false, actionBits: 0 };
    const after = stepPlayerMovement(createPlayerState(), right, world, CONTROL_DT);
    expect(after.velocity.x).toBeLessThan(0);
    expect(Math.abs(after.velocity.z)).toBeLessThan(1e-8);
  });

  test('sharp reverse input brakes and reverses without orbiting sideways', () => {
    const world = createFlatMovementWorld();
    const reverse: InputIntent = { moveX: 0, moveY: -1, aimYaw: 0, sprint: true, actionBits: 0 };
    let state = createPlayerState({ velocity: { x: 0, y: 0, z: DEFAULT_MOVEMENT_CONFIG.sprintSpeed } });
    let maxLateral = 0;
    for (let tick = 0; tick < 30; tick += 1) {
      state = stepPlayerMovement(state, reverse, world, CONTROL_DT);
      maxLateral = Math.max(maxLateral, Math.abs(state.position.x));
    }
    expect(maxLateral).toBeLessThan(0.02);
    expect(state.velocity.z).toBeLessThan(-1);
  });

  test('a 90-degree sprint direction change plants instead of drawing a wide circle', () => {
    const world = createFlatMovementWorld();
    const right: InputIntent = { moveX: 1, moveY: 0, aimYaw: 0, sprint: true, actionBits: 0 };
    let state = createPlayerState({ velocity: { x: 0, y: 0, z: DEFAULT_MOVEMENT_CONFIG.sprintSpeed } });
    let maxForwardDrift = 0;
    for (let tick = 0; tick < 36; tick += 1) {
      state = stepPlayerMovement(state, right, world, CONTROL_DT);
      maxForwardDrift = Math.max(maxForwardDrift, state.position.z);
    }
    expect(maxForwardDrift).toBeLessThan(2.35);
    expect(state.velocity.x).toBeLessThan(-7);
    expect(Math.abs(state.velocity.z)).toBeLessThan(2.2);
  });

  test('stepping off raised ground becomes a short deterministic fall instead of a vertical teleport', () => {
    const world: MovementWorld = {
      bounds: { minX: -5, maxX: 5, minZ: -5, maxZ: 5 },
      obstacles: [],
      ground: [{ id: 'platform', minX: -2, maxX: 2, minZ: -2, maxZ: 0, baseHeight: 0.35, slopeX: 0, slopeZ: 0 }],
    };
    let state = createPlayerState({
      position: { x: 0, y: 0.35, z: -0.02 },
      velocity: { x: 0, y: 0, z: DEFAULT_MOVEMENT_CONFIG.jogSpeed },
      grounded: true,
      groundHeight: 0.35,
    });

    state = stepPlayerMovement(state, FORWARD, world, CONTROL_DT);
    expect(state.grounded).toBe(false);
    expect(state.locomotion).toBe('airborne');
    expect(state.position.y).toBeGreaterThan(0.3);
    expect(state.velocity.y).toBeLessThan(0);

    let airborneTicks = 1;
    while (!state.grounded && airborneTicks < 120) {
      state = stepPlayerMovement(state, FORWARD, world, CONTROL_DT);
      airborneTicks += 1;
    }
    expect(airborneTicks).toBeGreaterThan(5);
    expect(airborneTicks).toBeLessThan(40);
    expect(state.grounded).toBe(true);
    expect(state.position.y).toBeCloseTo(0, 8);
    expect(state.velocity.y).toBe(0);
  });

  test('sprint is materially faster than normal running after one second', () => {
    const world = createFlatMovementWorld();
    let jog = createPlayerState();
    let sprint = createPlayerState();
    for (let tick = 0; tick < 60; tick += 1) {
      jog = stepPlayerMovement(jog, FORWARD, world, CONTROL_DT);
      sprint = stepPlayerMovement(sprint, SPRINT, world, CONTROL_DT);
    }
    expect(horizontalSpeed(sprint)).toBeGreaterThan(horizontalSpeed(jog) * 1.6);
  });

  test('velocity change never exceeds the configured legal acceleration', () => {
    const world = createFlatMovementWorld();
    const before = createPlayerState();
    const after = stepPlayerMovement(before, SPRINT, world, DT);
    const deltaV = Math.hypot(after.velocity.x - before.velocity.x, after.velocity.z - before.velocity.z);
    expect(deltaV / DT).toBeLessThanOrEqual(DEFAULT_MOVEMENT_CONFIG.acceleration + 1e-8);
  });

  test('stamina stays within bounds through exhaustion and recovery', () => {
    const world = createFlatMovementWorld();
    let state = createPlayerState();
    for (let tick = 0; tick < 600; tick += 1) {
      state = stepPlayerMovement(state, SPRINT, world, DT);
      expect(state.stamina).toBeGreaterThanOrEqual(0);
      expect(state.stamina).toBeLessThanOrEqual(DEFAULT_MOVEMENT_CONFIG.staminaMax);
    }
    expect(state.sprintLocked).toBe(true);

    for (let tick = 0; tick < 600; tick += 1) {
      state = stepPlayerMovement(state, NEUTRAL, world, DT);
    }
    expect(state.stamina).toBe(DEFAULT_MOVEMENT_CONFIG.staminaMax);
    expect(state.sprintLocked).toBe(false);
  });

  test('fixed-step movement result is invariant to presentation FPS', () => {
    function runAt(renderHz: number) {
      let state = createPlayerState();
      const world = createFlatMovementWorld();
      let accumulator = 0;
      let ticks = 0;
      const frames = renderHz * 6;
      for (let frame = 0; frame < frames; frame += 1) {
        accumulator += 1 / renderHz;
        while (accumulator + 1e-12 >= DT) {
          const intent = ticks < 90 ? SPRINT : ticks < 135 ? { ...FORWARD, moveX: 1, moveY: 0 } : NEUTRAL;
          state = stepPlayerMovement(state, intent, world, DT);
          accumulator -= DT;
          ticks += 1;
        }
      }
      return { state, ticks };
    }

    const a = runAt(60);
    const b = runAt(120);
    const c = runAt(144);
    expect(a.ticks).toBe(180);
    expect(b.ticks).toBe(a.ticks);
    expect(c.ticks).toBe(a.ticks);
    expect(b.state).toEqual(a.state);
    expect(c.state).toEqual(a.state);
  });

  test('a legal top-speed step cannot tunnel through a thin wall', () => {
    const world: MovementWorld = {
      bounds: { minX: -20, maxX: 20, minZ: -20, maxZ: 20 },
      obstacles: [{ id: 'thin-wall', minX: -3, maxX: 3, minZ: 1.5, maxZ: 1.54, minY: 0, maxY: 3 }],
      ground: [],
    };
    const state = createPlayerState({
      position: { x: 0, y: 0, z: 1.1 },
      velocity: { x: 0, y: 0, z: DEFAULT_MOVEMENT_CONFIG.sprintSpeed },
      stamina: DEFAULT_MOVEMENT_CONFIG.staminaMax,
    });
    const after = stepPlayerMovement(state, SPRINT, world, DT);
    expect(after.position.z).toBeLessThanOrEqual(1.5 - DEFAULT_MOVEMENT_CONFIG.capsuleRadius + 1e-8);
  });

  test('legal steps and slopes are traversable while oversized steps are blocked', () => {
    const base = createPlayerState({ position: { x: 0, y: 0, z: 0.58 }, velocity: { x: 0, y: 0, z: 6 } });
    const legalWorld: MovementWorld = {
      bounds: { minX: -5, maxX: 5, minZ: -5, maxZ: 5 },
      obstacles: [],
      ground: [{ id: 'legal-step', minX: -2, maxX: 2, minZ: 0.75, maxZ: 3, baseHeight: 0.22, slopeX: 0, slopeZ: 0 }],
    };
    const legal = stepPlayerMovement(base, FORWARD, legalWorld, DT);
    expect(legal.position.z).toBeGreaterThan(base.position.z);
    expect(legal.position.y).toBeCloseTo(0.22, 8);

    const blockedWorld: MovementWorld = {
      ...legalWorld,
      ground: [{ id: 'high-step', minX: -2, maxX: 2, minZ: 0.75, maxZ: 3, baseHeight: 0.65, slopeX: 0, slopeZ: 0 }],
    };
    const blocked = stepPlayerMovement(base, FORWARD, blockedWorld, DT);
    expect(blocked.position.z).toBeLessThan(0.75);
    expect(blocked.position.y).toBe(0);
  });

  test('small sprint steering still has a broader arc than low-speed movement', () => {
    const world = createFlatMovementWorld();
    const fast = createPlayerState({ velocity: { x: 0, y: 0, z: DEFAULT_MOVEMENT_CONFIG.sprintSpeed } });
    const slow = createPlayerState({ velocity: { x: 0, y: 0, z: 1 } });
    const cut: InputIntent = { moveX: Math.SQRT1_2, moveY: Math.SQRT1_2, aimYaw: 0, sprint: true, actionBits: 0 };
    const fastAfter = stepPlayerMovement(fast, cut, world, DT);
    const slowAfter = stepPlayerMovement(slow, { ...cut, sprint: false }, world, DT);
    const fastHeading = Math.atan2(fastAfter.velocity.x, fastAfter.velocity.z);
    const slowHeading = Math.atan2(slowAfter.velocity.x, slowAfter.velocity.z);
    expect(Math.abs(slowHeading)).toBeGreaterThan(Math.abs(fastHeading));
    expect(horizontalSpeed(fastAfter)).toBeGreaterThan(0);
  });

  test('recorded movement intents replay to the identical deterministic player state', () => {
    const world = createFlatMovementWorld();
    const initial = createPlayerState();
    const intents: InputIntent[] = [];
    for (let tick = 0; tick < 180; tick += 1) {
      intents.push(tick < 60 ? SPRINT : tick < 120 ? { ...FORWARD, moveX: 0.65, moveY: 0.5, aimYaw: 0.4 } : NEUTRAL);
    }
    const trace = recordMovementTrace(initial, intents, 30);
    const replayed = replayMovementTrace(trace, world);
    let manual = initial;
    for (const intent of intents) manual = stepPlayerMovement(manual, intent, world, DT);
    expect(replayed).toEqual(manual);
  });
});