import { performance } from 'node:perf_hooks';
import { applyAdaptiveBoundary, createAdaptiveDirector } from '../../packages/bots/src/adaptiveDirector';
import {
  BOT_DIFFICULTY_TIERS,
  difficultyParameterSnapshot,
  physicalDifficultySnapshot,
  type BotDifficultyTier,
} from '../../packages/bots/src/difficulty';
import { createDisabledHighLevelPolicy } from '../../packages/bots/src/highLevelPolicy';
import {
  createPlayerModel,
  playerModelSnapshot,
  recordPlayerObservation,
  type PlayerModelSnapshot,
} from '../../packages/bots/src/playerModel';
import { createTeamBotRuntime, stepTeamBotRuntime } from '../../packages/bots/src/runtime';
import { chooseCarrierAction } from '../../packages/bots/src/utility';
import type { BotWorldSnapshot } from '../../packages/bots/src/types';
import { evaluateLearningEpisode, evaluatePromotion } from './learning-lab/evaluate';

export interface AdaptiveTournamentOptions {
  scenariosPerTier: number;
  seed: number;
}

export interface AdaptiveTierReport {
  completedScenarios: number;
  actionAgreementRate: number;
  referenceAgreement: number;
  reactionSuccessRate: number;
  meanAimErrorRadians: number;
  meanUtility: number;
  actionCounts: Record<string, number>;
}

export interface AdaptiveTournamentReport {
  version: 1;
  seed: number;
  scenariosPerTier: number;
  physicalInvariant: boolean;
  simulationFailures: number;
  illegalMidPossessionChanges: number;
  pvpAdaptiveChanges: number;
  learnedPolicyEnabledByDefault: boolean;
  tiers: Record<BotDifficultyTier, AdaptiveTierReport>;
  personalityDistinctness: number;
  rewardSafety: {
    passSpamFlagged: boolean;
    winningRewardHigher: boolean;
  };
  learnedPromotion: ReturnType<typeof evaluatePromotion>;
  averageDecisionMs: number;
  maxDecisionMs: number;
  checksum: string;
  gate: { pass: boolean; failures: string[] };
}

class SeededRandom {
  #state: number;
  constructor(seed: number) { this.#state = seed >>> 0 || 0x7007a11; }
  nextUint32(): number {
    let value = this.#state;
    value ^= value << 13;
    value ^= value >>> 17;
    value ^= value << 5;
    this.#state = value >>> 0;
    return this.#state;
  }
  next(): number { return this.nextUint32() / 0x100000000; }
  range(min: number, max: number): number { return min + (max - min) * this.next(); }
}

function player(id: string, team: 'home' | 'away', x: number, z: number, goalkeeper = false) {
  return {
    id, team, goalkeeper,
    position: { x, y: 0, z },
    velocity: { x: 0, y: 0, z: 0 },
    facingYaw: team === 'home' ? 0 : Math.PI,
  };
}

function makeWorld(seed: number, index: number): { world: BotWorldSnapshot; reactionSeconds: number } {
  const rng = new SeededRandom((seed ^ Math.imul(index + 1, 0x9e3779b1)) >>> 0);
  const z = rng.range(-5, 10.8);
  const x = rng.range(-4.5, 2.2);
  const mateX = rng.range(3.2, 6.7);
  const mateZ = z + rng.range(2.5, 6.5);
  const pressureX = x + rng.range(0.7, 3.4);
  const pressureZ = z + rng.range(-0.7, 2.5);
  const world: BotWorldSnapshot = {
    tick: index * 7,
    timeSeconds: index * 0.01,
    field: { halfWidth: 12, halfLength: 18, goalHalfWidth: 3.66 },
    ball: { position: { x, y: 0.11, z }, velocity: { x: 0, y: 0, z: 0 } },
    players: [
      player('h-gk', 'home', 0, -16.7, true),
      player('h-1', 'home', x, z),
      player('h-2', 'home', mateX, mateZ),
      player('a-gk', 'away', 0, 16.7, true),
      player('a-1', 'away', pressureX, pressureZ),
      player('a-2', 'away', mateX + rng.range(-1.4, 1.4), mateZ + rng.range(-1.1, 1.8)),
    ],
    possessionTeam: 'home',
    possessionPlayerId: 'h-1',
  };
  return { world, reactionSeconds: rng.range(0.04, 0.24) };
}

function angleDelta(a: number, b: number): number {
  let delta = a - b;
  while (delta >= Math.PI) delta -= Math.PI * 2;
  while (delta < -Math.PI) delta += Math.PI * 2;
  return Math.abs(delta);
}

function mix(hash: number, value: number): number {
  let next = hash ^ (value >>> 0);
  next = Math.imul(next, 16777619);
  return next >>> 0;
}

function oracleAction(world: Readonly<BotWorldSnapshot>): string {
  const elite = difficultyParameterSnapshot('elite');
  return chooseCarrierAction(world, 'h-1', {
    personalityId: 'balanced',
    predictionHorizonSeconds: elite.predictionHorizonSeconds,
    passRiskTolerance: elite.passRiskTolerance,
    coordinatedRunFrequency: elite.coordinatedRunFrequency,
    defensiveAnticipation: elite.defensiveAnticipation,
  }).kind;
}

function runTier(tier: BotDifficultyTier, options: Readonly<AdaptiveTournamentOptions>) {
  let completedScenarios = 0;
  let actionMatches = 0;
  let reactionSuccess = 0;
  let aimErrorSum = 0;
  let utilitySum = 0;
  let timingSum = 0;
  let timingSamples = 0;
  let maxDecisionMs = 0;
  let failures = 0;
  let checksum = 2166136261 >>> 0;
  const actionCounts: Record<string, number> = {};

  for (let index = 0; index < options.scenariosPerTier; index += 1) {
    const { world, reactionSeconds } = makeWorld(options.seed, index);
    const oracle = oracleAction(world);
    const reference = stepTeamBotRuntime(world, 'home', createTeamBotRuntime());
    const config = { tier, seed: options.seed ^ index } as const;
    const started = performance.now();
    const result = stepTeamBotRuntime(world, 'home', createTeamBotRuntime(), config);
    const elapsed = performance.now() - started;
    timingSum += elapsed;
    timingSamples += 1;
    maxDecisionMs = Math.max(maxDecisionMs, elapsed);
    const carrier = result.intents.find((intent) => intent.playerId === 'h-1');
    const referenceCarrier = reference.intents.find((intent) => intent.playerId === 'h-1');
    if (!carrier || !referenceCarrier || !Number.isFinite(carrier.aimYaw)) {
      failures += 1;
      continue;
    }
    completedScenarios += 1;
    if (carrier.action === oracle) actionMatches += 1;
    actionCounts[carrier.action] = (actionCounts[carrier.action] ?? 0) + 1;
    aimErrorSum += angleDelta(carrier.aimYaw, referenceCarrier.aimYaw);
    utilitySum += carrier.utilityScore;

    const turnover: BotWorldSnapshot = JSON.parse(JSON.stringify(world)) as BotWorldSnapshot;
    turnover.timeSeconds = world.timeSeconds + reactionSeconds;
    turnover.tick = world.tick + Math.max(1, Math.round(reactionSeconds * 30));
    turnover.possessionTeam = 'away';
    turnover.possessionPlayerId = 'a-1';
    const awayCarrier = turnover.players.find((candidate) => candidate.id === 'a-1')!;
    turnover.ball.position = { ...awayCarrier.position, y: 0.11 };
    const reacted = stepTeamBotRuntime(turnover, 'home', result.state, config);
    if (reacted.reevaluated) reactionSuccess += 1;

    checksum = mix(checksum, carrier.action.charCodeAt(0) + Math.round(carrier.aimYaw * 10000));
    checksum = mix(checksum, reacted.reevaluated ? 1 : 0);
  }

  const actionAgreementRate = completedScenarios > 0 ? actionMatches / completedScenarios : 0;
  const meanAimErrorRadians = completedScenarios > 0 ? aimErrorSum / completedScenarios : 0;
  const aimFidelity = Math.max(0, 1 - meanAimErrorRadians / 0.12);
  const referenceAgreement = actionAgreementRate * 0.72 + aimFidelity * 0.28;
  return {
    report: {
      completedScenarios,
      actionAgreementRate,
      referenceAgreement,
      reactionSuccessRate: completedScenarios > 0 ? reactionSuccess / completedScenarios : 0,
      meanAimErrorRadians,
      meanUtility: completedScenarios > 0 ? utilitySum / completedScenarios : 0,
      actionCounts,
    } satisfies AdaptiveTierReport,
    failures,
    timingSum,
    timingSamples,
    maxDecisionMs,
    checksum,
  };
}

function strongModel(): PlayerModelSnapshot {
  let model = createPlayerModel();
  for (let index = 0; index < 30; index += 1) {
    model = recordPlayerObservation(model, {
      timeSeconds: index * 2,
      pass: { completed: index % 10 !== 0 },
      shot: { scored: index % 3 === 0 },
      pressuredTurnover: index % 8 === 0,
      dribble: { succeeded: index % 6 !== 0 },
      defensiveTiming: 0.86,
      reactionSeconds: 0.13,
      zone: 'attacking-center',
      technique: index % 2 === 0 ? 'finesse' : 'driven',
    });
  }
  return playerModelSnapshot(model);
}

function adaptationSafety(model: PlayerModelSnapshot) {
  let illegalMidPossessionChanges = 0;
  let state = createAdaptiveDirector('pve', 'standard');
  for (let index = 0; index < 12; index += 1) {
    const before = state.tier;
    state = applyAdaptiveBoundary(state, { kind: 'live-possession', token: `live-${index}`, playerModel: model });
    if (state.tier !== before) illegalMidPossessionChanges += 1;
    state = applyAdaptiveBoundary(state, { kind: 'restart', token: `restart-${index}`, playerModel: model });
  }
  let pvp = createAdaptiveDirector('pvp', 'standard');
  let pvpAdaptiveChanges = 0;
  for (let index = 0; index < 12; index += 1) {
    const before = pvp.tier;
    pvp = applyAdaptiveBoundary(pvp, { kind: 'restart', token: `pvp-${index}`, playerModel: model });
    if (pvp.tier !== before) pvpAdaptiveChanges += 1;
  }
  return { illegalMidPossessionChanges, pvpAdaptiveChanges };
}

function personalityDistinctness(seed: number): number {
  const ids = ['balanced', 'playmaker', 'winger', 'poacher', 'anchor', 'aggressive-presser'] as const;
  const fingerprints = new Set<string>();
  for (const personality of ids) {
    const counts: Record<string, number> = {};
    for (let index = 0; index < 120; index += 1) {
      const { world } = makeWorld(seed ^ 0x55aa, index);
      const result = stepTeamBotRuntime(world, 'home', createTeamBotRuntime(), {
        tier: 'standard', seed: seed ^ index, personalitiesByPlayerId: { 'h-1': personality },
      });
      const carrier = result.intents.find((intent) => intent.playerId === 'h-1');
      if (carrier) counts[carrier.action] = (counts[carrier.action] ?? 0) + 1;
    }
    fingerprints.add(JSON.stringify(Object.entries(counts).sort()));
  }
  return fingerprints.size;
}

export function runAdaptiveTournament(options: Readonly<AdaptiveTournamentOptions>): AdaptiveTournamentReport {
  const scenariosPerTier = Math.max(1, Math.min(10_000, Math.floor(options.scenariosPerTier)));
  const normalized = { scenariosPerTier, seed: options.seed >>> 0 };
  const tierRuns = Object.fromEntries(BOT_DIFFICULTY_TIERS.map((tier) => [tier, runTier(tier, normalized)])) as Record<BotDifficultyTier, ReturnType<typeof runTier>>;
  const tiers = Object.fromEntries(BOT_DIFFICULTY_TIERS.map((tier) => [tier, tierRuns[tier].report])) as Record<BotDifficultyTier, AdaptiveTierReport>;
  const physicalSnapshots = BOT_DIFFICULTY_TIERS.map((tier) => physicalDifficultySnapshot(tier));
  const physicalInvariant = physicalSnapshots.every((snapshot) => JSON.stringify(snapshot) === JSON.stringify(physicalSnapshots[0]));
  const safety = adaptationSafety(strongModel());
  const learnedPolicyEnabledByDefault = createDisabledHighLevelPolicy().enabled;
  const spam = evaluateLearningEpisode({
    goalsFor: 0, goalsAgainst: 0, progressivePasses: 2, usefulSupportActions: 2,
    repeatedPairPasses: 80, backwardPasses: 60, turnovers: 0, shotsOnTarget: 0,
  });
  const win = evaluateLearningEpisode({
    goalsFor: 2, goalsAgainst: 0, progressivePasses: 8, usefulSupportActions: 6,
    repeatedPairPasses: 1, backwardPasses: 2, turnovers: 3, shotsOnTarget: 4,
  });
  const learnedPromotion = evaluatePromotion({
    cooperationScore: 0.90, cornerCaseSafety: 0.97, exploitRate: 0.01,
    inferenceMs: 0.25, readabilityScore: 0.88, winRate: 0.60, humanPreference: null,
  });
  const simulationFailures = BOT_DIFFICULTY_TIERS.reduce((sum, tier) => sum + tierRuns[tier].failures, 0);
  const timingSum = BOT_DIFFICULTY_TIERS.reduce((sum, tier) => sum + tierRuns[tier].timingSum, 0);
  const timingSamples = BOT_DIFFICULTY_TIERS.reduce((sum, tier) => sum + tierRuns[tier].timingSamples, 0);
  const maxDecisionMs = Math.max(...BOT_DIFFICULTY_TIERS.map((tier) => tierRuns[tier].maxDecisionMs));
  let checksumValue = 2166136261 >>> 0;
  for (const tier of BOT_DIFFICULTY_TIERS) checksumValue = mix(checksumValue, tierRuns[tier].checksum);
  const distinctness = personalityDistinctness(normalized.seed);
  const failures: string[] = [];
  if (!physicalInvariant) failures.push('physical-invariance');
  if (simulationFailures !== 0) failures.push('simulation-failures');
  if (safety.illegalMidPossessionChanges !== 0) failures.push('mid-possession-adaptation');
  if (safety.pvpAdaptiveChanges !== 0) failures.push('pvp-adaptation');
  if (learnedPolicyEnabledByDefault) failures.push('learned-policy-default');
  if (!(tiers.novice.referenceAgreement < tiers.standard.referenceAgreement && tiers.standard.referenceAgreement <= tiers.elite.referenceAgreement)) failures.push('cognition-scaling');
  if (!(tiers.novice.reactionSuccessRate < tiers.standard.reactionSuccessRate && tiers.standard.reactionSuccessRate <= tiers.elite.reactionSuccessRate)) failures.push('reaction-scaling');
  if (!(tiers.elite.meanAimErrorRadians < tiers.standard.meanAimErrorRadians && tiers.standard.meanAimErrorRadians < tiers.novice.meanAimErrorRadians)) failures.push('aim-scaling');
  if (!spam.rewardHackFlags.includes('pass-loop') || win.trainingReward <= spam.trainingReward) failures.push('reward-safety');
  if (distinctness < 3) failures.push('personality-distinctness');
  if (timingSamples > 0 && timingSum / timingSamples >= 1) failures.push('decision-budget');

  return {
    version: 1,
    seed: normalized.seed,
    scenariosPerTier,
    physicalInvariant,
    simulationFailures,
    illegalMidPossessionChanges: safety.illegalMidPossessionChanges,
    pvpAdaptiveChanges: safety.pvpAdaptiveChanges,
    learnedPolicyEnabledByDefault,
    tiers,
    personalityDistinctness: distinctness,
    rewardSafety: {
      passSpamFlagged: spam.rewardHackFlags.includes('pass-loop'),
      winningRewardHigher: win.trainingReward > spam.trainingReward,
    },
    learnedPromotion,
    averageDecisionMs: timingSamples > 0 ? timingSum / timingSamples : 0,
    maxDecisionMs,
    checksum: checksumValue.toString(16).padStart(8, '0'),
    gate: { pass: failures.length === 0, failures },
  };
}

function cliOptions(): AdaptiveTournamentOptions {
  let scenariosPerTier = 2000;
  let seed = 0x7007a11;
  for (const arg of process.argv.slice(2)) {
    if (arg.startsWith('--scenarios=')) scenariosPerTier = Number(arg.slice('--scenarios='.length));
    if (arg.startsWith('--seed=')) seed = Number(arg.slice('--seed='.length));
  }
  return { scenariosPerTier, seed };
}

if (process.argv[1]?.endsWith('adaptiveTournament.ts')) {
  const report = runAdaptiveTournament(cliOptions());
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  if (!report.gate.pass) process.exitCode = 1;
}
