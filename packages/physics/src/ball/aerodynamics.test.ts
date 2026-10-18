import { describe, expect, test } from 'vitest';
import { createBallState } from './BallState';
import {
  MATCH_BALL_PROFILE,
  aerodynamicAcceleration,
  dragCoefficientForSpeed,
  knuckleAcceleration,
  liftCoefficientForSpinParameter,
} from './aerodynamics';

describe('Stage 04 football aerodynamics', () => {
  test('drag table captures the soccer-ball drag crisis without discontinuities', () => {
    const slow = dragCoefficientForSpeed(6, MATCH_BALL_PROFILE);
    const supercritical = dragCoefficientForSpeed(18, MATCH_BALL_PROFILE);
    expect(slow).toBeGreaterThan(0.35);
    expect(supercritical).toBeGreaterThanOrEqual(0.14);
    expect(supercritical).toBeLessThanOrEqual(0.22);
    expect(supercritical).toBeLessThan(slow - 0.15);
    expect(Math.abs(dragCoefficientForSpeed(13.99, MATCH_BALL_PROFILE) - dragCoefficientForSpeed(14.01, MATCH_BALL_PROFILE))).toBeLessThan(0.01);
  });

  test('Magnus lift rises with spin parameter and saturates in the measured high-spin region', () => {
    const low = liftCoefficientForSpinParameter(0.1, MATCH_BALL_PROFILE);
    const medium = liftCoefficientForSpinParameter(0.5, MATCH_BALL_PROFILE);
    const high = liftCoefficientForSpinParameter(1.5, MATCH_BALL_PROFILE);
    expect(low).toBeGreaterThan(0);
    expect(medium).toBeGreaterThan(low);
    expect(medium).toBeCloseTo(0.35, 1);
    expect(high).toBeLessThanOrEqual(0.4);
    expect(high - medium).toBeLessThan(0.06);
  });

  test('Magnus direction follows omega cross velocity for side, top, and back spin', () => {
    const forward = { x: 0, y: 0, z: 24 };
    const side = aerodynamicAcceleration(createBallState({ velocity: forward, angularVelocity: { x: 0, y: 55, z: 0 } }), MATCH_BALL_PROFILE);
    const top = aerodynamicAcceleration(createBallState({ velocity: forward, angularVelocity: { x: 55, y: 0, z: 0 } }), MATCH_BALL_PROFILE);
    const back = aerodynamicAcceleration(createBallState({ velocity: forward, angularVelocity: { x: -55, y: 0, z: 0 } }), MATCH_BALL_PROFILE);
    expect(side.x).toBeGreaterThan(0);
    expect(top.y).toBeLessThan(back.y);
  });

  test('low-spin knuckle is bounded, continuous, seed-repeatable, and disabled by strong spin', () => {
    const lowSpin = createBallState({ velocity: { x: 0, y: 1, z: 23 }, angularVelocity: { x: 0.2, y: 0.3, z: 0.1 }, knuckleSeed: 12345, flightSeconds: 0.72 });
    const a = knuckleAcceleration(lowSpin, MATCH_BALL_PROFILE);
    const b = knuckleAcceleration({ ...lowSpin, position: { ...lowSpin.position }, velocity: { ...lowSpin.velocity }, angularVelocity: { ...lowSpin.angularVelocity } }, MATCH_BALL_PROFILE);
    const nearby = knuckleAcceleration({ ...lowSpin, position: { ...lowSpin.position }, velocity: { ...lowSpin.velocity }, angularVelocity: { ...lowSpin.angularVelocity }, flightSeconds: 0.721 }, MATCH_BALL_PROFILE);
    const otherSeed = knuckleAcceleration({ ...lowSpin, position: { ...lowSpin.position }, velocity: { ...lowSpin.velocity }, angularVelocity: { ...lowSpin.angularVelocity }, knuckleSeed: 54321 }, MATCH_BALL_PROFILE);
    const highSpin = knuckleAcceleration(createBallState({ velocity: { x: 0, y: 1, z: 23 }, angularVelocity: { x: 0, y: 45, z: 0 }, knuckleSeed: 12345, flightSeconds: 0.72 }), MATCH_BALL_PROFILE);

    expect(a).toEqual(b);
    expect(Math.hypot(a.x, a.y, a.z)).toBeLessThanOrEqual(9);
    expect(Math.hypot(a.x - nearby.x, a.y - nearby.y, a.z - nearby.z)).toBeLessThan(0.2);
    expect(otherSeed).not.toEqual(a);
    expect(Math.hypot(highSpin.x, highSpin.y, highSpin.z)).toBeLessThan(1e-9);
  });
});
