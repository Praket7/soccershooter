import { describe, expect, it } from 'vitest';
import { runDribbleCalibration } from './dribble-calibration';

describe('Stage 05R dribble calibration matrix', () => {
  it('produces deterministic distributions for gait, turn, pressure, foot, recovery, and receive scenarios', () => {
    const report = runDribbleCalibration();
    expect(report.scenarios).toHaveLength(16);
    expect(report.distributions.contactTimingErrorTicks.max).toBe(0);
    expect(report.distributions.ballDistanceAtContactMeters.count).toBeGreaterThan(40);
    expect(report.distributions.exitSpeedRetention.count).toBeGreaterThan(40);
    expect(report.distributions.plantDurationTicks.max).toBeGreaterThan(0);
    expect(report.distributions.inputToMotionResponseLatencyTicks.max).toBeGreaterThan(0);
    const measuredResponseScenarios = report.scenarios
      .map(({ metrics }) => metrics.inputToMotionResponseLatencyTicks)
      .filter((latency): latency is number => latency !== null);
    expect(report.distributions.inputToMotionResponseLatencyTicks.count).toBe(measuredResponseScenarios.length);
    expect(report.distributions.inputToMotionResponseLatencyTicks.p10).toBeGreaterThan(0);
    expect(report.scenarios.find(({ scenario }) => scenario === 'pressure-from-left')?.metrics.footUsage.left).toBeGreaterThan(0);
    expect(report.scenarios.find(({ scenario }) => scenario === 'pressure-from-right')?.metrics.footUsage.right).toBeGreaterThan(0);
    expect(report.scenarios.find(({ scenario }) => scenario === 'trap-to-controlled-exit')?.metrics.contacts).toBeGreaterThan(0);
    expect(runDribbleCalibration()).toEqual(report);
  });

  it('reports how far the free ball separates and how closely its speed tracks the carrier', () => {
    const report = runDribbleCalibration();
    const straight = report.scenarios.find(({ scenario }) => scenario === 'straight-jog');
    const reversal = report.scenarios.find(({ scenario }) => scenario === '180-degree-jog-reversal');

    expect(straight?.metrics.maxSeparationMeters).toBeGreaterThan(0.6);
    expect(straight?.metrics.maxSeparationMeters).toBeLessThan(1.12);
    expect(straight?.metrics.meanBallPlayerSpeedDeltaMetersPerSecond).toBeLessThan(0.5);
    expect(report.scenarios.find(({ scenario }) => scenario === '90-degree-jog-cut')?.metrics.maxSeparationMeters).toBeLessThan(1.12);
    expect(report.scenarios.find(({ scenario }) => scenario === 'sprint-knock-on-cut')?.metrics.maxSeparationMeters).toBeLessThan(1.38);
    expect(reversal?.metrics.maxSeparationMeters).toBeGreaterThan(0.6);
    // A single full 180-degree reversal at jog is intentionally the exception
    // to ordinary carry retention; it is a bad turn and can leave the ball loose.
    expect(reversal?.metrics.maxSeparationMeters).toBeLessThan(5.0);
    expect(report.distributions.maxSeparationMeters.count).toBe(16);
  });
});
