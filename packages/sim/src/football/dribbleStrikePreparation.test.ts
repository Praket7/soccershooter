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
  bodyYaw: 0,
  bodyYawRate: 0,
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
  realizedAcceleration: { x: 0, z: 0 },
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
    const setupSpeed = Math.hypot(
      preparing.state.activePlan!.targetBallVelocity.x,
      preparing.state.activePlan!.targetBallVelocity.z,
    );
    expect(setupSpeed).toBeGreaterThanOrEqual(4.9);
    expect(setupSpeed).toBeLessThanOrEqual(5.3);
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

  test('sprint shot setup preserves the runner carry pace instead of slowing the ball', () => {
    const sprintActor = { ...actor, velocity: { x: 0, y: 0, z: 8.1 }, sprinting: true };
    const sprintMotion = {
      ...motion,
      gait: 'sprint' as const,
      strideSeconds: 0.34,
      plannedVelocity: { x: 0, z: 8.1 },
      trajectory: motion.trajectory.map((sample) => ({
        ...sample,
        position: { x: 0, z: sample.time * 8.1 },
        velocity: { x: 0, z: 8.1 },
      })),
    };
    const sprintBall = { ...ball, velocity: { x: 0, y: 0, z: 8.2 } };
    const preparing = stepPlannedDribble({
      tick: 102,
      state: ordinaryCarry().state,
      actor: sprintActor,
      motion: sprintMotion,
      ball: sprintBall,
      desiredDirection: { x: 0, z: 1 },
      precision: false,
      sprint: true,
      pressure: 0,
      moveIntentMagnitude: 1,
      strikePreparation: true,
    });

    expect(preparing.state.activePlan).not.toBeNull();
    const setupSpeed = Math.hypot(
      preparing.state.activePlan!.targetBallVelocity.x,
      preparing.state.activePlan!.targetBallVelocity.z,
    );
    expect(setupSpeed).toBeGreaterThanOrEqual(7.8);
    expect(setupSpeed).toBeLessThanOrEqual(8.3);
  });
});
