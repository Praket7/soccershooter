import type { CampaignEncounter, LegacyGauntlet, LegacyModifier } from '@soccershooter/progression/campaign';
import { resolveLiveLegacyModifiers } from './legacyChallengeModifiers';

export interface LiveCampaignModifiers {
  pressure: number;
  pitchScale: number;
  recoveryRate: number;
  keeperMaxHeight: number;
}

const NEUTRAL: Readonly<LiveCampaignModifiers> = Object.freeze({
  pressure: 0,
  pitchScale: 1,
  recoveryRate: 1,
  keeperMaxHeight: 2.18,
});

const TACTICAL: Readonly<Record<CampaignEncounter['tacticalProblem'], Readonly<LiveCampaignModifiers>>> = Object.freeze({
  'basic-space': Object.freeze({ ...NEUTRAL }),
  'high-press': Object.freeze({ ...NEUTRAL, pressure: 0.34, pitchScale: 0.97 }),
  'deep-block': Object.freeze({ ...NEUTRAL, pitchScale: 0.93, keeperMaxHeight: 2.3 }),
  counterattack: Object.freeze({ ...NEUTRAL, recoveryRate: 1.3 }),
  'aerial-team': Object.freeze({ ...NEUTRAL, keeperMaxHeight: 2.34 }),
  'elite-keeper': Object.freeze({ ...NEUTRAL, keeperMaxHeight: 2.46 }),
  'possession-overload': Object.freeze({ ...NEUTRAL, pressure: 0.3, pitchScale: 0.9 }),
  'aggressive-marking': Object.freeze({ ...NEUTRAL, pressure: 0.52, pitchScale: 0.96 }),
});

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function tacticalProfile(tacticalProblem: string | null | undefined): Readonly<LiveCampaignModifiers> {
  return tacticalProblem && tacticalProblem in TACTICAL
    ? TACTICAL[tacticalProblem as CampaignEncounter['tacticalProblem']]!
    : NEUTRAL;
}

export function resolveLiveCampaignModifiers(
  tacticalProblem: string | null | undefined,
  legacyGauntlet: Readonly<LegacyGauntlet> | null,
): LiveCampaignModifiers {
  const tactical = tacticalProfile(tacticalProblem);
  const legacy = resolveLiveLegacyModifiers(legacyGauntlet);

  return {
    pressure: clamp(tactical.pressure + legacy.pressure, 0, 0.9),
    pitchScale: clamp(tactical.pitchScale * legacy.pitchScale, 0.6, 1),
    recoveryRate: clamp(tactical.recoveryRate * legacy.recoveryRate, 0.7, 2.5),
    keeperMaxHeight: clamp(Math.max(tactical.keeperMaxHeight, legacy.keeperMaxHeight), 2.18, 2.7),
  };
}

function syntheticGauntlet(modifier: LegacyModifier, intensity: number): LegacyGauntlet {
  return {
    seed: 0,
    level: 0,
    modifier,
    modifierIntensity: clamp(intensity, 1, 5),
    perfectClearObjective: 'campaign-tactical-condition',
  };
}

/**
 * FootballPractice already owns authoritative implementations for pressure,
 * recovery and goalkeeper-height challenge conditions. This adapter reuses
 * those hooks for authored campaign encounters without changing any movement,
 * ball or contact law.
 */
export function buildSyntheticCampaignGauntlet(
  tacticalProblem: CampaignEncounter['tacticalProblem'],
): LegacyGauntlet | null {
  const profile = TACTICAL[tacticalProblem];
  switch (tacticalProblem) {
    case 'high-press':
    case 'possession-overload':
    case 'aggressive-marking':
      return syntheticGauntlet('high-press', profile.pressure / 0.3);
    case 'counterattack':
      return syntheticGauntlet('quick-recovery', (profile.recoveryRate - 1) / 0.3);
    case 'deep-block':
    case 'aerial-team':
    case 'elite-keeper':
      return syntheticGauntlet('aerial-pressure', (profile.keeperMaxHeight - 2.18) / 0.12);
    case 'basic-space':
      return null;
  }
}

export function tacticalPitchScale(tacticalProblem: string | null | undefined): number {
  return tacticalProfile(tacticalProblem).pitchScale;
}
