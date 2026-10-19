import type { TechniqueDefinition } from '@soccershooter/content/techniques/schema';

export interface TechniquePlayerGuide {
  name: string;
  family: string;
  setup: string;
  speed: string;
  pressure: string;
  cost: string;
  contact: string;
  risk: string;
}

function spinLabel(axis: TechniqueDefinition['contact']['spinAxis']): string {
  if (axis === 'side') return 'sidespin';
  if (axis === 'top') return 'topspin';
  if (axis === 'back') return 'backspin';
  return 'low spin';
}

function familyLabel(family: TechniqueDefinition['family']): string {
  if (family === 'dribble') return 'Dribble move';
  if (family === 'aerial') return 'Aerial finish';
  return 'Pass / shot technique';
}

function setupLabel(technique: Readonly<TechniqueDefinition>): string {
  const min = technique.eligibility.minimumBallHeight;
  const max = technique.eligibility.maximumBallHeight;
  const height = `${min.toFixed(2)}–${max.toFixed(2)} m`;
  if (min >= 0.3) return `Airborne ball · ${height}${technique.eligibility.requiresGrounded ? ' · player planted' : ''}`;
  if (max <= 0.45) return `Ground ball · ${height}${technique.eligibility.requiresGrounded ? ' · player planted' : ''}`;
  return `Ball height ${height}${technique.eligibility.requiresGrounded ? ' · player planted' : ''}`;
}

export function describeTechniqueForPlayer(technique: Readonly<TechniqueDefinition>): TechniquePlayerGuide {
  return {
    name: technique.displayName,
    family: familyLabel(technique.family),
    setup: setupLabel(technique),
    speed: `Player speed ${technique.eligibility.minimumSpeed.toFixed(1)}–${technique.eligibility.maximumSpeed.toFixed(1)} m/s`,
    pressure: `Works up to ${Math.round(technique.eligibility.maximumPressure * 100)}% pressure · ball within ${technique.eligibility.maximumBallDistance.toFixed(2)} m`,
    cost: `${technique.cost.stamina} stamina · ${technique.timing.recoveryTicks} tick recovery`,
    contact: `${technique.contact.targetSpeed.toFixed(1)} m/s contact · ${technique.contact.launchElevationDegrees.toFixed(0)}° launch · ${spinLabel(technique.contact.spinAxis)}`,
    risk: technique.counter.vulnerable
      ? `${technique.counter.windowTicks} tick counter window · ${technique.failure.recoveryTicks} tick recovery on a miss`
      : `${technique.failure.recoveryTicks} tick recovery on a miss`,
  };
}
