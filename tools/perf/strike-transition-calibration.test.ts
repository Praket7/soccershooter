import { describe, expect, it } from 'vitest';
import { runStrikeTransitionCalibration } from './strike-transition-calibration';

describe('Stage 05R pass/shot transition calibration', () => {
  it('measures deterministic legal contact windows for both dribble transitions', () => {
    const report = runStrikeTransitionCalibration();

    expect(report.transitions.shot.samples).toBe(20);
    expect(report.transitions.pass.samples).toBe(20);
    // Ordinary legal running actions should bind to the next reachable foot
    // beat. The former 5-18 tick allowance encoded the sluggish behavior the
    // owner rejected, so the rebuilt contract is deliberately much tighter.
    expect(report.transitions.shot.contactDelayTicks.min).toBeGreaterThanOrEqual(2);
    expect(report.transitions.shot.contactDelayTicks.max).toBeLessThanOrEqual(8);
    expect(report.transitions.pass.contactDelayTicks).toEqual(report.transitions.shot.contactDelayTicks);
    expect(report.transitions.shot.legalContactRate).toBe(1);
    expect(report.transitions.pass.legalContactRate).toBe(1);
    expect(runStrikeTransitionCalibration()).toEqual(report);
  });
});
