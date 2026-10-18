import { describe, expect, it } from 'vitest';

async function loadTournament() {
  const module = await import('./adaptiveTournament').catch(() => null);
  expect(module, 'Stage 07 adaptive tournament must exist').not.toBeNull();
  return module as NonNullable<typeof module>;
}

function deterministicPart(report: Record<string, unknown>) {
  const { averageDecisionMs: _average, maxDecisionMs: _max, ...rest } = report;
  return rest;
}

describe('Stage 07 adaptive bot simulation', () => {
  it('is deterministic and keeps physical laws identical across all tiers', async () => {
    const { runAdaptiveTournament } = await loadTournament();
    const options = { scenariosPerTier: 600, seed: 0x7007a11 };
    const first = runAdaptiveTournament(options);
    const second = runAdaptiveTournament(options);
    expect(deterministicPart(second)).toEqual(deterministicPart(first));
    expect(first.physicalInvariant).toBe(true);
    expect(first.simulationFailures).toBe(0);
    expect(first.illegalMidPossessionChanges).toBe(0);
    expect(first.pvpAdaptiveChanges).toBe(0);
    expect(first.learnedPolicyEnabledByDefault).toBe(false);
  });

  it('scales cognition quality from novice to standard to elite without cheating', async () => {
    const { runAdaptiveTournament } = await loadTournament();
    const report = runAdaptiveTournament({ scenariosPerTier: 900, seed: 0x7007b22 });
    expect(report.tiers.novice.referenceAgreement).toBeLessThan(report.tiers.standard.referenceAgreement);
    expect(report.tiers.standard.referenceAgreement).toBeLessThanOrEqual(report.tiers.elite.referenceAgreement);
    expect(report.tiers.novice.reactionSuccessRate).toBeLessThan(report.tiers.standard.reactionSuccessRate);
    expect(report.tiers.standard.reactionSuccessRate).toBeLessThanOrEqual(report.tiers.elite.reactionSuccessRate);
    expect(report.tiers.elite.meanAimErrorRadians).toBeLessThan(report.tiers.standard.meanAimErrorRadians);
    expect(report.tiers.standard.meanAimErrorRadians).toBeLessThan(report.tiers.novice.meanAimErrorRadians);
    expect(report.tiers.novice.completedScenarios).toBe(900);
    expect(report.tiers.standard.completedScenarios).toBe(900);
    expect(report.tiers.elite.completedScenarios).toBe(900);
  });

  it('detects reward farming and keeps learned policy promotion blocked pending humans', async () => {
    const { runAdaptiveTournament } = await loadTournament();
    const report = runAdaptiveTournament({ scenariosPerTier: 500, seed: 0x7007c33 });
    expect(report.rewardSafety.passSpamFlagged).toBe(true);
    expect(report.rewardSafety.winningRewardHigher).toBe(true);
    expect(report.learnedPromotion.pass).toBe(false);
    expect(report.learnedPromotion.failures).toContain('human-preference-pending');
    expect(report.personalityDistinctness).toBeGreaterThanOrEqual(3);
    expect(report.gate.pass).toBe(true);
    expect(report.gate.failures).toEqual([]);
  });
});
