import { performance } from 'node:perf_hooks';
import { evaluatePassLane } from '../../packages/bots/src/passing';
import {
  createTeamBotRuntime,
  stepTeamBotRuntime,
  supportDistanceFromRoles,
  type TeamBotIntent,
  type TeamBotRuntimeState,
} from '../../packages/bots/src/runtime';
import { shotQuality } from '../../packages/bots/src/utility';
import {
  attackingDirection,
  clamp,
  clamp01,
  findPlayer,
  horizontalDistance,
  ownGoalZ,
  type BotPlayerSnapshot,
  type BotRole,
  type BotWorldSnapshot,
  type TeamId,
} from '../../packages/bots/src/types';

export interface TacticalTournamentOptions {
  possessions: number;
  seed: number;
}

export interface TacticalTournamentReport {
  version: 1;
  seed: number;
  possessionsRequested: number;
  possessionsCompleted: number;
  matchesCompleted: number;
  failures: number;
  passAttempts: number;
  completedPasses: number;
  multiPassPossessions: number;
  turnovers: number;
  shots: number;
  goals: number;
  roleSwitches: number;
  roleOccupancy: Record<BotRole, number>;
  keeperAbandonments: number;
  permanentSwarmPossessions: number;
  clusterRatio: number;
  idleRatio: number;
  averageSupportDistance: number;
  averageDecisionMsPerTeam: number;
  p99DecisionMsPerTeam: number;
  maxDecisionMsPerTeam: number;
  checksum: string;
}

class SeededRandom {
  #state: number;

  constructor(seed: number) {
    this.#state = seed >>> 0 || 0x6d2b79f5;
  }

  nextUint32(): number {
    let value = this.#state;
    value ^= value << 13;
    value ^= value >>> 17;
    value ^= value << 5;
    this.#state = value >>> 0;
    return this.#state;
  }

  next(): number {
    return this.nextUint32() / 0x100000000;
  }

  range(min: number, max: number): number {
    return min + (max - min) * this.next();
  }

  get state(): number {
    return this.#state;
  }
}

function createRoleOccupancy(): Record<BotRole, number> {
  return {
    goalkeeper: 0,
    'ball-carrier': 0,
    'immediate-support': 0,
    'width-support': 0,
    presser: 0,
    'cover-defender': 0,
    'recovery-runner': 0,
  };
}

function createPlayer(
  id: string,
  team: TeamId,
  x: number,
  z: number,
  goalkeeper = false,
): BotPlayerSnapshot {
  return {
    id,
    team,
    goalkeeper,
    position: { x, y: 0, z },
    velocity: { x: 0, y: 0, z: 0 },
    facingYaw: team === 'home' ? 0 : Math.PI,
  };
}

function makePossessionWorld(index: number, rng: SeededRandom): BotWorldSnapshot {
  const attacking: TeamId = index % 2 === 0 ? 'home' : 'away';
  const direction = attackingDirection(attacking);
  const advanced = index % 9 === 0;
  const carrierZ = direction * (advanced ? 10.8 : rng.range(-2.8, 0.8));
  const carrierX = rng.range(-3.2, -1.2);
  const mateZ = carrierZ + direction * rng.range(4.5, 6.8);
  const mateX = rng.range(3.2, 5.4);
  const homeCarrier = attacking === 'home';
  const players: BotPlayerSnapshot[] = [
    createPlayer('h-gk', 'home', 0, -16.7, true),
    createPlayer('h-1', 'home', homeCarrier ? carrierX : -carrierX, homeCarrier ? carrierZ : -carrierZ),
    createPlayer('h-2', 'home', homeCarrier ? mateX : -mateX, homeCarrier ? mateZ : -mateZ),
    createPlayer('a-gk', 'away', 0, 16.7, true),
    createPlayer('a-1', 'away', homeCarrier ? carrierX + 0.75 : -carrierX - 0.75, homeCarrier ? carrierZ + 0.9 : -carrierZ - 0.9),
    createPlayer('a-2', 'away', homeCarrier ? mateX - 0.9 : -mateX + 0.9, homeCarrier ? mateZ + 1.1 : -mateZ - 1.1),
  ];
  const carrierId = attacking === 'home' ? 'h-1' : 'a-1';
  if (attacking === 'away') {
    // Swap tactical roles for the mirrored possession while keeping stable IDs.
    players.find((p) => p.id === 'a-1')!.position = { x: carrierX, y: 0, z: carrierZ };
    players.find((p) => p.id === 'a-2')!.position = { x: mateX, y: 0, z: mateZ };
    players.find((p) => p.id === 'h-1')!.position = { x: carrierX + 0.75, y: 0, z: carrierZ - 0.9 };
    players.find((p) => p.id === 'h-2')!.position = { x: mateX - 0.9, y: 0, z: mateZ - 1.1 };
  }
  const carrier = players.find((player) => player.id === carrierId)!;
  return {
    tick: index * 100,
    timeSeconds: index * 2.2,
    field: { halfWidth: 12, halfLength: 18, goalHalfWidth: 3.66 },
    ball: { position: { x: carrier.position.x, y: 0.11, z: carrier.position.z }, velocity: { x: 0, y: 0, z: 0 } },
    players,
    possessionTeam: attacking,
    possessionPlayerId: carrierId,
  };
}

function approach(current: number, target: number, maxDelta: number): number {
  const delta = target - current;
  if (Math.abs(delta) <= maxDelta) return target;
  return current + Math.sign(delta) * maxDelta;
}

function applyIntents(world: BotWorldSnapshot, intents: readonly TeamBotIntent[], dt: number): void {
  for (const intent of intents) {
    const player = findPlayer(world, intent.playerId);
    const maxSpeed = intent.sprint ? 8.2 : 6.4;
    const desiredX = intent.moveX * maxSpeed;
    const desiredZ = intent.moveY * maxSpeed;
    const maxVelocityDelta = 9.2 * dt;
    player.velocity.x = approach(player.velocity.x, desiredX, maxVelocityDelta);
    player.velocity.z = approach(player.velocity.z, desiredZ, maxVelocityDelta);
    player.position.x = clamp(player.position.x + player.velocity.x * dt, -11.35, 11.35);
    player.position.z = clamp(player.position.z + player.velocity.z * dt, -17.35, 17.35);
    if (Math.hypot(player.velocity.x, player.velocity.z) > 0.05) {
      player.facingYaw = Math.atan2(player.velocity.x, player.velocity.z);
    }
  }
}

function opposingTeam(team: TeamId): TeamId {
  return team === 'home' ? 'away' : 'home';
}

function nearestOpponentDistance(world: Readonly<BotWorldSnapshot>, playerId: string): number {
  const player = findPlayer(world, playerId);
  let result = Number.POSITIVE_INFINITY;
  for (const opponent of world.players) {
    if (opponent.team === player.team) continue;
    result = Math.min(result, horizontalDistance(player.position, opponent.position));
  }
  return result;
}

function transferPossession(world: BotWorldSnapshot, playerId: string): void {
  const next = findPlayer(world, playerId);
  world.possessionTeam = next.team;
  world.possessionPlayerId = next.id;
  world.ball.position = { x: next.position.x, y: 0.11, z: next.position.z };
  world.ball.velocity = { x: 0, y: 0, z: 0 };
}

function turnoverToNearest(world: BotWorldSnapshot, team: TeamId): void {
  const candidates = world.players
    .filter((player) => player.team === team && !player.goalkeeper)
    .sort((a, b) => horizontalDistance(a.position, world.ball.position) - horizontalDistance(b.position, world.ball.position) || (a.id < b.id ? -1 : 1));
  if (candidates[0]) transferPossession(world, candidates[0].id);
}

function mixChecksum(hash: number, value: number): number {
  let next = hash ^ (value >>> 0);
  next = Math.imul(next, 16777619);
  return next >>> 0;
}

const DECISION_TIMING_BIN_MS = 0.01;
const DECISION_TIMING_BINS = 2001;

function recordDecisionTiming(histogram: Uint32Array, elapsedMs: number): void {
  const bin = Math.min(histogram.length - 1, Math.max(0, Math.floor(elapsedMs / DECISION_TIMING_BIN_MS)));
  histogram[bin] = (histogram[bin] ?? 0) + 1;
}

function decisionTimingPercentile(histogram: Uint32Array, samples: number, percentile: number): number {
  if (samples <= 0) return 0;
  const target = Math.max(1, Math.ceil(samples * percentile));
  let cumulative = 0;
  for (let index = 0; index < histogram.length; index += 1) {
    cumulative += histogram[index] ?? 0;
    if (cumulative >= target) return (index + 1) * DECISION_TIMING_BIN_MS;
  }
  return histogram.length * DECISION_TIMING_BIN_MS;
}

function timedStep(
  world: Readonly<BotWorldSnapshot>,
  team: TeamId,
  state: Readonly<TeamBotRuntimeState>,
): { result: ReturnType<typeof stepTeamBotRuntime>; elapsedMs: number } {
  const started = performance.now();
  const result = stepTeamBotRuntime(world, team, state);
  return { result, elapsedMs: performance.now() - started };
}

function warmTacticalRuntime(): void {
  const rng = new SeededRandom(0x51a6e006);
  const world = makePossessionWorld(1, rng);
  let home = createTeamBotRuntime();
  let away = createTeamBotRuntime();
  for (let index = 0; index < 150; index += 1) {
    world.timeSeconds += 0.1;
    world.tick += 3;
    home = stepTeamBotRuntime(world, 'home', home).state;
    away = stepTeamBotRuntime(world, 'away', away).state;
  }
}

export function runTacticalTournament(options: Readonly<TacticalTournamentOptions>): TacticalTournamentReport {
  const possessions = Math.max(1, Math.min(20_000, Math.floor(options.possessions)));
  const seed = options.seed >>> 0;
  const rng = new SeededRandom(seed);
  warmTacticalRuntime();

  let possessionsCompleted = 0;
  let failures = 0;
  let passAttempts = 0;
  let completedPasses = 0;
  let multiPassPossessions = 0;
  let turnovers = 0;
  let shots = 0;
  let goals = 0;
  let roleSwitches = 0;
  const roleOccupancy = createRoleOccupancy();
  let keeperAbandonments = 0;
  let permanentSwarmPossessions = 0;
  let clusterSamples = 0;
  let clusterHits = 0;
  let idleSamples = 0;
  let idleHits = 0;
  let supportDistanceSum = 0;
  let supportDistanceSamples = 0;
  let timingSum = 0;
  let timingSamples = 0;
  const decisionTimingHistogram = new Uint32Array(DECISION_TIMING_BINS);
  let maxDecisionMsPerTeam = 0;
  let checksum = 2166136261 >>> 0;

  for (let possession = 0; possession < possessions; possession += 1) {
    const world = makePossessionWorld(possession, rng);
    let homeRuntime = createTeamBotRuntime();
    let awayRuntime = createTeamBotRuntime();
    let passesThisPossession = 0;
    let clusteredTicks = 0;
    const ticks = 18;
    let ended = false;

    for (let tick = 0; tick < ticks; tick += 1) {
      const homeTimed = timedStep(world, 'home', homeRuntime);
      const awayTimed = timedStep(world, 'away', awayRuntime);
      homeRuntime = homeTimed.result.state;
      awayRuntime = awayTimed.result.state;
      for (const elapsed of [homeTimed.elapsedMs, awayTimed.elapsedMs]) {
        timingSum += elapsed;
        timingSamples += 1;
        recordDecisionTiming(decisionTimingHistogram, elapsed);
        maxDecisionMsPerTeam = Math.max(maxDecisionMsPerTeam, elapsed);
      }
      roleSwitches += homeRuntime.roles.switchCount + awayRuntime.roles.switchCount;
      for (const assignment of [...homeRuntime.roles.assignments, ...awayRuntime.roles.assignments]) {
        roleOccupancy[assignment.role] += 1;
      }

      const attackingRuntime = world.possessionTeam === 'home' ? homeRuntime : awayRuntime;
      const supportDistance = supportDistanceFromRoles(attackingRuntime.roles);
      if (supportDistance !== null) {
        supportDistanceSum += supportDistance;
        supportDistanceSamples += 1;
      }

      let tickClustered = false;
      for (const team of ['home', 'away'] as const) {
        const fieldPlayers = world.players.filter((player) => player.team === team && !player.goalkeeper);
        if (fieldPlayers.length >= 2) {
          clusterSamples += 1;
          if (horizontalDistance(fieldPlayers[0]!.position, fieldPlayers[1]!.position) < 2.25) {
            clusterHits += 1;
            tickClustered = true;
          }
        }
        const teamResult = team === 'home' ? homeTimed.result : awayTimed.result;
        for (const intent of teamResult.intents) {
          const player = findPlayer(world, intent.playerId);
          if (player.goalkeeper) continue;
          if (horizontalDistance(player.position, intent.targetPosition) <= 0.75) continue;
          idleSamples += 1;
          if (Math.hypot(intent.moveX, intent.moveY) < 0.08) idleHits += 1;
        }
        const keeper = world.players.find((player) => player.team === team && player.goalkeeper);
        if (keeper && Math.abs(keeper.position.z - ownGoalZ(world, team)) > 3.8) keeperAbandonments += 1;
      }
      if (tickClustered) clusteredTicks += 1;

      const possessionTeam = world.possessionTeam;
      const carrierId = world.possessionPlayerId;
      if (possessionTeam && carrierId) {
        const teamResult = possessionTeam === 'home' ? homeTimed.result : awayTimed.result;
        const carrierIntent = teamResult.intents.find((intent) => intent.playerId === carrierId);
        if (!carrierIntent) {
          failures += 1;
          ended = true;
          break;
        }
        if (carrierIntent.action === 'pass' && carrierIntent.targetPlayerId) {
          passAttempts += 1;
          const lane = evaluatePassLane(world, carrierId, carrierIntent.targetPlayerId);
          const successChance = clamp01(0.52 + lane.openness * 0.42);
          if (rng.next() <= successChance) {
            completedPasses += 1;
            passesThisPossession += 1;
            transferPossession(world, carrierIntent.targetPlayerId);
          } else {
            turnovers += 1;
            turnoverToNearest(world, opposingTeam(possessionTeam));
          }
        } else if (carrierIntent.action === 'shoot') {
          shots += 1;
          const quality = shotQuality(world, carrierId);
          if (rng.next() < 0.08 + quality * 0.56) goals += 1;
          ended = true;
        } else if (carrierIntent.action === 'clear') {
          turnovers += 1;
          turnoverToNearest(world, opposingTeam(possessionTeam));
          ended = true;
        }
      }

      applyIntents(world, homeTimed.result.intents, 0.1);
      applyIntents(world, awayTimed.result.intents, 0.1);
      if (world.possessionPlayerId) {
        const carrier = findPlayer(world, world.possessionPlayerId);
        world.ball.position = { x: carrier.position.x, y: 0.11, z: carrier.position.z };
        const pressure = nearestOpponentDistance(world, carrier.id);
        const protectFactor = (world.possessionTeam === 'home' ? homeTimed.result : awayTimed.result)
          .intents.find((intent) => intent.playerId === carrier.id)?.action === 'protect' ? 0.45 : 1;
        if (pressure < 0.72 && rng.next() < 0.08 * protectFactor) {
          turnovers += 1;
          turnoverToNearest(world, opposingTeam(carrier.team));
        }
      }
      world.timeSeconds += 0.1;
      world.tick += 3;
      if (ended) break;
    }

    if (passesThisPossession >= 2) multiPassPossessions += 1;
    if (clusteredTicks > ticks * 0.6) permanentSwarmPossessions += 1;
    possessionsCompleted += 1;
    checksum = mixChecksum(checksum, passesThisPossession + 17 * (world.possessionPlayerId?.charCodeAt(world.possessionPlayerId.length - 1) ?? 0));
    checksum = mixChecksum(checksum, rng.state);
  }

  return {
    version: 1,
    seed,
    possessionsRequested: possessions,
    possessionsCompleted,
    matchesCompleted: Math.ceil(possessions / 20),
    failures,
    passAttempts,
    completedPasses,
    multiPassPossessions,
    turnovers,
    shots,
    goals,
    roleSwitches,
    roleOccupancy,
    keeperAbandonments,
    permanentSwarmPossessions,
    clusterRatio: clusterSamples > 0 ? clusterHits / clusterSamples : 0,
    idleRatio: idleSamples > 0 ? idleHits / idleSamples : 0,
    averageSupportDistance: supportDistanceSamples > 0 ? supportDistanceSum / supportDistanceSamples : 0,
    averageDecisionMsPerTeam: timingSamples > 0 ? timingSum / timingSamples : 0,
    p99DecisionMsPerTeam: decisionTimingPercentile(decisionTimingHistogram, timingSamples, 0.99),
    maxDecisionMsPerTeam,
    checksum: checksum.toString(16).padStart(8, '0'),
  };
}

function parseCli(): TacticalTournamentOptions {
  let possessions = 5000;
  let seed = 0x51a6e006;
  for (const argument of process.argv.slice(2)) {
    if (argument.startsWith('--possessions=')) possessions = Number(argument.slice('--possessions='.length));
    if (argument.startsWith('--seed=')) seed = Number(argument.slice('--seed='.length));
  }
  return { possessions, seed };
}

if (process.argv[1]?.endsWith('tacticalTournament.ts')) {
  process.stdout.write(`${JSON.stringify(runTacticalTournament(parseCli()), null, 2)}\n`);
}