import { describe, expect, it } from 'vitest';

async function loadHarness() {
  const module = await import('./harness').catch(() => null);
  expect(module, 'Stage 07 learning-lab harness must exist').not.toBeNull();
  return module as NonNullable<typeof module>;
}

function deterministicPart(report: unknown): Record<string, unknown> {
  const copy = JSON.parse(JSON.stringify(report)) as Record<string, unknown>;
  delete copy.averageInferenceMs;
  delete copy.maxInferenceMs;
  const metrics = copy.metrics as Record<string, unknown> | undefined;
  if (metrics) delete metrics.inferenceMs;
  return copy;
}

describe('Stage 07 executable learned-policy research lane', () => {
  it('trains a high-level policy and reproduces the same held-out behavior from the same seed', async () => {
    const { runLearningLabBenchmark } = await loadHarness();
    const options = { trainingScenarios: 1600, evaluationEpisodes: 400, seed: 0x7007beef };
    const first = runLearningLabBenchmark(options);
    const second = runLearningLabBenchmark(options);
    expect(deterministicPart(second)).toEqual(deterministicPart(first));
    expect(first.trainingExamples).toBe(1600);
    expect(first.evaluationEpisodes).toBe(400);
    expect(first.invalidProposalCount).toBe(0);
  });

  it('benchmarks the learned experiment against the deterministic expert on every machine-side promotion dimension', async () => {
    const { runLearningLabBenchmark } = await loadHarness();
    const report = runLearningLabBenchmark({ trainingScenarios: 2200, evaluationEpisodes: 600, seed: 0x7007cafe });

    expect(report.metrics.cooperationScore).toBeGreaterThanOrEqual(0.75);
    expect(report.metrics.cornerCaseSafety).toBeGreaterThanOrEqual(0.9);
    expect(report.metrics.exploitRate).toBeLessThanOrEqual(0.05);
    expect(report.metrics.inferenceMs).toBeLessThanOrEqual(1);
    expect(report.metrics.readabilityScore).toBeGreaterThanOrEqual(0.75);
    expect(report.metrics.winRate).toBeGreaterThanOrEqual(0.52);
    expect(report.metrics.humanPreference).toBeNull();
    expect(report.expertAgreement).toBeGreaterThanOrEqual(0.8);
  });

  it('keeps a machine-successful learned experiment blocked until humans prefer it', async () => {
    const { runLearningLabBenchmark } = await loadHarness();
    const report = runLearningLabBenchmark({ trainingScenarios: 2200, evaluationEpisodes: 600, seed: 0x7007d00d });
    expect(report.promotion.pass).toBe(false);
    expect(report.promotion.failures).toEqual(['human-preference-pending']);
    expect(report.enabledInProduction).toBe(false);
  });
});