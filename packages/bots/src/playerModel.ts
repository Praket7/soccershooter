const PLAYER_MODEL_HALF_LIFE_SECONDS = 120;
const CONFIDENCE_SAMPLE_SCALE = 6;

export type PlayerModelZone =
  | 'defensive-left'
  | 'defensive-center'
  | 'defensive-right'
  | 'middle-left'
  | 'middle-center'
  | 'middle-right'
  | 'attacking-left'
  | 'attacking-center'
  | 'attacking-right';

export interface PlayerObservation {
  timeSeconds: number;
  pass?: { completed: boolean };
  shot?: { scored: boolean };
  pressuredTurnover?: boolean;
  dribble?: { succeeded: boolean };
  defensiveTiming?: number;
  reactionSeconds?: number;
  zone?: PlayerModelZone;
  technique?: string;
}

interface RollingEstimate {
  weightedTotal: number;
  weight: number;
}

export interface PlayerModelState {
  lastTimeSeconds: number | null;
  passAccuracy: RollingEstimate;
  shotConversion: RollingEstimate;
  pressuredTurnoverRate: RollingEstimate;
  dribbleSuccess: RollingEstimate;
  defensiveTiming: RollingEstimate;
  reactionProxy: RollingEstimate;
  zoneWeights: Record<PlayerModelZone, number>;
  techniqueWeights: Record<string, number>;
}

export interface PlayerModelMetricSnapshot {
  value: number;
  confidence: number;
}

export interface PlayerModelSnapshot {
  passAccuracy: PlayerModelMetricSnapshot;
  shotConversion: PlayerModelMetricSnapshot;
  pressuredTurnoverRate: PlayerModelMetricSnapshot;
  dribbleSuccess: PlayerModelMetricSnapshot;
  defensiveTiming: PlayerModelMetricSnapshot;
  reactionProxy: PlayerModelMetricSnapshot;
  favoredZones: Array<{ zone: PlayerModelZone; share: number; confidence: number }>;
  techniqueDiversity: PlayerModelMetricSnapshot;
}

const ZONES: readonly PlayerModelZone[] = [
  'defensive-left',
  'defensive-center',
  'defensive-right',
  'middle-left',
  'middle-center',
  'middle-right',
  'attacking-left',
  'attacking-center',
  'attacking-right',
];

function blankEstimate(): RollingEstimate {
  return { weightedTotal: 0, weight: 0 };
}

function blankZones(): Record<PlayerModelZone, number> {
  return Object.fromEntries(ZONES.map((zone) => [zone, 0])) as Record<PlayerModelZone, number>;
}

export function createPlayerModel(): PlayerModelState {
  return {
    lastTimeSeconds: null,
    passAccuracy: blankEstimate(),
    shotConversion: blankEstimate(),
    pressuredTurnoverRate: blankEstimate(),
    dribbleSuccess: blankEstimate(),
    defensiveTiming: blankEstimate(),
    reactionProxy: blankEstimate(),
    zoneWeights: blankZones(),
    techniqueWeights: {},
  };
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function decayFactor(deltaSeconds: number): number {
  if (deltaSeconds <= 0) return 1;
  return 0.5 ** (deltaSeconds / PLAYER_MODEL_HALF_LIFE_SECONDS);
}

function decayEstimate(estimate: Readonly<RollingEstimate>, factor: number): RollingEstimate {
  return {
    weightedTotal: estimate.weightedTotal * factor,
    weight: estimate.weight * factor,
  };
}

function addEstimate(estimate: Readonly<RollingEstimate>, value: number): RollingEstimate {
  return {
    weightedTotal: estimate.weightedTotal + clamp01(value),
    weight: estimate.weight + 1,
  };
}

function metricSnapshot(estimate: Readonly<RollingEstimate>): PlayerModelMetricSnapshot {
  if (estimate.weight <= 1e-9) return { value: 0, confidence: 0 };
  return {
    value: clamp01(estimate.weightedTotal / estimate.weight),
    confidence: clamp01(1 - Math.exp(-estimate.weight / CONFIDENCE_SAMPLE_SCALE)),
  };
}

function decayedState(model: Readonly<PlayerModelState>, timeSeconds: number): PlayerModelState {
  const safeTime = Number.isFinite(timeSeconds) ? Math.max(0, timeSeconds) : 0;
  const delta = model.lastTimeSeconds === null ? 0 : Math.max(0, safeTime - model.lastTimeSeconds);
  const factor = decayFactor(delta);
  const zoneWeights = blankZones();
  for (const zone of ZONES) zoneWeights[zone] = model.zoneWeights[zone] * factor;
  const techniqueWeights: Record<string, number> = {};
  for (const [technique, weight] of Object.entries(model.techniqueWeights)) {
    const next = weight * factor;
    if (next > 1e-8) techniqueWeights[technique] = next;
  }
  return {
    lastTimeSeconds: safeTime,
    passAccuracy: decayEstimate(model.passAccuracy, factor),
    shotConversion: decayEstimate(model.shotConversion, factor),
    pressuredTurnoverRate: decayEstimate(model.pressuredTurnoverRate, factor),
    dribbleSuccess: decayEstimate(model.dribbleSuccess, factor),
    defensiveTiming: decayEstimate(model.defensiveTiming, factor),
    reactionProxy: decayEstimate(model.reactionProxy, factor),
    zoneWeights,
    techniqueWeights,
  };
}

export function recordPlayerObservation(
  model: Readonly<PlayerModelState>,
  observation: Readonly<PlayerObservation>,
): PlayerModelState {
  const next = decayedState(model, observation.timeSeconds);
  if (observation.pass) next.passAccuracy = addEstimate(next.passAccuracy, observation.pass.completed ? 1 : 0);
  if (observation.shot) next.shotConversion = addEstimate(next.shotConversion, observation.shot.scored ? 1 : 0);
  if (typeof observation.pressuredTurnover === 'boolean') {
    next.pressuredTurnoverRate = addEstimate(next.pressuredTurnoverRate, observation.pressuredTurnover ? 1 : 0);
  }
  if (observation.dribble) next.dribbleSuccess = addEstimate(next.dribbleSuccess, observation.dribble.succeeded ? 1 : 0);
  if (typeof observation.defensiveTiming === 'number' && Number.isFinite(observation.defensiveTiming)) {
    next.defensiveTiming = addEstimate(next.defensiveTiming, observation.defensiveTiming);
  }
  if (typeof observation.reactionSeconds === 'number' && Number.isFinite(observation.reactionSeconds)) {
    const reactionProxy = 1 - Math.max(0, observation.reactionSeconds) / 0.6;
    next.reactionProxy = addEstimate(next.reactionProxy, reactionProxy);
  }
  if (observation.zone) next.zoneWeights[observation.zone] += 1;
  if (observation.technique) {
    const technique = observation.technique.trim().slice(0, 48);
    if (technique) next.techniqueWeights[technique] = (next.techniqueWeights[technique] ?? 0) + 1;
  }
  return next;
}

function favoredZones(model: Readonly<PlayerModelState>): PlayerModelSnapshot['favoredZones'] {
  const total = ZONES.reduce((sum, zone) => sum + model.zoneWeights[zone], 0);
  if (total <= 1e-9) return [];
  const confidence = clamp01(1 - Math.exp(-total / CONFIDENCE_SAMPLE_SCALE));
  return ZONES
    .map((zone) => ({ zone, share: model.zoneWeights[zone] / total, confidence }))
    .filter((entry) => entry.share > 0)
    .sort((a, b) => b.share - a.share || a.zone.localeCompare(b.zone))
    .slice(0, 3);
}

function techniqueDiversity(model: Readonly<PlayerModelState>): PlayerModelMetricSnapshot {
  const weights = Object.values(model.techniqueWeights).filter((weight) => weight > 1e-9);
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  if (total <= 1e-9) return { value: 0, confidence: 0 };
  const concentration = weights.reduce((sum, weight) => {
    const share = weight / total;
    return sum + share * share;
  }, 0);
  return {
    value: clamp01(1 - concentration),
    confidence: clamp01(1 - Math.exp(-total / CONFIDENCE_SAMPLE_SCALE)),
  };
}

export function playerModelSnapshot(model: Readonly<PlayerModelState>): PlayerModelSnapshot {
  return {
    passAccuracy: metricSnapshot(model.passAccuracy),
    shotConversion: metricSnapshot(model.shotConversion),
    pressuredTurnoverRate: metricSnapshot(model.pressuredTurnoverRate),
    dribbleSuccess: metricSnapshot(model.dribbleSuccess),
    defensiveTiming: metricSnapshot(model.defensiveTiming),
    reactionProxy: metricSnapshot(model.reactionProxy),
    favoredZones: favoredZones(model),
    techniqueDiversity: techniqueDiversity(model),
  };
}
