import type { LegacyGauntlet } from '@soccershooter/progression/campaign';

export interface LiveLegacyModifiers {
  pressure: number;
  pitchScale: number;
  recoveryRate: number;
  keeperMaxHeight: number;
}

const NEUTRAL: Readonly<LiveLegacyModifiers> = Object.freeze({
  pressure: 0,
  pitchScale: 1,
  recoveryRate: 1,
  keeperMaxHeight: 2.18,
});

export function resolveLiveLegacyModifiers(gauntlet: Readonly<LegacyGauntlet> | null): LiveLegacyModifiers {
  if (!gauntlet) return { ...NEUTRAL };
  const intensity = Math.max(1, Math.min(5, gauntlet.modifierIntensity));
  switch (gauntlet.modifier) {
    case 'high-press': return { ...NEUTRAL, pressure: Math.min(0.75, 0.3 * intensity) };
    case 'small-pitch': return { ...NEUTRAL, pitchScale: Math.max(0.65, 1 - 0.06 * intensity) };
    case 'quick-recovery': return { ...NEUTRAL, recoveryRate: 1 + 0.3 * intensity };
    case 'aerial-pressure': return { ...NEUTRAL, keeperMaxHeight: 2.18 + 0.12 * intensity };
  }
}
