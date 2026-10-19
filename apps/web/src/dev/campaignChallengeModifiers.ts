import type { CampaignEncounter, LegacyGauntlet } from '@soccershooter/progression/campaign';
import { resolveLiveLegacyModifiers } from './legacyChallengeModifiers';

export interface LiveCampaignModifiers {
  pressure: number;
  pitchScale: number;
  recoveryRate: number;
  keeperMaxHeight: number;
  keeperHalfReach: number;
}

const NEUTRAL: Readonly<LiveCampaignModifiers> = Object.freeze({
  pressure: 0,
  pitchScale: 1,
  recoveryRate: 1,
  keeperMaxHeight: 2.18,
  keeperHalfReach: 0.68,
});

const TACTICAL: Readonly<Record<CampaignEncounter['tacticalProblem'], Readonly<LiveCampaignModifiers>>> = Object.freeze({
  'basic-space': Object.freeze({ ...NEUTRAL }),
  'high-press': Object.freeze({ ...NEUTRAL, pressure: 0.34, pitchScale: 0.97 }),
  'deep-block': Object.freeze({ ...NEUTRAL, pressure: 0.12, pitchScale: 0.93, keeperMaxHeight: 2.24, keeperHalfReach: 0.77 }),
  counterattack: Object.freeze({ ...NEUTRAL, pressure: 0.18, recoveryRate: 1.16 }),
  'aerial-team': Object.freeze({ ...NEUTRAL, pressure: 0.2, keeperMaxHeight: 2.34, keeperHalfReach: 0.73 }),
  'elite-keeper': Object.freeze({ ...NEUTRAL, pressure: 0.1, keeperMaxHeight: 2.46, keeperHalfReach: 0.92 }),
  'possession-overload': Object.freeze({ ...NEUTRAL, pressure: 0.28, pitchScale: 0.9, recoveryRate: 1.06 }),
  'aggressive-marking': Object.freeze({ ...NEUTRAL, pressure: 0.52, pitchScale: 0.96, keeperHalfReach: 0.72 }),
});

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function resolveLiveCampaignModifiers(
  tacticalProblem: string | null | undefined,
  legacyGauntlet: Readonly<LegacyGauntlet> | null,
): LiveCampaignModifiers {
  const tactical = tacticalProblem && tacticalProblem in TACTICAL
    ? TACTICAL[tacticalProblem as CampaignEncounter['tacticalProblem']]!
    : NEUTRAL;
  const legacy = resolveLiveLegacyModifiers(legacyGauntlet);

  return {
    pressure: clamp(tactical.pressure + legacy.pressure, 0, 0.9),
    pitchScale: clamp(tactical.pitchScale * legacy.pitchScale, 0.6, 1),
    recoveryRate: clamp(tactical.recoveryRate * legacy.recoveryRate, 0.7, 2.5),
    keeperMaxHeight: clamp(Math.max(tactical.keeperMaxHeight, legacy.keeperMaxHeight), 2.18, 2.7),
    keeperHalfReach: clamp(tactical.keeperHalfReach, 0.68, 1.05),
  };
}
