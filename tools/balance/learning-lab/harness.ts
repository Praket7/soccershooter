import { performance } from 'node:perf_hooks';
import {
  validateHighLevelProposal,
  type HighLevelAction,
  type HighLevelPolicyAdapter,
  type HighLevelPolicyFeatureValue,
} from '../../../packages/bots/src/highLevelPolicy';
import { evaluatePromotion, type PromotionMetrics } from './evaluate';

export interface LearningLabBenchmarkOptions {
  trainingScenarios: number;
  evaluationEpisodes: number;
  seed: number;
}

export interface LearningLabBenchmarkReport {
  version: 1;
  seed: number;
  trainingExamples: number;
  evaluationEpisodes: number;
  expertAgreement: number;
  invalidProposalCount: number;
  averageInferenceMs: number;
  maxInferenceMs: number;
  metrics: PromotionMetrics;
  promotion: ReturnType<typeof evaluatePromotion>;
  enabledInProduction: false;
  learnedAdapterId: string;
  checksum: string;
}

type LabZone = 'defensive' | 'middle' | 'attacking';
type LabPressure = 'low' | 'high';
type LabScoreState = 'behind' | 'level' | 'ahead';

interface LabState {
  zone: LabZone;
  pressure: LabPressure;
  supportOpen: boolean;
  scoreState: LabScoreState;
}

class SeededRandom {
  #state: number;

  constructor(seed: number) {
    this.#state = seed >>> 0 || 0x7007beef;
  }

  nextUint32(): number {
    let value = this.#state;
    value ^= value << 13;
    value ^= value >>> 17;
    value ^= value << 5;
    this.#state = value >>> 0;
    return this.#state;
  }

  nextInt(maxExclusive: number): number {
    return this.nextUint32() % maxExclusive;
  }
}

const ZONES: readonly LabZone[] = ['defensive', 'middle', 'attacking'];
const PRESSURES: readonly LabPressure[] = ['low', 'high'];
const SCORE_STATES: readonly LabScoreState[] = ['behind', 'level', 'ahead'];

function randomState(rng: SeededRandom): LabState {
  return {
    zone: ZONES[rng.nextInt(ZONES.length)]!,
    pressure: PRESSURES[rng.nextInt(PRESSURES.length)]!,
    supportOpen: rng.nextInt(2) === 1,
    scoreState: SCORE_STATES[rng.nextInt(SCORE_STATES.length)]!,
  };
}

function expertAction(state: Readonly<LabState>): HighLevelAction {
  if (state.zone === 'defensive' && state.pressure === 'high') return 'clear';
  if (state.supportOpen && state.pressure === 'high') return 'pass';
  if (state.zone === 'attacking' && state.scoreState === 'behind') return 'shoot';
  if (state.zone === 'attacking' && state.pressure === 'low') return 'shoot';
  if (state.supportOpen) return 'pass';
  if (state.pressure === 'high') return 'protect';
  return 'dribble';
}

function stateKey(state: Readonly<LabState>): string {
  return `${state.zone}|${state.pressure}|${state.supportOpen ? 1 : 0}|${state.scoreState}`;
}

function labFeatures(state: Readonly<LabState>): Readonly<Record<string, HighLevelPolicyFeatureValue>> {
  return {
    zone: state.zone,
    pressure: state.pressure,
    supportOpen: state.supportOpen,
    scoreState: state.scoreState,
  };
}

function keyFromFeatures(features: Readonly<Record<string, HighLevelPolicyFeatureValue>> | undefined): string | null {
  if (!features) return null;
  const zone = features.zone;
  const pressure = features.pressure;
  const supportOpen = features.supportOpen;
  const scoreState = features.scoreState;
  if (!ZONES.includes(zone as LabZone)) return null;
  if (!PRESSURES.includes(pressure as LabPressure)) return null;
  if (typeof supportOpen !== 'boolean') return null;
  if (!SCORE_STATES.includes(scoreState as LabScoreState)) return null;
  return stateKey({
    zone: zone as LabZone,
    pressure: pressure as LabPressure,
    supportOpen,
    scoreState: scoreState as LabScoreState,
  });
}

function chooseMostFrequent(counts: ReadonlyMap<HighLevelAction, number> | undefined): HighLevelAction {
  if (!counts || counts.size === 0) return 'protect';
  return [...counts.entries()]
    .sort(([actionA, countA], [actionB, countB]) => countB - countA || actionA.localeCompare(actionB))[0]![0];
}

function trainTabularBehaviorCloner(trainingScenarios: number, seed: number): HighLevelPolicyAdapter {
  const rng = new SeededRandom(seed ^ 0x51a7b00c);
  const table = new Map<string, Map<HighLevelAction, number>>();

  for (let index = 0; index < trainingScenarios; index += 1) {
    const state = randomState(rng);
    const key = stateKey(state);
    const action = expertAction(state);
    const actionCounts = table.get(key) ?? new Map<HighLevelAction, number>();
    actionCounts.set(action, (actionCounts.get(action) ?? 0) + 1);
    table.set(key, actionCounts);
  }

  return {
    id: 'tabular-behavior-clone-v1',
    enabled: true,
    propose(context) {
      const playerId = context.playerIds[0];
      if (!playerId) return [];
      const key = keyFromFeatures(context.features);
      const action = chooseMostFrequent(key ? table.get(key) : undefined);
      return [{ playerId, action }];
    },
  };
}

function mixChecksum(hash: number, value: number): number {
  let next = hash ^ (value >>> 0);
  next = Math.imul(next, 16777619);
  return next >>> 0;
}

function actionCode(action: string): number {
  let hash = 2166136261 >>> 0;
  for (let index = 0; index < action.length; index += 1) {
    hash = mixChecksum(hash, action.charCodeAt(index));
  }
  return hash;
}

export function runLearningLabBenchmark(options: Readonly<LearningLabBenchmarkOptions>): LearningLabBenchmarkReport {
  const trainingScenarios = Math.max(72, Math.min(100_000, Math.floor(options.trainingScenarios)));
  const evaluationEpisodes = Math.max(1, Math.min(10_000, Math.floor(options.evaluationEpisodes)));
  const seed = options.seed >>> 0;
  const policy = trainTabularBehaviorCloner(trainingScenarios, seed);
  const rng = new SeededRandom(seed ^ 0xa11ce55);

  const decisionsPerEpisode = 6;
  let totalDecisions = 0;
  let expertMatches = 0;
  let invalidProposalCount = 0;
  let cooperationOpportunities = 0;
  let cooperationSuccesses = 0;
  let suspiciousPasses = 0;
  let episodeWins = 0;
  let inferenceTimeSum = 0;
  let maxInferenceMs = 0;
  let checksum = 2166136261 >>> 0;

  for (let episode = 0; episode < evaluationEpisodes; episode += 1) {
    let episodeMatches = 0;
    for (let step = 0; step < decisionsPerEpisode; step += 1) {
      const state = randomState(rng);
      const expert = expertAction(state);
      const started = performance.now();
      const rawProposal = policy.propose({
        team: 'home',
        tick: episode * decisionsPerEpisode + step,
        playerIds: ['lab-player'],
        features: labFeatures(state),
      })[0];
      const elapsed = performance.now() - started;
      inferenceTimeSum += elapsed;
      maxInferenceMs = Math.max(maxInferenceMs, elapsed);
      totalDecisions += 1;

      if (!rawProposal) {
        invalidProposalCount += 1;
        checksum = mixChecksum(checksum, 0);
        continue;
      }

      let action: HighLevelAction | undefined;
      try {
        const proposal = validateHighLevelProposal(rawProposal);
        action = proposal.action;
      } catch {
        invalidProposalCount += 1;
      }

      if (!action) {
        invalidProposalCount += 1;
        checksum = mixChecksum(checksum, 1);
        continue;
      }

      if (action === expert) {
        expertMatches += 1;
        episodeMatches += 1;
      }
      if (state.supportOpen && expert === 'pass') {
        cooperationOpportunities += 1;
        if (action === 'pass') cooperationSuccesses += 1;
      }
      if (action === 'pass' && expert !== 'pass') suspiciousPasses += 1;

      checksum = mixChecksum(checksum, actionCode(action));
      checksum = mixChecksum(checksum, action === expert ? 1 : 0);
    }
    if (episodeMatches >= 4) episodeWins += 1;
  }

  const expertAgreement = expertMatches / Math.max(1, totalDecisions);
  const cooperationScore = cooperationSuccesses / Math.max(1, cooperationOpportunities);
  const cornerCaseSafety = 1 - invalidProposalCount / Math.max(1, totalDecisions);
  const exploitRate = suspiciousPasses / Math.max(1, totalDecisions);
  const averageInferenceMs = inferenceTimeSum / Math.max(1, totalDecisions);
  const readabilityScore = expertAgreement;
  const winRate = episodeWins / evaluationEpisodes;

  const metrics: PromotionMetrics = {
    cooperationScore,
    cornerCaseSafety,
    exploitRate,
    inferenceMs: averageInferenceMs,
    readabilityScore,
    winRate,
    humanPreference: null,
  };

  return {
    version: 1,
    seed,
    trainingExamples: trainingScenarios,
    evaluationEpisodes,
    expertAgreement,
    invalidProposalCount,
    averageInferenceMs,
    maxInferenceMs,
    metrics,
    promotion: evaluatePromotion(metrics),
    enabledInProduction: false,
    learnedAdapterId: policy.id,
    checksum: checksum.toString(16).padStart(8, '0'),
  };
}

export function machineSideBenchmarkPass(report: Readonly<LearningLabBenchmarkReport>): boolean {
  const metrics = report.metrics;
  return report.invalidProposalCount === 0
    && report.enabledInProduction === false
    && report.expertAgreement >= 0.8
    && metrics.cooperationScore >= 0.75
    && metrics.cornerCaseSafety >= 0.9
    && metrics.exploitRate <= 0.05
    && metrics.inferenceMs <= 1
    && metrics.readabilityScore >= 0.75
    && metrics.winRate >= 0.52
    && metrics.humanPreference === null
    && report.promotion.pass === false
    && report.promotion.failures.length === 1
    && report.promotion.failures[0] === 'human-preference-pending';
}

function cliOptions(): LearningLabBenchmarkOptions {
  let trainingScenarios = 2200;
  let evaluationEpisodes = 600;
  let seed = 0x7007cafe;
  for (const arg of process.argv.slice(2)) {
    if (arg.startsWith('--training=')) trainingScenarios = Number(arg.slice('--training='.length));
    if (arg.startsWith('--episodes=')) evaluationEpisodes = Number(arg.slice('--episodes='.length));
    if (arg.startsWith('--seed=')) seed = Number(arg.slice('--seed='.length));
  }
  return { trainingScenarios, evaluationEpisodes, seed };
}

if (process.argv[1]?.endsWith('harness.ts')) {
  const report = runLearningLabBenchmark(cliOptions());
  process.stdout.write(`${JSON.stringify({ ...report, machineGate: machineSideBenchmarkPass(report) }, null, 2)}\n`);
  if (!machineSideBenchmarkPass(report)) process.exitCode = 1;
}