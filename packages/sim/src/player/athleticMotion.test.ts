import { describe, expect, test } from 'vitest';
import { createPlayerState, type PlayerState } from './PlayerState';
import { createFlatMovementWorld, stepPlayerMovement } from './movement';

const DT = 1 / 60;
const WORLD = createFlatMovementWorld({ minX: -100, maxX: 100, minZ: -100, maxZ: 100 });

function yawDelta(from: number, to: number): number {
  const tau = Math.PI * 2;
  return ((to - from + Math.PI) % tau + tau) % tau - Math.PI;
}

function intent(degrees: number, magnitude = 1, sprint = false) {
  const radians = degrees * Math.PI / 180;
  return {
    moveX: -Math.sin(radians) * magnitude,
    moveY: Math.cos(radians) * magnitude,
    aimYaw: 0,
    sprint,
    actionBits: 0,
  };
}

function motion(state: PlayerState): any {
  return (state as PlayerState & { athleticMotion?: any }).athleticMotion;
}

function run(state: PlayerState, frames: number, degrees: number, sprint = false): PlayerState {
  let next = state;
  for (let i = 0; i < frames; i += 1) next = stepPlayerMovement(next, intent(degrees, 1, sprint), WORLD, DT);
  return next;
}

describe('Stage 05R deterministic athletic motion state', () => {
  test('body heading turns with movement and remains consistent with the animated athlete', () => {
    let state = createPlayerState({
      position: { x: 0, y: 0, z: 0 },
      velocity: { x: 0, y: 0, z: 5.8 },
      facingYaw: 0,
      locomotion: 'jog',
    });
    let previousYaw = state.athleticMotion.bodyYaw;
    let largestTurnStep = 0;
    for (let frame = 0; frame < 60; frame += 1) {
      state = stepPlayerMovement(state, intent(180), WORLD, DT);
      const yaw = state.athleticMotion.bodyYaw;
      largestTurnStep = Math.max(largestTurnStep, Math.abs(yawDelta(previousYaw, yaw)));
      previousYaw = yaw;
    }

    expect(largestTurnStep).toBeLessThan(0.13);
    expect(Math.abs(yawDelta(0, state.athleticMotion.bodyYaw))).toBeGreaterThan(2.5);

    const stopped = stepPlayerMovement(state, intent(0, 0), WORLD, DT);
    expect(Math.abs(yawDelta(state.athleticMotion.bodyYaw, stopped.athleticMotion.bodyYaw))).toBeLessThan(0.13);
    expect(Math.abs(yawDelta(0, stopped.athleticMotion.bodyYaw))).toBeGreaterThan(2.4);
  });

  test('stable jogging advances gait phase deterministically and alternates support feet', () => {
    let left = createPlayerState();
    let right = createPlayerState();
    const supports = new Set<string>();

    for (let frame = 0; frame < 120; frame += 1) {
      left = stepPlayerMovement(left, intent(0), WORLD, DT);
      right = stepPlayerMovement(right, intent(0), WORLD, DT);
      expect(motion(left)).toBeDefined();
      expect(motion(left)?.gaitPhase).toBeCloseTo(motion(right)?.gaitPhase, 10);
      supports.add(motion(left)?.supportFoot);
    }

    expect(supports.has('left')).toBe(true);
    expect(supports.has('right')).toBe(true);
  });

  test('releasing movement enters a braking gait before returning to idle', () => {
    let state = run(createPlayerState(), 50, 0);
    state = stepPlayerMovement(state, intent(0, 0), WORLD, DT);

    expect(motion(state)).toBeDefined();
    expect(motion(state)?.gait).toBe('brake');
    expect(motion(state)?.brakingDemand).toBeGreaterThan(0.15);
  });

  test('high-speed large-angle requests create more plant and braking demand than a 30 degree request', () => {
    const base = createPlayerState({
      velocity: { x: 0, y: 0, z: 8.1 },
      locomotion: 'sprint',
      stamina: 100,
    });

    const shallow = stepPlayerMovement(base, intent(30, 1, true), WORLD, DT);
    const right = stepPlayerMovement(base, intent(90, 1, true), WORLD, DT);
    const reverse = stepPlayerMovement(base, intent(180, 1, true), WORLD, DT);

    expect(motion(shallow)).toBeDefined();
    expect(motion(right)?.plantIntensity).toBeGreaterThan(motion(shallow)?.plantIntensity);
    expect(motion(reverse)?.plantIntensity).toBeGreaterThan(motion(right)?.plantIntensity);
    expect(motion(reverse)?.brakingDemand).toBeGreaterThan(motion(shallow)?.brakingDemand);
    expect(motion(reverse)?.propulsionDemand).toBeLessThan(0.5);
  });

  test('future trajectory responds immediately to changed intent while preserving current momentum', () => {
    const base = createPlayerState({
      velocity: { x: 0, y: 0, z: 6.4 },
      locomotion: 'jog',
    });

    const straight = stepPlayerMovement(base, intent(0), WORLD, DT);
    const turn = stepPlayerMovement(base, intent(90), WORLD, DT);

    expect(motion(straight)).toBeDefined();
    expect(motion(turn)?.trajectory?.length).toBeGreaterThanOrEqual(3);
    expect(Math.abs(motion(turn)?.trajectory?.[0]?.velocity?.z ?? 0)).toBeGreaterThan(3);
    expect(motion(turn)?.trajectory?.at(-1)?.position?.x).not.toBeCloseTo(
      motion(straight)?.trajectory?.at(-1)?.position?.x ?? 0,
      3,
    );
  });
});
