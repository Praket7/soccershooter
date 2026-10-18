import { describe, expect, it } from 'vitest';
import {
  BOT_DIFFICULTY_TIERS,
  deterministicDifficultyNoise,
  difficultyParameterSnapshot,
  physicalDifficultySnapshot,
} from './difficulty';

describe('Stage 07 physical fairness contract', () => {
  it('novice, standard, and elite use identical authoritative physical multipliers', () => {
    const snapshots = BOT_DIFFICULTY_TIERS.map((tier) => physicalDifficultySnapshot(tier));
    expect(snapshots[1]).toEqual(snapshots[0]);
    expect(snapshots[2]).toEqual(snapshots[0]);
    expect(snapshots[0]).toEqual({
      movementSpeedScale: 1,
      accelerationScale: 1,
      staminaCapacityScale: 1,
      staminaDrainScale: 1,
      tackleColliderScale: 1,
      ballPhysicsScale: 1,
      goalkeeperReachScale: 1,
    });
  });

  it('physical snapshots expose no tier-specific override field', () => {
    for (const tier of BOT_DIFFICULTY_TIERS) {
      expect(Object.keys(physicalDifficultySnapshot(tier)).sort()).toEqual([
        'accelerationScale',
        'ballPhysicsScale',
        'goalkeeperReachScale',
        'movementSpeedScale',
        'staminaCapacityScale',
        'staminaDrainScale',
        'tackleColliderScale',
      ]);
    }
  });
});

describe('Stage 07 inspectable cognition profiles', () => {
  it('exposes every allowed difficulty difference in one parameter snapshot', () => {
    const novice = difficultyParameterSnapshot('novice');
    const standard = difficultyParameterSnapshot('standard');
    const elite = difficultyParameterSnapshot('elite');
    const expectedKeys = [
      'aimErrorRadians',
      'coordinatedRunFrequency',
      'defensiveAnticipation',
      'observationNoiseMetres',
      'passRiskTolerance',
      'predictionHorizonSeconds',
      'reactionDelaySeconds',
      'skillRepertoire',
      'spinErrorScale',
      'tacticalEvaluationIntervalSeconds',
    ];
    expect(Object.keys(novice).sort()).toEqual(expectedKeys);
    expect(Object.keys(standard).sort()).toEqual(expectedKeys);
    expect(Object.keys(elite).sort()).toEqual(expectedKeys);
    expect(novice.reactionDelaySeconds).toBeGreaterThan(standard.reactionDelaySeconds);
    expect(standard.reactionDelaySeconds).toBeGreaterThan(elite.reactionDelaySeconds);
    expect(novice.observationNoiseMetres).toBeGreaterThan(standard.observationNoiseMetres);
    expect(standard.observationNoiseMetres).toBeGreaterThan(elite.observationNoiseMetres);
    expect(elite.predictionHorizonSeconds).toBeGreaterThan(standard.predictionHorizonSeconds);
    expect(elite.defensiveAnticipation).toBeGreaterThan(standard.defensiveAnticipation);
    expect(elite.skillRepertoire.length).toBeGreaterThan(novice.skillRepertoire.length);
    expect(JSON.stringify({ novice, standard, elite })).not.toMatch(/speed|stamina|collider|physics|reach/i);
  });

  it('keeps all cognition parameters inside bounded, readable ranges', () => {
    for (const tier of BOT_DIFFICULTY_TIERS) {
      const snapshot = difficultyParameterSnapshot(tier);
      expect(snapshot.reactionDelaySeconds).toBeGreaterThanOrEqual(0);
      expect(snapshot.reactionDelaySeconds).toBeLessThanOrEqual(0.3);
      expect(snapshot.observationNoiseMetres).toBeGreaterThanOrEqual(0);
      expect(snapshot.observationNoiseMetres).toBeLessThanOrEqual(0.25);
      expect(snapshot.tacticalEvaluationIntervalSeconds).toBeGreaterThanOrEqual(0.06);
      expect(snapshot.tacticalEvaluationIntervalSeconds).toBeLessThanOrEqual(0.2);
      expect(snapshot.predictionHorizonSeconds).toBeGreaterThanOrEqual(0.15);
      expect(snapshot.predictionHorizonSeconds).toBeLessThanOrEqual(0.85);
      expect(snapshot.aimErrorRadians).toBeGreaterThanOrEqual(0);
      expect(snapshot.aimErrorRadians).toBeLessThanOrEqual(0.1);
      expect(snapshot.spinErrorScale).toBeGreaterThanOrEqual(0);
      expect(snapshot.spinErrorScale).toBeLessThanOrEqual(0.15);
      expect(snapshot.passRiskTolerance).toBeGreaterThanOrEqual(0);
      expect(snapshot.passRiskTolerance).toBeLessThanOrEqual(1);
      expect(snapshot.coordinatedRunFrequency).toBeGreaterThanOrEqual(0);
      expect(snapshot.coordinatedRunFrequency).toBeLessThanOrEqual(1);
      expect(snapshot.defensiveAnticipation).toBeGreaterThanOrEqual(0);
      expect(snapshot.defensiveAnticipation).toBeLessThanOrEqual(1);
    }
  });

  it('uses seeded deterministic cognition noise instead of ambient randomness', () => {
    const first = Array.from({ length: 16 }, (_, index) => deterministicDifficultyNoise(0x7007, index, 'h-1', 'observation-x'));
    const second = Array.from({ length: 16 }, (_, index) => deterministicDifficultyNoise(0x7007, index, 'h-1', 'observation-x'));
    const otherSeed = Array.from({ length: 16 }, (_, index) => deterministicDifficultyNoise(0x7008, index, 'h-1', 'observation-x'));
    expect(second).toEqual(first);
    expect(otherSeed).not.toEqual(first);
    expect(first.every((value) => value >= -1 && value <= 1)).toBe(true);
  });
});
