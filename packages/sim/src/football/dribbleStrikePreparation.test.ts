import { describe, expect, test } from 'vitest';
import type { AthleticMotionState } from '../player/athleticMotion';
import { createPlannedDribbleState, stepPlannedDribble } from './dribblePlanner';
import type { FootballActorSnapshot, FootballBallSnapshot } from './types';

const actor: FootballActorSnapshot = {
  position: { x: 0, y: 0, z: 0 },
  velocity: { x: 0, y: 0, z: 5.0 },
  facingYaw: 0,
  balance: 1,
  pressure: 0,
  sprinting: false,
  preferredFoot: 'right',
};

const ball: FootballBallSnapshot = {
  position: { x: 0.08, y: 0.11, z: 0.78 },
  velocity: { x: 0, y: 0, z: 5.25 },
  angularVelocity: { x: 5.25 / 0.11, y: 0, z: 0 },
  radius: 0.11,
  mass: 0.436,
  grounded: true,
};

const motion: AthleticMotionState = {
  gait: 'jog',
  gaitPhase: 0.22,
  supportFoot: 'left',
  nextFoot: 'right',
  strideSeconds: 0.42,
  plantIntensity: 0,
  turnDemand: 0,
  brakingDemand: 0,
  propulsionDemand: 0.9,
  bodyLean: { forward: 0.12, lateral: 0 },
  plannedVelocity: { x: 0, z: 5.0 },
  trajectory: [
    { time: 0.15, position: { x: 0, z: 0.75 }, velocity: { x: 0, z: 5.0 } },
    { time: 0.30, position: { x: 0, z: 1.50 }, velocity: { x: 0, z: 5.0 } },
    { time: 0.45, position: { x: 0, z: 2.25 }, velocity: { x: 0, z: 5.0 } },
  ],
};

function ordinaryCarry() {
  const base = {
    ...createPlannedDribbleState(),
    lastContactTick: 100,
    lastContactFoot: 'left' as const,
  };
  return stepPlannedDribble({
    tick: 101,
    state: base,
    actor,
    motion,
    ball,
    desiredDirection: { x: 0, z: 1 },
    precision: false,
    sprint: false,
    pressure: 0,
    moveIntentMagnitude: 1,
  });
}

describe('running-shot dribble preparation', () => {
  test('charging a shot converts a distant carry touch into a near setup touch without welding the ball', () => {
    const ordinary = ordinaryCarry();
    expect(ordinary.state.activePlan).not.toBeNull();
    expect(ordinary.state.activePlan!.contactTick - 101).toBeGreaterThan(8);

    const preparing = stepPlannedDribble({
      tick: 102,
      state: ordinary.state,
      actor,
      motion,
      ball,
      desiredDirection: { x: 0, z: 1 },
      precision: false,
      sprint: false,
      pressure: 0,
      moveIntentMagnitude: 1,
      strikePreparation: true,
    });

    expect(preparing.contactApplied).toBe(false);
    expect(preparing.ball).toEqual(ball);
    expect(preparing.state.activePlan).not.toBeNull();
    expect(preparing.state.activePlan!.contactTick - 102).toBeGreaterThanOrEqual(2);
    expect(preparing.state.activePlan!.contactTick - 102).toBeLessThanOrEqual(5);
    expect(preparing.state.activePlan!.reason).toMatch(/^strike-setup-/);
    expect(Math.hypot(
      preparing.state.activePlan!.targetBallVelocity.x,
      preparing.state.activePlan!.targetBallVelocity.z,
    )).toBeLessThanOrEqual(Math.hypot(actor.velocity.x, actor.velocity.z) + 0.05);
  });

  test('live athletic motion carries held-shot preparation into the planner without a browser-only override', () => {
    const ordinary = ordinaryCarry();
    const preparing = stepPlannedDribble({
      tick: 102,
      state: ordinary.state,
      actor,
      motion: { ...motion, strikePreparation: true },
      ball,
      desiredDirection: { x: 0, z: 1 },
      precision: false,
      sprint: false,
      pressure: 0,
      moveIntentMagnitude: 1,
    });

    expect(preparing.state.activePlan).not.toBeNull();
    expect(preparing.state.activePlan!.contactTick - 102).toBeLessThanOrEqual(5);
    expect(preparing.state.activePlan!.reason).toMatch(/^strike-setup-/);
  });
});
