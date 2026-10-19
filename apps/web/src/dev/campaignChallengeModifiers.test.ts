import { describe, expect, it } from 'vitest';
import type { CampaignEncounter, LegacyGauntlet } from '@soccershooter/progression/campaign';
import { buildSyntheticCampaignGauntlet, resolveLiveCampaignModifiers, tacticalPitchScale } from './campaignChallengeModifiers';

const PROBLEMS: readonly CampaignEncounter['tacticalProblem'][] = [
  'basic-space',
  'high-press',
  'deep-block',
  'counterattack',
  'aerial-team',
  'elite-keeper',
  'possession-overload',
  'aggressive-marking',
];

describe('Road to Legend live tactical challenge modifiers', () => {
  it('turns authored tactical problems into distinct bounded gameplay conditions', () => {
    const profiles = Object.fromEntries(PROBLEMS.map((problem) => [problem, resolveLiveCampaignModifiers(problem, null)]));
    const basic = profiles['basic-space']!;

    expect(new Set(PROBLEMS.map((problem) => JSON.stringify(profiles[problem]))).size).toBeGreaterThanOrEqual(6);
    expect(profiles['high-press']!.pressure).toBeGreaterThan(basic.pressure);
    expect(profiles['deep-block']!.pitchScale).toBeLessThan(basic.pitchScale);
    expect(profiles['deep-block']!.keeperMaxHeight).toBeGreaterThan(basic.keeperMaxHeight);
    expect(profiles['counterattack']!.recoveryRate).toBeGreaterThan(basic.recoveryRate);
    expect(profiles['aerial-team']!.keeperMaxHeight).toBeGreaterThan(basic.keeperMaxHeight);
    expect(profiles['elite-keeper']!.keeperMaxHeight).toBeGreaterThan(profiles['aerial-team']!.keeperMaxHeight);
    expect(profiles['possession-overload']!.pitchScale).toBeLessThan(basic.pitchScale);
    expect(profiles['aggressive-marking']!.pressure).toBeGreaterThan(profiles['high-press']!.pressure);

    for (const profile of Object.values(profiles)) {
      expect(profile.pressure).toBeGreaterThanOrEqual(0);
      expect(profile.pressure).toBeLessThanOrEqual(0.9);
      expect(profile.pitchScale).toBeGreaterThanOrEqual(0.6);
      expect(profile.pitchScale).toBeLessThanOrEqual(1);
      expect(profile.recoveryRate).toBeGreaterThanOrEqual(0.7);
      expect(profile.recoveryRate).toBeLessThanOrEqual(2.5);
      expect(profile.keeperMaxHeight).toBeGreaterThanOrEqual(2.18);
      expect(profile.keeperMaxHeight).toBeLessThanOrEqual(2.7);
    }
  });

  it('maps authored problems onto existing authoritative challenge hooks', () => {
    expect(buildSyntheticCampaignGauntlet('basic-space')).toBeNull();
    for (const problem of PROBLEMS.filter((problem) => problem !== 'basic-space')) {
      expect(buildSyntheticCampaignGauntlet(problem)).not.toBeNull();
    }
    expect(buildSyntheticCampaignGauntlet('high-press')?.modifier).toBe('high-press');
    expect(buildSyntheticCampaignGauntlet('counterattack')?.modifier).toBe('quick-recovery');
    expect(buildSyntheticCampaignGauntlet('elite-keeper')?.modifier).toBe('aerial-pressure');
    expect(tacticalPitchScale('possession-overload')).toBeLessThan(1);
    expect(tacticalPitchScale('basic-space')).toBe(1);
  });

  it('composes a seeded Legacy modifier with the authored tactical problem instead of replacing it', () => {
    const legacy: LegacyGauntlet = {
      seed: 44,
      level: 3,
      modifier: 'small-pitch',
      modifierIntensity: 1.16,
      perfectClearObjective: 'win-without-conceding',
    };
    const tactical = resolveLiveCampaignModifiers('high-press', null);
    const combined = resolveLiveCampaignModifiers('high-press', legacy);

    expect(combined.pressure).toBeGreaterThanOrEqual(tactical.pressure);
    expect(combined.pitchScale).toBeLessThan(tactical.pitchScale);
    expect(combined.keeperMaxHeight).toBeGreaterThanOrEqual(tactical.keeperMaxHeight);
  });
});
