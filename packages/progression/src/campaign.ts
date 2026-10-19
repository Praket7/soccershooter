import { awardEncounter, createFreshProfile, selectArchetype, type PlayerArchetype, type PlayerProfile } from './profile';

export interface CampaignEncounter {
  id: string;
  tacticalProblem: 'basic-space' | 'high-press' | 'deep-block' | 'counterattack' | 'aerial-team' | 'elite-keeper' | 'possession-overload' | 'aggressive-marking';
  recommended: readonly string[];
}

export interface CampaignAct {
  id: string;
  name: string;
  opponentArchetype: string;
  encounters: readonly CampaignEncounter[];
}

export type LegacyModifier = 'high-press' | 'small-pitch' | 'quick-recovery' | 'aerial-pressure';

export interface LegacyGauntlet {
  seed: number;
  level: number;
  modifier: LegacyModifier;
  modifierIntensity: number;
  perfectClearObjective: string;
}

export interface CampaignSimulationReport {
  profile: PlayerProfile;
  encounterIds: readonly string[];
  highlights: readonly string[];
  archetype: PlayerArchetype;
  wins: number;
  checksum: string;
}

export const CAMPAIGN_ACTS: readonly CampaignAct[] = Object.freeze([
  { id: 'street-beginner', name: 'Street Beginner', opponentArchetype: 'street-press', encounters: [{ id: 'street-01', tacticalProblem: 'basic-space', recommended: ['body-feint', 'ground-pass'] }, { id: 'street-02', tacticalProblem: 'basic-space', recommended: ['first-touch'] }] },
  { id: 'academy', name: 'Academy', opponentArchetype: 'academy-possession', encounters: [{ id: 'academy-01', tacticalProblem: 'high-press', recommended: ['quick-pass'] }] },
  { id: 'regional', name: 'Regional', opponentArchetype: 'regional-deep-block', encounters: [{ id: 'regional-01', tacticalProblem: 'deep-block', recommended: ['finesse-curl'] }] },
  { id: 'continental', name: 'Continental', opponentArchetype: 'continental-counter', encounters: [{ id: 'continental-01', tacticalProblem: 'counterattack', recommended: ['through-ball'] }] },
  { id: 'elite-clubs', name: 'Elite Clubs', opponentArchetype: 'elite-aerial', encounters: [{ id: 'elite-01', tacticalProblem: 'aerial-team', recommended: ['volley'] }, { id: 'elite-02', tacticalProblem: 'elite-keeper', recommended: ['power-strike'] }] },
  { id: 'world-legends', name: 'World Legends', opponentArchetype: 'legend-possession-overload', encounters: [{ id: 'world-01', tacticalProblem: 'possession-overload', recommended: ['threaded-ball'] }, { id: 'world-02', tacticalProblem: 'aggressive-marking', recommended: ['roulette'] }] },
]);

export function advanceCampaign(profile: Readonly<PlayerProfile>, won: boolean): PlayerProfile {
  if (!won || profile.campaignComplete) return { ...profile };
  const actIndex = CAMPAIGN_ACTS.findIndex((act) => act.id === profile.campaignActId);
  if (actIndex < 0) throw new RangeError('unknown campaign act');
  const act = CAMPAIGN_ACTS[actIndex]!;
  if (profile.campaignEncounterIndex < act.encounters.length - 1) {
    return { ...profile, campaignEncounterIndex: profile.campaignEncounterIndex + 1 };
  }
  const next = CAMPAIGN_ACTS[actIndex + 1];
  return next
    ? { ...profile, campaignActId: next.id, campaignEncounterIndex: 0 }
    : { ...profile, campaignComplete: true };
}

export function enterLegacy(profile: Readonly<PlayerProfile>, seed: number): PlayerProfile {
  if (!profile.campaignComplete) throw new Error('Legacy unlocks after campaign completion');
  if (!Number.isSafeInteger(seed) || seed < 0) throw new RangeError('Legacy seed must be a non-negative integer');
  return { ...profile, legacyLevel: Math.max(1, profile.legacyLevel), legacySeed: seed };
}

export function finishLegacyGauntlet(
  profile: Readonly<PlayerProfile>,
  seed: number,
  won: boolean,
  result: { score: number; perfectClear?: boolean } = { score: 0 },
): PlayerProfile {
  if (profile.legacySeed !== seed) throw new Error('Legacy result seed does not match the active gauntlet');
  if (!Number.isFinite(result.score) || result.score < 0) throw new RangeError('Legacy score must be finite and non-negative');
  if (!won) return { ...profile, legacySeed: null };
  const nextLevel = profile.legacyLevel + 1;
  const cosmetics = nextLevel % 10 === 0 ? [...new Set([...profile.prestigeCosmetics, `legacy-kit-${Math.floor(nextLevel / 10)}`])] : [...profile.prestigeCosmetics];
  const bestKey = `legacy-level-${profile.legacyLevel}`;
  const personalBests = { ...profile.legacyPersonalBests, [bestKey]: Math.max(profile.legacyPersonalBests[bestKey] ?? 0, Math.floor(result.score)) };
  return {
    ...profile,
    legacyLevel: nextLevel,
    legacySeed: (Math.imul(seed, 1664525) + 1013904223) >>> 0,
    prestigeCosmetics: cosmetics,
    legacyPersonalBests: personalBests,
    perfectLegacyClears: result.perfectClear
      ? [...new Set([...profile.perfectLegacyClears, `legacy-seed-${seed}`])]
      : [...profile.perfectLegacyClears],
  };
}

export function createLegacyGauntlet(profile: Readonly<PlayerProfile>, seed: number): LegacyGauntlet {
  if (profile.legacySeed !== seed) throw new Error('Legacy seed does not match the active gauntlet');
  const modifiers: readonly LegacyModifier[] = ['high-press', 'small-pitch', 'quick-recovery', 'aerial-pressure'];
  const modifier = modifiers[(Math.imul(seed ^ profile.legacyLevel, 1103515245) >>> 0) % modifiers.length]!;
  return {
    seed,
    level: profile.legacyLevel,
    modifier,
    modifierIntensity: 1 + Math.max(0, profile.legacyLevel - 1) * 0.08,
    perfectClearObjective: modifier === 'aerial-pressure' ? 'win-with-no-conceded-header' : 'win-without-conceding',
  };
}

/** Deterministic skilled-agent benchmark for the complete data-driven solo campaign. */
export function simulateSkilledCampaign(archetype: PlayerArchetype = 'technical', seed = 0x51a6): CampaignSimulationReport {
  let profile = selectArchetype(createFreshProfile(), archetype);
  const encounterIds: string[] = [];
  const highlights: string[] = [];
  let checksum = 0x811c9dc5;
  let wins = 0;

  for (const act of CAMPAIGN_ACTS) {
    profile = { ...profile, campaignActId: act.id, campaignEncounterIndex: 0 };
    for (const [index, encounter] of act.encounters.entries()) {
      const encounterSeed = (Math.imul(seed ^ index ^ act.id.length, 1664525) + 1013904223) >>> 0;
      const goalsFor = 2 + (encounterSeed % 3);
      const goalsAgainst = encounter.tacticalProblem === 'elite-keeper' ? 0 : encounterSeed % 2;
      const reward = awardEncounter(profile, {
        encounterId: encounter.id,
        outcome: 'win',
        goalsFor,
        goalsAgainst,
        seed: encounterSeed,
      });
      profile = reward.profile;
      profile = advanceCampaign(profile, true);
      encounterIds.push(encounter.id);
      const highlight = `${encounter.id}:seed-${encounterSeed}:score-${goalsFor}-${goalsAgainst}`;
      highlights.push(highlight);
      profile.highlights = [...profile.highlights, highlight].slice(-256);
      checksum = (Math.imul(checksum ^ encounterSeed ^ goalsFor ^ goalsAgainst, 0x01000193)) >>> 0;
      wins += 1;
    }
  }

  return { profile, encounterIds, highlights, archetype, wins, checksum: checksum.toString(16).padStart(8, '0') };
}
