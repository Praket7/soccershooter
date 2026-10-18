export const BOT_PERSONALITY_IDS = [
  'balanced',
  'playmaker',
  'winger',
  'poacher',
  'anchor',
  'aggressive-presser',
  'calm-keeper',
] as const;

export type BotPersonalityId = (typeof BOT_PERSONALITY_IDS)[number];
export type CarrierPreference = 'shoot' | 'pass' | 'dribble' | 'protect' | 'clear';
export type OffBallPreference = 'support' | 'overlap' | 'width' | 'half-space' | 'back-post-run' | 'recycle';
export type DefensePreference = 'press' | 'cover' | 'block-lane' | 'block-shot' | 'intercept' | 'recover-goal-side';
export type GoalkeeperPreference = 'position' | 'claim' | 'dive' | 'parry' | 'distribute';

export interface BotPersonalityProfile {
  id: BotPersonalityId;
  carrier: Readonly<Record<CarrierPreference, number>>;
  offBall: Readonly<Record<OffBallPreference, number>>;
  defense: Readonly<Record<DefensePreference, number>>;
  goalkeeper: Readonly<Record<GoalkeeperPreference, number>>;
}

const carrier = (values: Partial<Record<CarrierPreference, number>> = {}): Record<CarrierPreference, number> => ({ shoot: 1, pass: 1, dribble: 1, protect: 1, clear: 1, ...values });
const offBall = (values: Partial<Record<OffBallPreference, number>> = {}): Record<OffBallPreference, number> => ({ support: 1, overlap: 1, width: 1, 'half-space': 1, 'back-post-run': 1, recycle: 1, ...values });
const defense = (values: Partial<Record<DefensePreference, number>> = {}): Record<DefensePreference, number> => ({ press: 1, cover: 1, 'block-lane': 1, 'block-shot': 1, intercept: 1, 'recover-goal-side': 1, ...values });
const goalkeeper = (values: Partial<Record<GoalkeeperPreference, number>> = {}): Record<GoalkeeperPreference, number> => ({ position: 1, claim: 1, dive: 1, parry: 1, distribute: 1, ...values });

const PROFILES: Readonly<Record<BotPersonalityId, Readonly<BotPersonalityProfile>>> = Object.freeze({
  balanced: Object.freeze({ id: 'balanced', carrier: carrier(), offBall: offBall(), defense: defense(), goalkeeper: goalkeeper() }),
  playmaker: Object.freeze({
    id: 'playmaker',
    carrier: carrier({ pass: 1.34, shoot: 0.86, dribble: 1.04, protect: 0.96, clear: 0.82 }),
    offBall: offBall({ support: 1.22, 'half-space': 1.16, recycle: 1.18, width: 0.94 }),
    defense: defense({ 'block-lane': 1.08, cover: 1.06, press: 0.94 }),
    goalkeeper: goalkeeper(),
  }),
  winger: Object.freeze({
    id: 'winger',
    carrier: carrier({ dribble: 1.26, pass: 1.08, shoot: 1.04, protect: 0.9 }),
    offBall: offBall({ width: 1.36, overlap: 1.31, 'back-post-run': 1.16, recycle: 0.82, support: 0.93 }),
    defense: defense({ press: 1.08, 'recover-goal-side': 1.03 }),
    goalkeeper: goalkeeper(),
  }),
  poacher: Object.freeze({
    id: 'poacher',
    carrier: carrier({ shoot: 1.38, dribble: 1.08, pass: 0.88, protect: 0.8, clear: 0.72 }),
    offBall: offBall({ 'back-post-run': 1.38, 'half-space': 1.18, support: 0.88, recycle: 0.72 }),
    defense: defense({ press: 1.03, cover: 0.88 }),
    goalkeeper: goalkeeper(),
  }),
  anchor: Object.freeze({
    id: 'anchor',
    carrier: carrier({ pass: 1.1, protect: 1.16, clear: 1.24, shoot: 0.74, dribble: 0.86 }),
    offBall: offBall({ recycle: 1.31, support: 1.1, overlap: 0.72, 'back-post-run': 0.72 }),
    defense: defense({ cover: 1.31, 'recover-goal-side': 1.36, 'block-lane': 1.24, 'block-shot': 1.2, press: 0.78 }),
    goalkeeper: goalkeeper(),
  }),
  'aggressive-presser': Object.freeze({
    id: 'aggressive-presser',
    carrier: carrier({ dribble: 1.06, pass: 1.02 }),
    offBall: offBall({ support: 1.08, recycle: 0.91 }),
    defense: defense({ press: 1.38, intercept: 1.27, 'block-shot': 1.1, cover: 0.78, 'recover-goal-side': 0.86 }),
    goalkeeper: goalkeeper(),
  }),
  'calm-keeper': Object.freeze({
    id: 'calm-keeper',
    carrier: carrier({ pass: 1.08, clear: 1.08 }),
    offBall: offBall(),
    defense: defense({ cover: 1.04 }),
    goalkeeper: goalkeeper({ position: 1.32, claim: 1.18, distribute: 1.16, parry: 1.02, dive: 0.84 }),
  }),
});

export function botPersonalityProfile(id: BotPersonalityId): BotPersonalityProfile {
  const profile = PROFILES[id];
  return {
    id: profile.id,
    carrier: { ...profile.carrier },
    offBall: { ...profile.offBall },
    defense: { ...profile.defense },
    goalkeeper: { ...profile.goalkeeper },
  };
}

export function personalityWeight(id: BotPersonalityId, domain: 'carrier', action: CarrierPreference): number;
export function personalityWeight(id: BotPersonalityId, domain: 'offBall', action: OffBallPreference): number;
export function personalityWeight(id: BotPersonalityId, domain: 'defense', action: DefensePreference): number;
export function personalityWeight(id: BotPersonalityId, domain: 'goalkeeper', action: GoalkeeperPreference): number;
export function personalityWeight(id: BotPersonalityId, domain: 'carrier' | 'offBall' | 'defense' | 'goalkeeper', action: string): number {
  const profile = PROFILES[id];
  const weights = profile[domain] as Readonly<Record<string, number>>;
  return weights[action] ?? 1;
}
