import { describe, expect, it } from 'vitest';
import { ARCHETYPE_MODIFIERS, createFreshProfile, awardEncounter, migrateProfile, exportProfile, importProfile, resolveRunUpgradeModifiers, selectArchetype } from './profile';
import { CAMPAIGN_ACTS, advanceCampaign, createLegacyGauntlet, enterLegacy, finishLegacyGauntlet, simulateSkilledCampaign } from './campaign';

describe('Road to Legend progression', () => {
  it('starts a fresh player at the intended baseline with early technique access', () => {
    const profile = createFreshProfile();
    expect(profile.version).toBe(2);
    expect(profile.presentationOvr).toBe(67);
    expect(profile.unlockedTechniques.length).toBeGreaterThan(0);
    expect(profile.campaignActId).toBe('street-beginner');
  });

  it('awards useful wins, modest losses, and no reward for farming the same encounter', () => {
    const profile = createFreshProfile();
    const win = awardEncounter(profile, { encounterId: 'street-01', outcome: 'win', goalsFor: 2, goalsAgainst: 0, seed: 11 });
    const repeated = awardEncounter(win.profile, { encounterId: 'street-01', outcome: 'loss', goalsFor: 0, goalsAgainst: 3, seed: 99 });
    const loss = awardEncounter(profile, { encounterId: 'street-02', outcome: 'loss', goalsFor: 0, goalsAgainst: 2, seed: 12 });
    expect(win.reward.xp).toBeGreaterThan(loss.reward.xp);
    expect(repeated.reward.xp).toBe(0);
    expect(repeated.profile.xp).toBe(win.profile.xp);
  });

  it('migrates prior saves, round-trips exports, and rejects malformed JSON', () => {
    const migrated = migrateProfile({ version: 1, xp: 80, unlockedTechniques: ['stepover'] });
    expect(migrated.version).toBe(2);
    expect(migrated.unlockedTechniques).toContain('stepover');
    expect(importProfile(exportProfile(migrated))).toEqual(migrated);
    expect(() => importProfile('{broken')).toThrow();
  });

  it('advances through data-driven acts and continues indefinitely in seeded Legacy', () => {
    let profile = createFreshProfile();
    for (const act of CAMPAIGN_ACTS) {
      profile = { ...profile, campaignActId: act.id, campaignEncounterIndex: act.encounters.length - 1 };
      profile = advanceCampaign(profile, true);
    }
    expect(profile.campaignComplete).toBe(true);
    profile = enterLegacy(profile, 44);
    const gauntlet = createLegacyGauntlet(profile, 44);
    expect(['high-press', 'small-pitch', 'quick-recovery', 'aerial-pressure']).toContain(gauntlet.modifier);
    expect(gauntlet.modifierIntensity).toBeGreaterThanOrEqual(1);
    const next = finishLegacyGauntlet(profile, 44, true, { score: 3, perfectClear: true });
    expect(next.legacyLevel).toBe(profile.legacyLevel + 1);
    expect(next.legacySeed).not.toBe(44);
    expect(next.legacyPersonalBests['legacy-level-1']).toBe(3);
    expect(next.perfectLegacyClears).toContain('legacy-seed-44');
    expect(createLegacyGauntlet(next, next.legacySeed!).modifierIntensity).toBeGreaterThan(gauntlet.modifierIntensity);
  });

  it('simulates a full seeded campaign and keeps three distinct, freely switchable build paths', () => {
    const technical = simulateSkilledCampaign('technical', 1234);
    const pace = simulateSkilledCampaign('pace', 1234);
    const power = simulateSkilledCampaign('power', 1234);
    expect(technical.profile.campaignComplete).toBe(true);
    expect(technical.wins).toBe(CAMPAIGN_ACTS.reduce((total, act) => total + act.encounters.length, 0));
    expect(technical.simulatedTicks).toBeGreaterThan(technical.wins);
    expect(technical.physicalContacts).toBeGreaterThan(technical.wins);
    expect(technical.goalsScored).toBe(technical.wins);
    expect(technical.profile.highlights).toHaveLength(technical.wins);
    expect(technical.checksum).toBe(simulateSkilledCampaign('technical', 1234).checksum);
    expect(new Set([
      ARCHETYPE_MODIFIERS.technical.contactTimingTicks,
      ARCHETYPE_MODIFIERS.pace.sprintStaminaCostScale,
      ARCHETYPE_MODIFIERS.power.strikeImpulseScale,
    ]).size).toBe(3);
    expect(selectArchetype(selectArchetype(pace.profile, 'power'), 'technical').archetype).toBe('technical');
    expect([technical, pace, power].map((run) => run.profile.runChoices.join(','))).toEqual([
      expect.any(String), expect.any(String), expect.any(String),
    ]);
    expect(resolveRunUpgradeModifiers({ ...technical.profile, runChoices: ['first-touch'] }).contactTimingTicks)
      .not.toBe(resolveRunUpgradeModifiers({ ...technical.profile, runChoices: ['recovery'] }).contactTimingTicks);
  });
});
