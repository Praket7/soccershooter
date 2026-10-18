import { describe, expect, it } from 'vitest';
import {
  evaluateLearningEpisode,
  evaluatePromotion,
} from './evaluate';

describe('Stage 07 learning-lab reward safety', () => {
  it('does not let pass spam outscore actually winning football', () => {
    const spam = evaluateLearningEpisode({
      goalsFor: 0, goalsAgainst: 0, progressivePasses: 2, usefulSupportActions: 2,
      repeatedPairPasses: 80, backwardPasses: 60, turnovers: 0, shotsOnTarget: 0,
    });
    const winning = evaluateLearningEpisode({
      goalsFor: 2, goalsAgainst: 0, progressivePasses: 8, usefulSupportActions: 6,
      repeatedPairPasses: 1, backwardPasses: 2, turnovers: 3, shotsOnTarget: 4,
    });
    expect(winning.trainingReward).toBeGreaterThan(spam.trainingReward + 2);
    expect(spam.rewardHackFlags).toContain('pass-loop');
    expect(spam.teamPerformance).toBeLessThan(winning.teamPerformance);
  });

  it('penalizes non-winning reward farming separately from performance metrics', () => {
    const farm = evaluateLearningEpisode({
      goalsFor: 0, goalsAgainst: 1, progressivePasses: 50, usefulSupportActions: 40,
      repeatedPairPasses: 45, backwardPasses: 30, turnovers: 1, shotsOnTarget: 0,
    });
    expect(farm.trainingReward).toBeLessThan(0);
    expect(farm.teamPerformance).toBeLessThan(0.5);
    expect(farm.rewardHackFlags.length).toBeGreaterThan(0);
  });

  it('cannot promote a learned policy without human preference evidence', () => {
    const machineOnly = evaluatePromotion({
      cooperationScore: 0.92,
      cornerCaseSafety: 0.98,
      exploitRate: 0.01,
      inferenceMs: 0.25,
      readabilityScore: 0.9,
      winRate: 0.62,
      humanPreference: null,
    });
    expect(machineOnly.pass).toBe(false);
    expect(machineOnly.failures).toContain('human-preference-pending');
  });

  it('requires every promotion metric, not win rate alone', () => {
    const exploitative = evaluatePromotion({
      cooperationScore: 0.4,
      cornerCaseSafety: 0.7,
      exploitRate: 0.2,
      inferenceMs: 0.4,
      readabilityScore: 0.5,
      winRate: 0.9,
      humanPreference: 0.9,
    });
    expect(exploitative.pass).toBe(false);
    expect(exploitative.failures).toContain('exploit-rate');
    expect(exploitative.failures).toContain('cooperation');
  });
});
