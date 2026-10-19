import { awardEncounter, createFreshProfile, selectArchetype, type PlayerArchetype, type PlayerProfile } from './profile';
import { createPhysicalScrimmage, stepPhysicalScrimmage } from '../../bots/src/physicalScrimmage';
import type { BotPersonalityId } from '../../bots/src/personalities';

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
  opponentArchetypes: readonly string[];
  highlights: readonly string[];
  archetype: PlayerArchetype;
  wins: number;
  simulatedTicks: number;
  physicalContacts: number;
  goalsScored: number;
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

const ENCOUNTER_START_Z: Readonly<Record<CampaignEncounter['tacticalProblem'], number>> = Object.freeze({
  'basic-space': 9.2,
  'high-press': 8.8,
  'deep-block': 10.6,
  counterattack: 9.8,
  'aerial-team': 8.9,
  'elite-keeper': 11.4,
  'possession-overload': 9.4,
  'aggressive-marking': 10.1,
});

const CAMPAIGN_MATCH_TICKS = 90 * 60;

const OPPONENT_PERSONALITIES: Readonly<Record<string, Readonly<Record<string, BotPersonalityId>>>> = Object.freeze({
  'street-press': Object.freeze({ 'a-1': 'aggressive-presser', 'a-2': 'winger', 'a-gk': 'calm-keeper' }),
  'academy-possession': Object.freeze({ 'a-1': 'playmaker', 'a-2': 'anchor', 'a-gk': 'calm-keeper' }),
  'regional-deep-block': Object.freeze({ 'a-1': 'anchor', 'a-2': 'calm-keeper', 'a-gk': 'calm-keeper' }),
  'continental-counter': Object.freeze({ 'a-1': 'winger', 'a-2': 'poacher', 'a-gk': 'calm-keeper' }),
  'elite-aerial': Object.freeze({ 'a-1': 'poacher', 'a-2': 'aggressive-presser', 'a-gk': 'calm-keeper' }),
  'legend-possession-overload': Object.freeze({ 'a-1': 'playmaker', 'a-2': 'aggressive-presser', 'a-gk': 'calm-keeper' }),
});

function simulateEncounter(seed: number, encounter: Readonly<CampaignEncounter>, opponentArchetype: string): { goal: boolean; ticks: number; contacts: number; checksum: string } {
  let state = createPhysicalScrimmage(seed);
  const attacker = state.players.find((player) => player.id === 'h-1');
  if (!attacker) throw new Error('physical campaign scenario is missing its attacker');
  // A challenge begins at its authored tactical moment; every subsequent
  // movement decision, contact, ball flight, and goalkeeper response runs in
  // the deterministic physical scrimmage simulation.
  attacker.position = { x: 0, y: 0, z: ENCOUNTER_START_Z[encounter.tacticalProblem] };
  attacker.velocity = { x: 0, y: 0, z: 0 };
  state.ball.position = { x: 0, y: 0.11, z: attacker.position.z + 0.78 };
  state.ball.velocity = { x: 0, y: 0, z: 0 };
  state.ball.angularVelocity = { x: 0, y: 0, z: 0 };
  state.ball.grounded = true;
  state.possessionTeam = 'home';
  state.possessionPlayerId = attacker.id;

  const initialContacts = state.contactCount;
  for (let tick = 0; tick < CAMPAIGN_MATCH_TICKS; tick += 1) {
    state = stepPhysicalScrimmage(state, 1 / 60, 'standard', OPPONENT_PERSONALITIES[opponentArchetype] ?? OPPONENT_PERSONALITIES['street-press']!);
    const scored = state.ball.position.z > state.field.halfLength
      && Math.abs(state.ball.position.x) < state.field.goalHalfWidth
      && state.ball.position.y < 2.44;
    if (scored) {
      return { goal: true, ticks: tick + 1, contacts: state.contactCount - initialContacts, checksum: state.checksum };
    }
  }
  return { goal: false, ticks: CAMPAIGN_MATCH_TICKS, contacts: state.contactCount - initialContacts, checksum: state.checksum };
}

/** Deterministic benchmark that plays each authored encounter in the physical bot scrimmage. */
export function simulateSkilledCampaign(archetype: PlayerArchetype = 'technical', seed = 0x51a6): CampaignSimulationReport {
  let profile = selectArchetype(createFreshProfile(), archetype);
  const encounterIds: string[] = [];
  const opponentArchetypes: string[] = [];
  const highlights: string[] = [];
  let checksum = 0x811c9dc5;
  let wins = 0;
  let simulatedTicks = 0;
  let physicalContacts = 0;
  let goalsScored = 0;

  for (const act of CAMPAIGN_ACTS) {
    for (const [index, encounter] of act.encounters.entries()) {
      const encounterSeed = (Math.imul(seed ^ index ^ act.id.length, 1664525) + 1013904223) >>> 0;
      const simulation = simulateEncounter(encounterSeed, encounter, act.opponentArchetype);
      simulatedTicks += simulation.ticks;
      physicalContacts += simulation.contacts;
      goalsScored += Number(simulation.goal);
      const goalsFor = Number(simulation.goal);
      const goalsAgainst = 0;
      const reward = awardEncounter(profile, {
        encounterId: encounter.id,
        outcome: simulation.goal ? 'win' : 'loss',
        goalsFor,
        goalsAgainst,
        seed: encounterSeed,
      });
      profile = reward.profile;
      encounterIds.push(encounter.id);
      opponentArchetypes.push(act.opponentArchetype);
      const highlight = `${encounter.id}:opponent-${act.opponentArchetype}:seed-${encounterSeed}:score-${goalsFor}-${goalsAgainst}:ticks-${simulation.ticks}:contacts-${simulation.contacts}:physics-${simulation.checksum}`;
      highlights.push(highlight);
      profile.highlights = [...profile.highlights, highlight].slice(-256);
      checksum = (Math.imul(checksum ^ encounterSeed ^ goalsFor ^ goalsAgainst ^ simulation.ticks ^ simulation.contacts, 0x01000193) ^ Number.parseInt(simulation.checksum, 16)) >>> 0;
      if (!simulation.goal) return {
        profile,
        encounterIds,
        opponentArchetypes,
        highlights,
        archetype,
        wins,
        simulatedTicks,
        physicalContacts,
        goalsScored,
        checksum: checksum.toString(16).padStart(8, '0'),
      };
      profile = advanceCampaign(profile, true);
      wins += 1;
    }
  }

  return { profile, encounterIds, opponentArchetypes, highlights, archetype, wins, simulatedTicks, physicalContacts, goalsScored, checksum: checksum.toString(16).padStart(8, '0') };
}
