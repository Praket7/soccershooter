import { describe, expect, it } from 'vitest';

async function loadTournament() {
  const module = await import('./tacticalTournament').catch(() => null);
  expect(module, 'Stage 06 tactical tournament must exist').not.toBeNull();
  return module as NonNullable<typeof module>;
}

function deterministicMetrics<T extends { averageDecisionMsPerTeam: number; p99DecisionMsPerTeam: number; maxDecisionMsPerTeam: number }>(report: T) {
  const { averageDecisionMsPerTeam: _average, p99DecisionMsPerTeam: _p99, maxDecisionMsPerTeam: _max, ...deterministic } = report;
  return deterministic;
}

describe('Stage 06 headless tactical tournament', () => {
  it('is deterministic and completes thousands of 3v3 possessions without swarming or keeper abandonment', async () => {
    const { runTacticalTournament } = await loadTournament();
    const options = { possessions: 2000, seed: 0x600d5eed };
    const first = runTacticalTournament(options);
    const second = runTacticalTournament(options);
    expect(deterministicMetrics(second)).toEqual(deterministicMetrics(first));
    expect(first.possessionsRequested).toBe(2000);
    expect(first.possessionsCompleted).toBe(2000);
    expect(first.failures).toBe(0);
    expect(first.keeperAbandonments).toBe(0);
    expect(first.permanentSwarmPossessions).toBe(0);
    expect(first.clusterRatio).toBeLessThan(0.12);
    expect(first.idleRatio).toBeLessThan(0.08);
  });

  it('exports role occupancy alongside pass and clustering statistics', async () => {
    const { runTacticalTournament } = await loadTournament();
    const report = runTacticalTournament({ possessions: 500, seed: 0x0cc0a11 });
    expect(report.roleOccupancy.goalkeeper).toBeGreaterThan(0);
    expect(report.roleOccupancy['ball-carrier']).toBeGreaterThan(0);
    expect(report.roleOccupancy['immediate-support']).toBeGreaterThan(0);
    expect(report.roleOccupancy.presser).toBeGreaterThan(0);
    expect(report.roleOccupancy['cover-defender']).toBeGreaterThan(0);
    expect(Object.values(report.roleOccupancy).reduce((sum, value) => sum + value, 0)).toBeGreaterThan(0);
  });

  it('uses a high-percentile CPU budget instead of failing on one scheduler outlier', async () => {
    const { runTacticalTournament } = await loadTournament();
    const { evaluateTacticalTournamentGate } = await import('./tournament');
    const report = runTacticalTournament({ possessions: 500, seed: 0x51a6e006 });
    expect(report.p99DecisionMsPerTeam).toBeLessThan(1);

    const isolatedPause = { ...report, maxDecisionMsPerTeam: 25 };
    expect(evaluateTacticalTournamentGate(isolatedPause).pass).toBe(true);

    const sustainedSlowdown = { ...report, p99DecisionMsPerTeam: 1.25 };
    const gate = evaluateTacticalTournamentGate(sustainedSlowdown);
    expect(gate.pass).toBe(false);
    expect(gate.failures.some((failure) => failure.includes('p99 tactical decision'))).toBe(true);
  });

  it('produces useful passing and respects the Stage 06 tactical CPU budget', async () => {
    const { runTacticalTournament } = await loadTournament();
    const report = runTacticalTournament({ possessions: 3000, seed: 0x51a6e006 });
    expect(report.passAttempts).toBeGreaterThan(report.possessionsCompleted * 0.65);
    expect(report.completedPasses).toBeGreaterThan(report.passAttempts * 0.52);
    expect(report.multiPassPossessions).toBeGreaterThan(report.possessionsCompleted * 0.18);
    expect(report.shots).toBeGreaterThan(0);
    expect(report.averageSupportDistance).toBeGreaterThan(3.2);
    expect(report.averageSupportDistance).toBeLessThan(10.5);
    expect(report.averageDecisionMsPerTeam).toBeLessThan(1);
    expect(report.p99DecisionMsPerTeam).toBeLessThan(1);
    expect(Number.isFinite(report.maxDecisionMsPerTeam)).toBe(true);
  });
});