import { describe, expect, test } from 'vitest';
import type { AthleticMotionState } from '../player/athleticMotion';
import { createPlannedDribbleState, stepPlannedDribble } from './dribblePlanner';
import { createStrikeContactPlan } from './strikePlanner';
import type { FootballActorSnapshot, FootballBallSnapshot, FootballVec3 } from './types';

function actorAt(z: number, speed = 4.7): FootballActorSnapshot {
  return {
    position: { x: 0, y: 0, z },
    velocity: { x: 0, y: 0, z: speed },
    facingYaw: 0,
    balance: 1,
    pressure: 0,
    sprinting: false,
    preferredFoot: 'right',
  };
}

function ballAt(z: number, speed = 0): FootballBallSnapshot {
  return {
    position: { x: 0, y: 0.11, z },
    velocity: { x: 0, y: 0, z: speed },
    angularVelocity: { x: speed / 0.11, y: 0, z: 0 },
    radius: 0.11,
    mass: 0.436,
    grounded: true,
  };
}

function motionAt(z: number): AthleticMotionState {
  return {
    gait: 'jog',
    gaitPhase: 0.18,
    supportFoot: 'left',
    nextFoot: 'right',
    strideSeconds: 0.42,
    plantIntensity: 0,
    turnDemand: 0,
    brakingDemand: 0,
    propulsionDemand: 0.9,
    bodyLean: { forward: 0.12, lateral: 0 },
    plannedVelocity: { x: 0, z: 5 },
    trajectory: [
      { time: 0.15, position: { x: 0, z: z + 0.70 }, velocity: { x: 0, z: 4.8 } },
      { time: 0.30, position: { x: 0, z: z + 1.45 }, velocity: { x: 0, z: 5.0 } },
      { time: 0.45, position: { x: 0, z: z + 2.20 }, velocity: { x: 0, z: 5.0 } },
    ],
  };
}

describe('football feel regressions', () => {
  test('dribble replanning uses world-space trajectory samples correctly away from the origin', () => {
    const actor = actorAt(-13);
    const motion = motionAt(-13);
    const first = stepPlannedDribble({
      tick: 100,
      state: createPlannedDribbleState(),
      actor,
      motion,
      ball: ballAt(-12.42, 4.2),
      desiredDirection: { x: 0, z: 1 },
      precision: false,
      sprint: false,
      pressure: 0,
      moveIntentMagnitude: 1,
    });
    expect(first.state.activePlan).not.toBeNull();

    // The free ball is temporarily outside root reach, but the athlete's
    // absolute near-future trajectory closes the gap before the already-planned
    // contact. This is the normal situation during a carry/knock-on away from
    // world origin, including the practice spawn at z=-13.
    const replanned = stepPlannedDribble({
      tick: 101,
      state: first.state,
      actor,
      motion,
      ball: ballAt(-11.45, 0),
      desiredDirection: { x: 0, z: 1 },
      precision: false,
      sprint: false,
      pressure: 0,
      moveIntentMagnitude: 1,
    });

    expect(replanned.state.activePlan).not.toBeNull();
    expect(replanned.state.looseBall).toBe(false);
    expect(replanned.reason).toBe('awaiting-contact');
  });

  test('running strike setup predicts player translation as well as ball translation', () => {
    const actorPosition: FootballVec3 = { x: 0, y: 0, z: -13 };
    const actorVelocity: FootballVec3 = { x: 0, y: 0, z: 5 };
    const movingBall = ballAt(-12.42, 5);
    const request = {
      kind: 'shot' as const,
      sourceId: 'running-shot',
      tick: 20,
      gaitPhase: 0.18,
      strideSeconds: 0.58,
      actorPosition,
      actorVelocity,
      ball: movingBall,
      targetBallVelocity: { x: 0, y: 4, z: 24 },
      preferredFoot: 'right' as const,
      balance: 1,
    };

    const plan = createStrikeContactPlan(request);
    expect(plan).not.toBeNull();
    // Presentation must begin acknowledging the requested strike immediately;
    // the physical impulse can still wait for the selected gait/contact beat.
    expect(plan!.prepareTick).toBe(request.tick);
  });
});
