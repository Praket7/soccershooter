export interface LearningEpisodeSummary {
  goalsFor: number;
  goalsAgainst: number;
  progressivePasses: number;
  usefulSupportActions: number;
  repeatedPairPasses: number;
  backwardPasses: number;
  turnovers: number;
  shotsOnTarget: number;
}

export interface LearningEpisodeEvaluation {
  trainingReward: number;
  teamPerformance: number;
  rewardHackFlags: string[];
}

export interface PromotionMetrics {
  cooperationScore: number;
  cornerCaseSafety: number;
  exploitRate: number;
  inferenceMs: number;
  readabilityScore: number;
  winRate: number;
  humanPreference: number | null;
}

export interface PromotionEvaluation {
  pass: boolean;
  failures: string[];
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

export function evaluateLearningEpisode(summary: Readonly<LearningEpisodeSummary>): LearningEpisodeEvaluation {
  const rewardHackFlags: string[] = [];
  const passLoopRatio = summary.repeatedPairPasses / Math.max(1, summary.progressivePasses + summary.repeatedPairPasses);
  if (summary.repeatedPairPasses >= 8 && passLoopRatio > 0.6) rewardHackFlags.push('pass-loop');
  if (summary.backwardPasses >= 12 && summary.shotsOnTarget === 0) rewardHackFlags.push('non-progressive-possession');
  if (summary.goalsFor === 0 && summary.progressivePasses + summary.usefulSupportActions > 30) rewardHackFlags.push('non-winning-reward-farm');

  const goalReward = (summary.goalsFor - summary.goalsAgainst) * 4;
  const attackReward = Math.min(1.5, summary.shotsOnTarget * 0.22 + summary.progressivePasses * 0.045);
  const cooperationReward = Math.min(0.9, summary.usefulSupportActions * 0.035);
  const turnoverPenalty = summary.turnovers * 0.10;
  const loopPenalty = Math.max(0, summary.repeatedPairPasses - 3) * 0.08;
  const backwardPenalty = Math.max(0, summary.backwardPasses - 6) * 0.035;
  const hackPenalty = rewardHackFlags.length * 0.8;
  const trainingReward = goalReward + attackReward + cooperationReward - turnoverPenalty - loopPenalty - backwardPenalty - hackPenalty;

  const teamPerformance = clamp01(
    0.5
      + (summary.goalsFor - summary.goalsAgainst) * 0.24
      + Math.min(0.14, summary.shotsOnTarget * 0.025)
      + Math.min(0.12, summary.progressivePasses * 0.012)
      + Math.min(0.08, summary.usefulSupportActions * 0.008)
      - Math.min(0.18, summary.turnovers * 0.018)
      - Math.min(0.32, summary.repeatedPairPasses * 0.012 + summary.backwardPasses * 0.006),
  );

  return { trainingReward, teamPerformance, rewardHackFlags };
}

export function evaluatePromotion(metrics: Readonly<PromotionMetrics>): PromotionEvaluation {
  const failures: string[] = [];
  if (metrics.cooperationScore < 0.75) failures.push('cooperation');
  if (metrics.cornerCaseSafety < 0.90) failures.push('corner-case-safety');
  if (metrics.exploitRate > 0.05) failures.push('exploit-rate');
  if (metrics.inferenceMs > 1) failures.push('inference-time');
  if (metrics.readabilityScore < 0.75) failures.push('readability');
  if (metrics.winRate < 0.52) failures.push('win-rate');
  if (metrics.humanPreference === null) failures.push('human-preference-pending');
  else if (metrics.humanPreference < 0.60) failures.push('human-preference');
  return { pass: failures.length === 0, failures };
}
