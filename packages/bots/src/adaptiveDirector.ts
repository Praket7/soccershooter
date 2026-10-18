import type { BotDifficultyTier } from './difficulty';
import type { PlayerModelSnapshot } from './playerModel';

export type AdaptiveGameMode = 'pve' | 'pvp';
export type AdaptiveBoundaryKind = 'encounter-start' | 'restart' | 'live-possession';

export interface AdaptiveDirectorState {
  mode: AdaptiveGameMode;
  tier: BotDifficultyTier;
  adaptationEnabled: boolean;
  lastBoundaryToken: string | null;
  changeCount: number;
  lastSkillScore: number | null;
  lastModelConfidence: number;
}

export interface AdaptiveBoundaryContext {
  kind: AdaptiveBoundaryKind;
  token: string;
  playerModel: Readonly<PlayerModelSnapshot>;
}

const TIER_ORDER: readonly BotDifficultyTier[] = ['novice', 'standard', 'elite'];
const MIN_MODEL_CONFIDENCE = 0.55;

export function createAdaptiveDirector(
  mode: AdaptiveGameMode,
  initialTier: BotDifficultyTier = 'standard',
): AdaptiveDirectorState {
  return {
    mode,
    tier: initialTier,
    adaptationEnabled: mode === 'pve',
    lastBoundaryToken: null,
    changeCount: 0,
    lastSkillScore: null,
    lastModelConfidence: 0,
  };
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function aggregateConfidence(model: Readonly<PlayerModelSnapshot>): number {
  const metrics = [
    model.passAccuracy,
    model.shotConversion,
    model.pressuredTurnoverRate,
    model.dribbleSuccess,
    model.defensiveTiming,
    model.reactionProxy,
    model.techniqueDiversity,
  ];
  return metrics.reduce((sum, metric) => sum + clamp01(metric.confidence), 0) / metrics.length;
}

export function playerSkillScore(model: Readonly<PlayerModelSnapshot>): number {
  return clamp01(
    model.passAccuracy.value * 0.18
      + model.shotConversion.value * 0.14
      + (1 - model.pressuredTurnoverRate.value) * 0.18
      + model.dribbleSuccess.value * 0.16
      + model.defensiveTiming.value * 0.14
      + model.reactionProxy.value * 0.12
      + model.techniqueDiversity.value * 0.08,
  );
}

function targetTier(score: number): BotDifficultyTier {
  if (score < 0.42) return 'novice';
  if (score > 0.68) return 'elite';
  return 'standard';
}

function moveOneTier(current: BotDifficultyTier, target: BotDifficultyTier): BotDifficultyTier {
  const currentIndex = TIER_ORDER.indexOf(current);
  const targetIndex = TIER_ORDER.indexOf(target);
  if (targetIndex === currentIndex) return current;
  return TIER_ORDER[currentIndex + Math.sign(targetIndex - currentIndex)] ?? current;
}

export function applyAdaptiveBoundary(
  state: Readonly<AdaptiveDirectorState>,
  context: Readonly<AdaptiveBoundaryContext>,
): AdaptiveDirectorState {
  if (!state.adaptationEnabled || state.mode === 'pvp') return { ...state };
  if (context.kind === 'live-possession') return { ...state };
  if (!context.token || context.token === state.lastBoundaryToken) return { ...state };

  const confidence = aggregateConfidence(context.playerModel);
  const score = playerSkillScore(context.playerModel);
  if (confidence < MIN_MODEL_CONFIDENCE) {
    return {
      ...state,
      lastBoundaryToken: context.token,
      lastSkillScore: score,
      lastModelConfidence: confidence,
    };
  }

  const nextTier = moveOneTier(state.tier, targetTier(score));
  return {
    ...state,
    tier: nextTier,
    lastBoundaryToken: context.token,
    changeCount: state.changeCount + (nextTier === state.tier ? 0 : 1),
    lastSkillScore: score,
    lastModelConfidence: confidence,
  };
}
