import { describe, expect, it } from 'vitest';
import { runDribbleInputStress } from './dribble-input-stress';

describe('Stage 05R player-input retention stress', () => {
  it('keeps ordinary forward, reverse, and lateral transitions inside the recoverable carry pocket', () => {
    const report = runDribbleInputStress();
    const byName = new Map(report.scenarios.map((scenario) => [scenario.scenario, scenario]));

    expect(byName.get('forward-to-reverse')?.maxSeparationMeters).toBeLessThan(1.25);
    expect(byName.get('forward-to-reverse')?.ticksBeyondOneMeterRate).toBeLessThan(0.2);
    expect(byName.get('left-to-right')?.maxSeparationMeters).toBeLessThan(1.2);
    expect(byName.get('left-to-right')?.ticksBeyondOneMeterRate).toBeLessThan(0.2);
    expect(byName.get('forward-lateral-slalom')?.maxSeparationMeters).toBeLessThan(0.9);
    expect(byName.get('rapid-jog-zigzag')?.maxSeparationMeters).toBeLessThan(1.3);
  });

  it('keeps straight sprint, a sprint cut, and a full sprint reversal inside a recoverable pocket', () => {
    const report = runDribbleInputStress();
    const byName = new Map(report.scenarios.map((scenario) => [scenario.scenario, scenario]));

    expect(byName.get('straight-sprint')?.maxSeparationMeters).toBeLessThan(1.38);
    expect(byName.get('sprint-to-lateral-cut')?.maxSeparationMeters).toBeLessThan(1.0);
    expect(byName.get('sprint-reversal')?.maxSeparationMeters).toBeLessThan(1.5);
    expect(byName.get('sprint-reversal')?.looseBallRate).toBe(0);
  });

  it('keeps a moving ball within one meter through continuous jog and sprint circles', () => {
    const report = runDribbleInputStress();
    const byName = new Map(report.scenarios.map((scenario) => [scenario.scenario, scenario]));

    expect(byName.get('continuous-circle-jog')?.maxSeparationMeters).toBeLessThan(1.0);
    expect(byName.get('continuous-circle-jog')?.looseBallRate).toBe(0);
    expect(byName.get('continuous-circle-sprint')?.maxSeparationMeters).toBeLessThan(0.9);
    expect(byName.get('continuous-circle-sprint')?.looseBallRate).toBe(0);
  });

  it('prevents the ball from falling behind during tight jog and sprint circles', () => {
    const report = runDribbleInputStress();
    const byName = new Map(report.scenarios.map((scenario) => [scenario.scenario, scenario]));

    expect(byName.get('tight-circle-jog')?.maxBehindMeters).toBeLessThan(0.17);
    expect(byName.get('tight-circle-sprint')?.maxBehindMeters).toBeLessThan(0.20);
    expect(byName.get('tight-circle-sprint')?.meanBallPlayerSpeedDeltaMetersPerSecond).toBeLessThan(0.70);
    expect(byName.get('tight-circle-sprint')?.looseBallRate).toBe(0);
  });
});
