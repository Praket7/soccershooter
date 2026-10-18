import { describe, expect, test } from 'vitest';
import { BALL_CONSTANTS, createBallState, kineticEnergy } from './BallState';
import { MATCH_BALL_PROFILE } from './aerodynamics';
import {
  BALL_SUBSTEP_HZ,
  GOLDEN_LAUNCHES,
  STANDARD_GOAL_FRAME,
  predictTrajectory,
  resolveGoalFrameCollision,
  simulateBall,
} from './trajectory';

describe('Stage 04 golden football trajectories', () => {
  test('uses 120 Hz football substeps independent of rendering', () => {
    expect(BALL_SUBSTEP_HZ).toBe(120);
  });

  test('zero-spin shot stays near its vertical plane while sidespin curves in omega-cross-v direction', () => {
    const straight = simulateBall(GOLDEN_LAUNCHES.straight20, { seconds: 2.5, profile: MATCH_BALL_PROFILE });
    const curl = simulateBall(GOLDEN_LAUNCHES.curl20, { seconds: 2.5, profile: MATCH_BALL_PROFILE });
    const straightMaxX = Math.max(...straight.samples.map((sample) => Math.abs(sample.state.position.x)));
    const curlMaxX = Math.max(...curl.samples.map((sample) => sample.state.position.x));
    expect(straightMaxX).toBeLessThan(0.05);
    expect(curlMaxX).toBeGreaterThan(0.45);
  });

  test('topspin drops sooner while backspin carries longer than zero-spin from the same launch', () => {
    const base = GOLDEN_LAUNCHES.straight20;
    const top = createBallState({ ...base, angularVelocity: { x: 55, y: 0, z: 0 } });
    const back = createBallState({ ...base, angularVelocity: { x: -55, y: 0, z: 0 } });
    const zeroLanding = predictTrajectory(base, { profile: MATCH_BALL_PROFILE }).landing;
    const topLanding = predictTrajectory(top, { profile: MATCH_BALL_PROFILE }).landing;
    const backLanding = predictTrajectory(back, { profile: MATCH_BALL_PROFILE }).landing;
    expect(topLanding.time).toBeLessThan(zeroLanding.time);
    expect(backLanding.time).toBeGreaterThan(zeroLanding.time);
    expect(backLanding.position.z).toBeGreaterThan(topLanding.position.z + 1);
  });

  test('more legal sidespin increases curve until aerodynamic lift saturation', () => {
    const base = GOLDEN_LAUNCHES.curl20;
    const curveAt = (spin: number) => predictTrajectory(createBallState({ ...base, angularVelocity: { x: 0, y: spin, z: 0 } }), { profile: MATCH_BALL_PROFILE }).landing.position.x;
    const low = curveAt(20);
    const medium = curveAt(60);
    const high = curveAt(140);
    expect(medium).toBeGreaterThan(low + 0.15);
    expect(high).toBeGreaterThanOrEqual(medium);
    expect(high - medium).toBeLessThan(medium - low);
  });

  test('knuckle path is bounded and exactly repeatable for the same seed', () => {
    const a = simulateBall(GOLDEN_LAUNCHES.knuckle, { seconds: 2.5, profile: MATCH_BALL_PROFILE });
    const b = simulateBall(GOLDEN_LAUNCHES.knuckle, { seconds: 2.5, profile: MATCH_BALL_PROFILE });
    expect(a.finalState).toEqual(b.finalState);
    const lateral = Math.max(...a.samples.map((sample) => Math.abs(sample.state.position.x)));
    expect(lateral).toBeGreaterThan(0.01);
    expect(lateral).toBeLessThan(3);
  });

  test('trajectory predictor is the authoritative integrator, not a separate approximation', () => {
    const predicted = predictTrajectory(GOLDEN_LAUNCHES.lofted, { profile: MATCH_BALL_PROFILE });
    const replayed = simulateBall(GOLDEN_LAUNCHES.lofted, { seconds: predicted.landing.time, profile: MATCH_BALL_PROFILE });
    expect(replayed.finalState.position.x).toBeCloseTo(predicted.landing.position.x, 6);
    expect(replayed.finalState.position.z).toBeCloseTo(predicted.landing.position.z, 6);
  });

  test('goal post and crossbar collision never creates an energy explosion', () => {
    const incoming = createBallState({
      position: { x: STANDARD_GOAL_FRAME.halfWidth - 0.04, y: 1.0, z: STANDARD_GOAL_FRAME.planeZ - 0.08 },
      velocity: { x: 1.5, y: 0, z: 24 },
      angularVelocity: { x: 0, y: 25, z: 0 },
    });
    const before = kineticEnergy(incoming);
    const after = resolveGoalFrameCollision(incoming, STANDARD_GOAL_FRAME);
    expect(after.lastContact?.kind).toBe('goal-frame');
    expect(kineticEnergy(after)).toBeLessThanOrEqual(before * 1.000001);
  });

  test('all required Stage 04 reference launches are present and physically finite', () => {
    expect(Object.keys(GOLDEN_LAUNCHES).sort()).toEqual(['chip', 'curl20', 'driven10', 'knuckle', 'lofted', 'postRebound', 'power25', 'straight20'].sort());
    for (const launch of Object.values(GOLDEN_LAUNCHES)) {
      const trace = simulateBall(launch, { seconds: 3, profile: MATCH_BALL_PROFILE });
      for (const value of [trace.finalState.position.x, trace.finalState.position.y, trace.finalState.position.z, trace.finalState.velocity.x, trace.finalState.velocity.y, trace.finalState.velocity.z]) {
        expect(Number.isFinite(value)).toBe(true);
      }
    }
  });
});
