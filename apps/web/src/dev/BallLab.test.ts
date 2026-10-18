import { describe, expect, test } from 'vitest';
import { BALL_CONSTANTS } from '@soccershooter/physics/ball/BallState';
import { STANDARD_GOAL_FRAME, simulateBall } from '@soccershooter/physics/ball/trajectory';
import {
  BALL_LAB_PRESETS,
  buildCompleteExportTrace,
  buildLaunchFromControls,
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

  test('complete export keeps sampling after a chip becomes grounded so roll can be audited', () => {
    // Reproduces the owner-exported custom chip: 4.5 m/s, 34 degrees,
    // 34 rad/s backspin. The old export stopped at 0.9 s as soon as the
    // vertical bounce sequence ended, while the ball still rolled at ~3.4 m/s.
    const controls: BallLabControls = {
      speed: 4.5,
      elevationDegrees: 34,
      azimuthDegrees: 0,
      spinRate: 34,
      spinAxis: 'back',
      profileId: 'match-balanced-v1',
      slowMotion: 1,
      trailEnabled: true,
      knuckleSeed: 0,
    };
    const trace = buildCompleteExportTrace(controls);
    const firstGroundedIndex = trace.findIndex((sample) => sample.state.grounded);
    expect(firstGroundedIndex).toBeGreaterThan(0);
    const firstGrounded = trace[firstGroundedIndex]!;
    expect(firstGrounded.time).toBeCloseTo(0.9, 2);
    expect(Math.hypot(firstGrounded.state.velocity.x, firstGrounded.state.velocity.z)).toBeGreaterThan(3);
    expect(trace.length).toBeGreaterThan(firstGroundedIndex + 1);
    expect(trace.at(-1)?.time ?? 0).toBeGreaterThan(firstGrounded.time + 1);
  });
});
