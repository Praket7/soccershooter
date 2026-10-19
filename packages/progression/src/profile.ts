export interface PlayerProfile {
  version: 2;
  playerId: string;
  presentationOvr: number;
  archetype: PlayerArchetype;
  equippedTechniqueSlots: string[];
  xp: number;
  level: number;
  techniqueMastery: Record<string, number>;
  unlockedTechniques: string[];
  evolutionTiers: Record<string, number>;
  campaignActId: string;
  campaignEncounterIndex: number;
  campaignComplete: boolean;
  runChoices: string[];
  medals: string[];
  victories: number;
  defeats: number;
  rewardLedger: string[];
  legacyLevel: number;
  legacySeed: number | null;
  legacyPersonalBests: Record<string, number>;
  perfectLegacyClears: string[];
  prestigeCosmetics: string[];
  highlights: string[];
}

export type PlayerArchetype = 'technical' | 'pace' | 'power';

export interface BuildModifiers {
  contactTimingTicks: number;
  sprintStaminaCostScale: number;
  strikeImpulseScale: number;
}

export interface RunUpgradeModifiers {
  contactTimingTicks: number;
  balanceRetention: number;
  staminaRecoveryScale: number;
}

export const ARCHETYPE_MODIFIERS: Readonly<Record<PlayerArchetype, BuildModifiers>> = Object.freeze({
  technical: { contactTimingTicks: 1, sprintStaminaCostScale: 1, strikeImpulseScale: 1 },
  pace: { contactTimingTicks: 0, sprintStaminaCostScale: 0.82, strikeImpulseScale: 0.96 },
  power: { contactTimingTicks: -1, sprintStaminaCostScale: 1.12, strikeImpulseScale: 1.08 },
});

export const RUN_UPGRADE_MODIFIERS: Readonly<Record<string, RunUpgradeModifiers>> = Object.freeze({
  'first-touch': { contactTimingTicks: 1, balanceRetention: 0, staminaRecoveryScale: 1 },
  composure: { contactTimingTicks: 0, balanceRetention: 0.08, staminaRecoveryScale: 1 },
  recovery: { contactTimingTicks: 0, balanceRetention: 0, staminaRecoveryScale: 1.2 },
});

export function resolveRunUpgradeModifiers(profile: Readonly<PlayerProfile>): RunUpgradeModifiers {
  return profile.runChoices.slice(-3).reduce((total, choice) => {
    const modifier = RUN_UPGRADE_MODIFIERS[choice];
    return modifier ? {
      contactTimingTicks: total.contactTimingTicks + modifier.contactTimingTicks,
      balanceRetention: total.balanceRetention + modifier.balanceRetention,
      staminaRecoveryScale: total.staminaRecoveryScale * modifier.staminaRecoveryScale,
    } : total;
  }, { contactTimingTicks: 0, balanceRetention: 0, staminaRecoveryScale: 1 });
}

export interface EncounterResult {
  encounterId: string;
  outcome: 'win' | 'draw' | 'loss';
  goalsFor: number;
  goalsAgainst: number;
  seed: number;
}

export interface EncounterReward {
  xp: number;
  mastery: number;
  medal: string | null;
  duplicate: boolean;
  runChoice: string | null;
}

function safeCount(value: unknown, fallback = 0): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  return Math.max(0, Math.min(Number.MAX_SAFE_INTEGER, Math.floor(value)));
}

export function createFreshProfile(): PlayerProfile {
  return {
    version: 2,
    playerId: 'local-player',
    presentationOvr: 67,
    archetype: 'technical',
    equippedTechniqueSlots: ['body-feint', 'ground-pass', 'normal-shot'],
    xp: 0,
    level: 1,
    techniqueMastery: {},
    unlockedTechniques: ['body-feint', 'ground-pass', 'normal-shot'],
    evolutionTiers: {},
    campaignActId: 'street-beginner',
    campaignEncounterIndex: 0,
    campaignComplete: false,
    runChoices: [],
    medals: [],
    victories: 0,
    defeats: 0,
    rewardLedger: [],
    legacyLevel: 0,
    legacySeed: null,
    legacyPersonalBests: {},
    perfectLegacyClears: [],
    prestigeCosmetics: [],
    highlights: [],
  };
}

export function selectArchetype(profile: Readonly<PlayerProfile>, archetype: PlayerArchetype): PlayerProfile {
  if (!(archetype in ARCHETYPE_MODIFIERS)) throw new RangeError('unknown player archetype');
  return { ...profile, archetype };
}

export function equipTechniqueSlots(profile: Readonly<PlayerProfile>, slots: readonly string[]): PlayerProfile {
  if (slots.length > 3 || new Set(slots).size !== slots.length) throw new RangeError('choose up to three distinct technique slots');
  if (slots.some((slot) => !profile.unlockedTechniques.includes(slot))) throw new Error('technique must be unlocked before equipping');
  return { ...profile, equippedTechniqueSlots: [...slots] };
}

export function awardEncounter(profile: Readonly<PlayerProfile>, result: Readonly<EncounterResult>): { profile: PlayerProfile; reward: EncounterReward } {
  if (!Number.isSafeInteger(result.seed) || result.seed < 0) throw new RangeError('encounter seed must be a non-negative integer');
  if (!Number.isSafeInteger(result.goalsFor) || !Number.isSafeInteger(result.goalsAgainst) || result.goalsFor < 0 || result.goalsAgainst < 0) {
    throw new RangeError('encounter score must be a non-negative integer');
  }
  const ledgerKey = result.encounterId;
  if (profile.rewardLedger.includes(ledgerKey)) {
    return { profile: { ...profile, rewardLedger: [...profile.rewardLedger] }, reward: { xp: 0, mastery: 0, medal: null, duplicate: true, runChoice: null } };
  }
  const xp = result.outcome === 'win' ? 60 : result.outcome === 'draw' ? 30 : 16;
  const mastery = result.outcome === 'win' ? 10 : result.outcome === 'draw' ? 5 : 2;
  const cleanSheet = result.outcome === 'win' && result.goalsAgainst === 0;
  const medal = cleanSheet ? `clean-sheet:${result.encounterId}` : null;
  const techniqueMastery = { ...profile.techniqueMastery };
  techniqueMastery['core-ball-control'] = Math.min(100, safeCount(techniqueMastery['core-ball-control']) + mastery);
  const masteryValue = techniqueMastery['core-ball-control']!;
  const newlyUnlocked = masteryValue >= 60
    ? ['roulette', 'stepover', 'phantom-step', 'finesse-curl']
    : masteryValue >= 30
      ? ['roulette', 'stepover']
      : masteryValue >= 10
        ? ['roulette']
        : [];
  const unlockedTechniques = [...new Set([...profile.unlockedTechniques, ...newlyUnlocked])];
  const evolutionTiers = { ...profile.evolutionTiers, 'phantom-step': Math.min(3, Math.floor(masteryValue / 20)) };
  const runChoice = result.outcome === 'win'
    ? ['first-touch', 'composure', 'recovery'][(result.seed + result.goalsFor * 3) % 3]!
    : null;
  const totalXp = Math.min(Number.MAX_SAFE_INTEGER, safeCount(profile.xp) + xp);
  return {
    profile: {
      ...profile,
      xp: totalXp,
      level: Math.max(1, 1 + Math.floor(totalXp / 500)),
      techniqueMastery,
      unlockedTechniques,
      evolutionTiers,
      runChoices: runChoice ? [...profile.runChoices, runChoice].slice(-3) : [...profile.runChoices],
      medals: medal && !profile.medals.includes(medal) ? [...profile.medals, medal] : [...profile.medals],
      victories: profile.victories + (result.outcome === 'win' ? 1 : 0),
      defeats: profile.defeats + (result.outcome === 'loss' ? 1 : 0),
      rewardLedger: [...profile.rewardLedger, ledgerKey].slice(-2048),
    },
    reward: { xp, mastery, medal, duplicate: false, runChoice },
  };
}

export function migrateProfile(input: unknown): PlayerProfile {
  if (!input || typeof input !== 'object') throw new TypeError('profile must be an object');
  const value = input as Record<string, unknown>;
  if (value.version === 2) {
    if (typeof value.playerId !== 'string' || !Array.isArray(value.unlockedTechniques)) throw new TypeError('invalid v2 profile');
    const base = createFreshProfile();
    return {
      ...base,
      ...value,
      version: 2,
      archetype: value.archetype === 'pace' || value.archetype === 'power' ? value.archetype : 'technical',
      equippedTechniqueSlots: Array.isArray(value.equippedTechniqueSlots)
        ? value.equippedTechniqueSlots.filter((item): item is string => typeof item === 'string').slice(0, 3)
        : base.equippedTechniqueSlots,
      xp: safeCount(value.xp),
      level: Math.max(1, safeCount(value.level, 1)),
      presentationOvr: Math.max(1, Math.min(99, safeCount(value.presentationOvr, 67))),
      unlockedTechniques: [...new Set(value.unlockedTechniques.filter((item): item is string => typeof item === 'string'))],
      rewardLedger: Array.isArray(value.rewardLedger) ? value.rewardLedger.filter((item): item is string => typeof item === 'string').slice(-2048) : [],
      perfectLegacyClears: Array.isArray(value.perfectLegacyClears) ? value.perfectLegacyClears.filter((item): item is string => typeof item === 'string') : [],
      prestigeCosmetics: Array.isArray(value.prestigeCosmetics) ? value.prestigeCosmetics.filter((item): item is string => typeof item === 'string') : [],
      highlights: Array.isArray(value.highlights) ? value.highlights.filter((item): item is string => typeof item === 'string').slice(-256) : [],
      legacyPersonalBests: value.legacyPersonalBests && typeof value.legacyPersonalBests === 'object'
        ? value.legacyPersonalBests as Record<string, number>
        : {},
    };
  }
  if (value.version === 1) {
    const base = createFreshProfile();
    const unlocks = Array.isArray(value.unlockedTechniques)
      ? value.unlockedTechniques.filter((item): item is string => typeof item === 'string')
      : base.unlockedTechniques;
    const xp = safeCount(value.xp);
    return {
      ...base,
      xp,
      level: Math.max(1, 1 + Math.floor(xp / 500)),
      unlockedTechniques: [...new Set([...base.unlockedTechniques, ...unlocks])],
    };
  }
  throw new RangeError('unsupported profile version');
}

export function exportProfile(profile: Readonly<PlayerProfile>): string {
  return JSON.stringify(migrateProfile(profile));
}

export function importProfile(serialized: string): PlayerProfile {
  return migrateProfile(JSON.parse(serialized) as unknown);
}
