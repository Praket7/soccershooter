import { describe, expect, test } from 'vitest';
import { BALL_CONSTANTS, createBallState } from '@soccershooter/physics/ball/BallState';
import { STANDARD_GOAL_FRAME, simulateBall } from '@soccershooter/physics/ball/trajectory';
import {
  BALL_LAB_PRESETS,
  buildCompleteExportTrace,
  buildLaunchFromControls,
  shouldStopBallLabSimulation,
  traceToCsv,
  type BallLabControls,
} from './BallLab';

describe('Stage 04 Ball Lab control contract', () => {
  test('builds a physical launch from speed, elevation, spin axis/rate, and knuckle seed', () => {
    const controls: BallLabControls = {
      speed: 25,
      elevationDegrees: 30,
      azimuthDegrees: 0,
      spinRate: 60,
      spinAxis: 'side',
      profileId: 'match-balanced-v1',
      slowMotion: 1,
      trailEnabled: true,
      knuckleSeed: 77,
    };
    const launch = buildLaunchFromControls(controls);
    expect(launch.position.y).toBeCloseTo(BALL_CONSTANTS.radius, 8);
    expect(Math.hypot(launch.velocity.x, launch.velocity.y, launch.velocity.z)).toBeCloseTo(25, 6);
    expect(launch.velocity.y).toBeCloseTo(12.5, 4);
    expect(launch.angularVelocity.y).toBeCloseTo(60, 6);
    expect(launch.knuckleSeed).toBe(77);
  });

  test('Post rebound preset actually reaches and rebounds from the right post', () => {
    const preset = BALL_LAB_PRESETS.find((candidate) => candidate.id === 'post');
    expect(preset).toBeDefined();
    const controls: BallLabControls = {
      speed: 24,
      elevationDegrees: 12,
      azimuthDegrees: 0,
      spinRate: 0,
      spinAxis: 'none',
      profileId: 'match-balanced-v1',
      slowMotion: 1,
      trailEnabled: true,
      knuckleSeed: 0,
      ...preset?.controls,
    };
    const trace = simulateBall(buildLaunchFromControls(controls), {
      seconds: 2,
      goalFrame: STANDARD_GOAL_FRAME,
    });
    const frameContact = trace.samples.find((sample) => sample.state.lastContact?.kind === 'goal-frame');
    expect(frameContact?.state.lastContact?.id).toBe('right-post');
    expect(frameContact?.state.position.y ?? 0).toBeGreaterThan(BALL_CONSTANTS.radius + 0.15);
  });

  test('CSV export carries diagnostics needed to audit energy, grounding, and contacts', () => {
    const csv = traceToCsv([
      { time: 0, state: buildLaunchFromControls({ speed: 20, elevationDegrees: 10, azimuthDegrees: 0, spinRate: 0, spinAxis: 'none', profileId: 'match-balanced-v1', slowMotion: 1, trailEnabled: true, knuckleSeed: 0 }) },
    ]);
    expect(csv.split('\n')[0]).toBe('time,x,y,z,vx,vy,vz,wx,wy,wz,speed,spin,energyJ,grounded,contactKind,contactId');
    expect(csv.split('\n')).toHaveLength(2);
  });

  test('exporting a configured Post rebound shot always yields a complete audit trace', () => {
    const preset = BALL_LAB_PRESETS.find((candidate) => candidate.id === 'post');
    expect(preset).toBeDefined();
    const controls: BallLabControls = {
      speed: 24,
      elevationDegrees: 12,
      azimuthDegrees: 0,
      spinRate: 0,
      spinAxis: 'none',
      profileId: 'match-balanced-v1',
      slowMotion: 1,
      trailEnabled: true,
      knuckleSeed: 0,
      ...preset?.controls,
    };
    const trace = buildCompleteExportTrace(controls);
    expect(trace.length).toBeGreaterThan(100);
    expect(trace.some((sample) => sample.state.lastContact?.id === 'right-post')).toBe(true);
    expect(trace.at(-1)?.time ?? 0).toBeGreaterThan(0.5);
  });

  test('complete export keeps sampling after the owner chip becomes grounded so roll can be audited', () => {
    // Exact owner launch state: 4.5 m/s, 34 degrees, +34 rad/s around X.
    // The old export ended on its first grounded sample. Turf calibration may
    // deliberately alter the later bounce/roll timing, so the regression locks
    // the launch and the real requirement: never terminate while still rolling.
    const controls: BallLabControls = {
      speed: 4.5,
      elevationDegrees: 34,
      azimuthDegrees: 0,
      spinRate: 34,
      spinAxis: 'top',
      profileId: 'match-balanced-v1',
      slowMotion: 1,
      trailEnabled: true,
      knuckleSeed: 0,
    };
    const trace = buildCompleteExportTrace(controls);
    expect(trace[0]?.state.velocity.y).toBeCloseTo(2.516368, 5);
    expect(trace[0]?.state.velocity.z).toBeCloseTo(3.730669, 5);
    expect(trace[0]?.state.angularVelocity.x).toBe(34);

    const firstGroundedIndex = trace.findIndex((sample) => sample.state.grounded);
    expect(firstGroundedIndex).toBeGreaterThan(0);
    const firstGrounded = trace[firstGroundedIndex]!;
    expect(Math.hypot(firstGrounded.state.velocity.x, firstGrounded.state.velocity.z)).toBeGreaterThan(2);
    expect(trace.length).toBeGreaterThan(firstGroundedIndex + 1);
    expect(trace.at(-1)?.time ?? 0).toBeGreaterThan(firstGrounded.time + 1);
    expect(Math.hypot(trace.at(-1)!.state.velocity.x, trace.at(-1)!.state.velocity.z)).toBeLessThan(0.05);
  });

  test('live Ball Lab stop policy does not freeze a still-moving grounded ball at the old eight-second cap', () => {
    const movingAtEightSeconds = createBallState({
      position: { x: 0, y: BALL_CONSTANTS.radius, z: 30 },
      velocity: { x: 0, y: 0, z: 1.2 },
      angularVelocity: { x: 1.2 / BALL_CONSTANTS.radius, y: 0, z: 0 },
      grounded: true,
      flightSeconds: 8.1,
    });
    expect(shouldStopBallLabSimulation(movingAtEightSeconds)).toBe(false);

    const settled = createBallState({
      position: { x: 0, y: BALL_CONSTANTS.radius, z: 35 },
      velocity: { x: 0, y: 0, z: 0.02 },
      grounded: true,
      flightSeconds: 9,
    });
    expect(shouldStopBallLabSimulation(settled)).toBe(true);

    const safetyCap = createBallState({
      position: { x: 0, y: 4, z: 100 },
      velocity: { x: 0, y: 1, z: 5 },
      grounded: false,
      flightSeconds: 20.01,
    });
    expect(shouldStopBallLabSimulation(safetyCap)).toBe(true);
  });
});
