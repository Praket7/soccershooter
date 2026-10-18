export const BOT_DIFFICULTY_TIERS = ['novice', 'standard', 'elite'] as const;
export type BotDifficultyTier = (typeof BOT_DIFFICULTY_TIERS)[number];

export interface PhysicalDifficultySnapshot {
  movementSpeedScale: 1;
  accelerationScale: 1;
  staminaCapacityScale: 1;
  staminaDrainScale: 1;
  tackleColliderScale: 1;
  ballPhysicsScale: 1;
  goalkeeperReachScale: 1;
}

export interface BotDifficultyParameters {
  reactionDelaySeconds: number;
  observationNoiseMetres: number;
  tacticalEvaluationIntervalSeconds: number;
  predictionHorizonSeconds: number;
  aimErrorRadians: number;
  spinErrorScale: number;
  passRiskTolerance: number;
  skillRepertoire: readonly string[];
  coordinatedRunFrequency: number;
  defensiveAnticipation: number;
}

const SHARED_PHYSICAL_RULES: Readonly<PhysicalDifficultySnapshot> = Object.freeze({
  movementSpeedScale: 1,
  accelerationScale: 1,
  staminaCapacityScale: 1,
  staminaDrainScale: 1,
  tackleColliderScale: 1,
  ballPhysicsScale: 1,
  goalkeeperReachScale: 1,
});

const DIFFICULTY_PROFILES: Readonly<Record<BotDifficultyTier, Readonly<BotDifficultyParameters>>> = Object.freeze({
  novice: Object.freeze({
    reactionDelaySeconds: 0.22,
    observationNoiseMetres: 0.18,
    tacticalEvaluationIntervalSeconds: 0.18,
    predictionHorizonSeconds: 0.24,
    aimErrorRadians: 0.08,
    spinErrorScale: 0.12,
    passRiskTolerance: 0.30,
    skillRepertoire: Object.freeze(['ground-pass', 'normal-shot', 'controlled-dribble']),
    coordinatedRunFrequency: 0.35,
    defensiveAnticipation: 0.34,
  }),
  standard: Object.freeze({
    reactionDelaySeconds: 0.11,
    observationNoiseMetres: 0.08,
    tacticalEvaluationIntervalSeconds: 0.10,
    predictionHorizonSeconds: 0.45,
    aimErrorRadians: 0.045,
    spinErrorScale: 0.065,
    passRiskTolerance: 0.50,
    skillRepertoire: Object.freeze(['ground-pass', 'driven-pass', 'through-pass', 'normal-shot', 'finesse-shot', 'controlled-dribble']),
    coordinatedRunFrequency: 0.64,
    defensiveAnticipation: 0.60,
  }),
  elite: Object.freeze({
    reactionDelaySeconds: 0.05,
    observationNoiseMetres: 0.025,
    tacticalEvaluationIntervalSeconds: 0.08,
    predictionHorizonSeconds: 0.72,
    aimErrorRadians: 0.02,
    spinErrorScale: 0.03,
    passRiskTolerance: 0.69,
    skillRepertoire: Object.freeze(['ground-pass', 'driven-pass', 'lofted-pass', 'through-pass', 'normal-shot', 'driven-shot', 'finesse-shot', 'chip-shot', 'knuckle-shot', 'outside-foot-shot', 'controlled-dribble']),
    coordinatedRunFrequency: 0.86,
    defensiveAnticipation: 0.88,
  }),
});

export function physicalDifficultySnapshot(_tier: BotDifficultyTier): PhysicalDifficultySnapshot {
  return { ...SHARED_PHYSICAL_RULES };
}

export function difficultyParameterSnapshot(tier: BotDifficultyTier): BotDifficultyParameters {
  const profile = DIFFICULTY_PROFILES[tier];
  return {
    ...profile,
    skillRepertoire: [...profile.skillRepertoire],
  };
}

function mixUint32(value: number): number {
  let next = value >>> 0;
  next ^= next >>> 16;
  next = Math.imul(next, 0x7feb352d);
  next ^= next >>> 15;
  next = Math.imul(next, 0x846ca68b);
  next ^= next >>> 16;
  return next >>> 0;
}

function hashText(value: string): number {
  let hash = 2166136261 >>> 0;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619) >>> 0;
  }
  return hash;
}

export function deterministicDifficultyNoise(
  seed: number,
  tick: number,
  stableId: string,
  channel: string,
): number {
  const mixed = mixUint32(
    (seed >>> 0)
      ^ Math.imul((tick >>> 0) + 1, 0x9e3779b1)
      ^ hashText(stableId)
      ^ Math.imul(hashText(channel), 0x85ebca6b),
  );
  return mixed / 0x7fffffff - 1;
}
