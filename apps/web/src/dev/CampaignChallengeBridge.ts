import type { CampaignEncounter } from '@soccershooter/progression/campaign';
import type { MovementWorld } from '@soccershooter/sim/player/movement';
import { FootballPractice } from './FootballPractice';
import {
  buildSyntheticCampaignGauntlet,
  resolveLiveCampaignModifiers,
  tacticalPitchScale,
} from './campaignChallengeModifiers';

const TACTICAL_PROBLEMS = new Set<CampaignEncounter['tacticalProblem']>([
  'basic-space',
  'high-press',
  'deep-block',
  'counterattack',
  'aerial-team',
  'elite-keeper',
  'possession-overload',
  'aggressive-marking',
]);

const tacticalPitchByPractice = new WeakMap<FootballPractice, number>();

function isTacticalProblem(value: string): value is CampaignEncounter['tacticalProblem'] {
  return TACTICAL_PROBLEMS.has(value as CampaignEncounter['tacticalProblem']);
}

function scaleWorldBounds(base: Readonly<MovementWorld>, scale: number): MovementWorld {
  if (Math.abs(scale - 1) <= 1e-9) return { ...base, bounds: { ...base.bounds } };
  const centerX = (base.bounds.minX + base.bounds.maxX) / 2;
  const centerZ = (base.bounds.minZ + base.bounds.maxZ) / 2;
  const halfWidth = (base.bounds.maxX - base.bounds.minX) * scale / 2;
  const halfLength = (base.bounds.maxZ - base.bounds.minZ) * scale / 2;
  return {
    ...base,
    bounds: {
      minX: centerX - halfWidth,
      maxX: centerX + halfWidth,
      minZ: centerZ - halfLength,
      maxZ: centerZ + halfLength,
    },
  };
}

const originalSetCampaignChallenge = FootballPractice.prototype.setCampaignChallenge;
FootballPractice.prototype.setCampaignChallenge = function setCampaignChallengeWithAuthoredTactics(
  this: FootballPractice,
  encounter: Parameters<FootballPractice['setCampaignChallenge']>[0],
): void {
  if (!encounter) {
    tacticalPitchByPractice.set(this, 1);
    originalSetCampaignChallenge.call(this, null);
    delete this.root.dataset.campaignPressure;
    delete this.root.dataset.campaignPitchScale;
    delete this.root.dataset.campaignRecoveryRate;
    delete this.root.dataset.campaignKeeperMaxHeight;
    return;
  }

  const normalCampaignEncounter = !encounter.legacyGauntlet && isTacticalProblem(encounter.tacticalProblem);
  const intended = resolveLiveCampaignModifiers(encounter.tacticalProblem, encounter.legacyGauntlet ?? null);
  let forwarded = encounter;

  if (normalCampaignEncounter) {
    const tacticalProblem = encounter.tacticalProblem as CampaignEncounter['tacticalProblem'];
    const syntheticGauntlet = buildSyntheticCampaignGauntlet(tacticalProblem);
    tacticalPitchByPractice.set(this, tacticalPitchScale(tacticalProblem));
    if (syntheticGauntlet) forwarded = { ...encounter, legacyGauntlet: syntheticGauntlet };
  } else {
    tacticalPitchByPractice.set(this, 1);
  }

  originalSetCampaignChallenge.call(this, forwarded);
  this.root.dataset.campaignPressure = intended.pressure.toFixed(3);
  this.root.dataset.campaignPitchScale = intended.pitchScale.toFixed(4);
  this.root.dataset.campaignRecoveryRate = intended.recoveryRate.toFixed(3);
  this.root.dataset.campaignKeeperMaxHeight = intended.keeperMaxHeight.toFixed(4);

  // Synthetic gauntlets are an implementation adapter only. A normal campaign
  // encounter must never be presented as Legacy content to the player.
  if (normalCampaignEncounter) {
    this.root.dataset.campaignLegacyModifier = '';
    this.root.dataset.campaignLegacyLevel = '';
    const label = this.root.querySelector<HTMLElement>('[data-campaign-objective]');
    if (label) {
      label.textContent = `CAREER CHALLENGE · ${encounter.tacticalProblem.replaceAll('-', ' ')} · score a physical goal to advance`;
    }
  }
};

const originalMovementWorld = FootballPractice.prototype.movementWorld;
FootballPractice.prototype.movementWorld = function movementWorldWithAuthoredTactics(
  this: FootballPractice,
  base: Readonly<MovementWorld>,
): MovementWorld {
  const legacyAdjusted = originalMovementWorld.call(this, base);
  return scaleWorldBounds(legacyAdjusted, tacticalPitchByPractice.get(this) ?? 1);
};
