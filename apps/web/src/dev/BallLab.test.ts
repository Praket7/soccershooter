import { describe, expect, test } from 'vitest';
import { BALL_CONSTANTS } from '@soccershooter/physics/ball/BallState';
import { buildLaunchFromControls, traceToCsv, type BallLabControls } from './BallLab';

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

  test('CSV export contains deterministic time/position/velocity/spin columns', () => {
    const csv = traceToCsv([
      { time: 0, state: buildLaunchFromControls({ speed: 20, elevationDegrees: 10, azimuthDegrees: 0, spinRate: 0, spinAxis: 'none', profileId: 'match-balanced-v1', slowMotion: 1, trailEnabled: true, knuckleSeed: 0 }) },
    ]);
    expect(csv.split('\n')[0]).toBe('time,x,y,z,vx,vy,vz,wx,wy,wz');
    expect(csv.split('\n')).toHaveLength(2);
  });
});
