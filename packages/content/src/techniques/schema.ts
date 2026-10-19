export type TechniqueFamily = 'dribble' | 'pass-shot' | 'aerial';
export type ContactSurface = 'inside' | 'outside' | 'instep' | 'sole' | 'toe' | 'head';
export type TechniqueId = string;
export type TechniqueMechanic = 'standard' | 'branching-step' | 'late-cut' | 'curl-release' | 'late-plant' | 'guided-lane' | 'air-redirection';

export interface TechniqueDefinition {
  id: TechniqueId;
  displayName: string;
  family: TechniqueFamily;
  tags: readonly string[];
  input: { action: 'technique'; requiresPrecision?: boolean; requiresSprint?: boolean };
  eligibility: {
    minimumSpeed: number;
    maximumSpeed: number;
    maximumPressure: number;
    maximumBallDistance: number;
    requiresGrounded: boolean;
  };
  cost: { stamina: number; cooldownTicks: number };
  timing: { anticipationTicks: number; contactWindowTicks: number; recoveryTicks: number };
  movement: { maximumTurnRadians: number; speedScale: number; preserveSteering: boolean };
  contact: { surface: ContactSurface; impulseScale: number; maxImpulse: number; spinScale: number };
  mechanic: TechniqueMechanic;
  failure: { recoveryTicks: number; reason: string };
  counter: { windowTicks: number; vulnerable: boolean };
  animationKey: string;
  evolution?: { chain: string; tier: number };
}

export function validateTechnique(technique: TechniqueDefinition): void {
  if (!/^[a-z][a-z0-9-]{1,47}$/.test(technique.id)) throw new TypeError('technique id must be a stable slug');
  const values = [
    technique.eligibility.minimumSpeed,
    technique.eligibility.maximumSpeed,
    technique.eligibility.maximumPressure,
    technique.eligibility.maximumBallDistance,
    technique.cost.stamina,
    technique.cost.cooldownTicks,
    technique.timing.anticipationTicks,
    technique.timing.contactWindowTicks,
    technique.timing.recoveryTicks,
    technique.movement.maximumTurnRadians,
    technique.movement.speedScale,
    technique.contact.impulseScale,
    technique.contact.maxImpulse,
    technique.contact.spinScale,
    technique.failure.recoveryTicks,
    technique.counter.windowTicks,
  ];
  if (values.some((value) => !Number.isFinite(value) || value < 0)) throw new RangeError(`${technique.id} has invalid bounds`);
  if (technique.eligibility.maximumSpeed < technique.eligibility.minimumSpeed) throw new RangeError(`${technique.id} speed range is inverted`);
  if (technique.eligibility.maximumPressure > 1 || technique.movement.speedScale > 1.2) throw new RangeError(`${technique.id} exceeds its bounded envelope`);
  if (technique.contact.impulseScale > 1.5 || technique.contact.maxImpulse > 18) throw new RangeError(`${technique.id} exceeds the technique impulse envelope`);
}
