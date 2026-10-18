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

const SHARED_PHYSICAL_RULES: Readonly<PhysicalDifficultySnapshot> = Object.freeze({
  movementSpeedScale: 1,
  accelerationScale: 1,
  staminaCapacityScale: 1,
  staminaDrainScale: 1,
  tackleColliderScale: 1,
  ballPhysicsScale: 1,
  goalkeeperReachScale: 1,
});

export function physicalDifficultySnapshot(_tier: BotDifficultyTier): PhysicalDifficultySnapshot {
  return { ...SHARED_PHYSICAL_RULES };
}
