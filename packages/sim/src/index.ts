import { createPrng, nextUint32, type DeterministicPrng } from './prng';

export type SimTick = number;

export interface SimConfig {
  tickHz: number;
  seed: number;
}

export interface InputIntent {
  moveX: number;
  moveY: number;
  aimYaw: number;
  sprint: boolean;
  actionBits: number;
}

interface SimPlayerAccumulator {
  moveX: number;
  moveY: number;
  aimYaw: number;
  sprintTicks: number;
  actionMix: number;
  samples: number;
}

export interface Simulation {
  readonly config: Readonly<SimConfig>;
  tick: SimTick;
  readonly prng: DeterministicPrng;
  randomAccumulator: number;
  readonly players: Map<string, SimPlayerAccumulator>;
}

export interface InputTraceFrame {
  tick: SimTick;
  inputs: ReadonlyMap<string, InputIntent>;
}

const QUANTIZE = 1_000_000;
const TAU = Math.PI * 2;

function compareCodePoints(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

function requireTickHz(tickHz: number): number {
  if (!Number.isSafeInteger(tickHz) || tickHz <= 0 || tickHz > 1000) {
    throw new RangeError('tickHz must be a positive safe integer <= 1000');
  }
  return tickHz;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function requireFinite(value: number, field: string): number {
  if (!Number.isFinite(value)) throw new TypeError(`${field} must be finite`);
  return value;
}

function normalizeYaw(value: number): number {
  const finite = requireFinite(value, 'aimYaw');
  const wrapped = ((finite + Math.PI) % TAU + TAU) % TAU - Math.PI;
  return Object.is(wrapped, -0) ? 0 : wrapped;
}

function normalizeIntent(intent: InputIntent): InputIntent {
  if (typeof intent.sprint !== 'boolean') throw new TypeError('sprint must be boolean');
  if (!Number.isSafeInteger(intent.actionBits) || intent.actionBits < 0 || intent.actionBits > 0xffff_ffff) {
    throw new RangeError('actionBits must be an unsigned 32-bit integer');
  }
  return {
    moveX: clamp(requireFinite(intent.moveX, 'moveX'), -1, 1),
    moveY: clamp(requireFinite(intent.moveY, 'moveY'), -1, 1),
    aimYaw: normalizeYaw(intent.aimYaw),
    sprint: intent.sprint,
    actionBits: intent.actionBits >>> 0,
  };
}

function q(value: number): number {
  return Math.round(value * QUANTIZE);
}

function mix32(current: number, value: number): number {
  return (Math.imul(current ^ (value | 0), 0x45d9f3b) ^ 0x9e3779b9) >>> 0;
}

function getOrCreatePlayer(sim: Simulation, id: string): SimPlayerAccumulator {
  let player = sim.players.get(id);
  if (!player) {
    player = { moveX: 0, moveY: 0, aimYaw: 0, sprintTicks: 0, actionMix: 0, samples: 0 };
    sim.players.set(id, player);
  }
  return player;
}

export function createSimulation(config: SimConfig): Simulation {
  return {
    config: Object.freeze({ tickHz: requireTickHz(config.tickHz), seed: config.seed }),
    tick: 0,
    prng: createPrng(config.seed),
    randomAccumulator: 0,
    players: new Map(),
  };
}

export function stepSimulation(sim: Simulation, inputs: ReadonlyMap<string, InputIntent>): void {
  if (!(inputs instanceof Map)) throw new TypeError('inputs must be a ReadonlyMap');

  const random = nextUint32(sim.prng);
  sim.randomAccumulator = mix32(sim.randomAccumulator, random ^ sim.tick);

  const orderedIds = [...inputs.keys()].sort(compareCodePoints);
  for (const id of orderedIds) {
    if (typeof id !== 'string' || id.length === 0 || id.length > 64) {
      throw new TypeError('player id must be a non-empty string up to 64 characters');
    }
    const raw = inputs.get(id);
    if (!raw) continue;
    const intent = normalizeIntent(raw);
    const player = getOrCreatePlayer(sim, id);
    player.moveX = mix32(player.moveX, q(intent.moveX));
    player.moveY = mix32(player.moveY, q(intent.moveY));
    player.aimYaw = mix32(player.aimYaw, q(intent.aimYaw));
    if (intent.sprint) player.sprintTicks += 1;
    player.actionMix = mix32(player.actionMix, intent.actionBits);
    player.samples += 1;
  }

  sim.tick += 1;
}

export function getSimulationTick(sim: Simulation): SimTick {
  return sim.tick;
}

interface CanonicalState {
  version: 1;
  tickHz: number;
  seed: number;
  tick: number;
  rngState: number;
  randomAccumulator: number;
  players: Array<{
    id: string;
    moveX: number;
    moveY: number;
    aimYaw: number;
    sprintTicks: number;
    actionMix: number;
    samples: number;
  }>;
}

function canonicalState(sim: Simulation): CanonicalState {
  return {
    version: 1,
    tickHz: sim.config.tickHz,
    seed: sim.config.seed,
    tick: sim.tick,
    rngState: sim.prng.state >>> 0,
    randomAccumulator: sim.randomAccumulator >>> 0,
    players: [...sim.players.entries()]
      .sort(([a], [b]) => compareCodePoints(a, b))
      .map(([id, player]) => ({ id, ...player })),
  };
}

function fnv1a64(value: string): string {
  let hash = 0xcbf29ce484222325n;
  const prime = 0x100000001b3n;
  const mask = 0xffff_ffff_ffff_ffffn;
  const bytes = new TextEncoder().encode(value);
  for (const byte of bytes) {
    hash ^= BigInt(byte);
    hash = (hash * prime) & mask;
  }
  return hash.toString(16).padStart(16, '0');
}

export function hashSimulationState(sim: Simulation): string {
  return fnv1a64(JSON.stringify(canonicalState(sim)));
}

function canonicalIntent(intent: InputIntent): InputIntent {
  const normalized = normalizeIntent(intent);
  return {
    moveX: q(normalized.moveX) / QUANTIZE,
    moveY: q(normalized.moveY) / QUANTIZE,
    aimYaw: q(normalized.aimYaw) / QUANTIZE,
    sprint: normalized.sprint,
    actionBits: normalized.actionBits,
  };
}

export function serializeInputTrace(frames: readonly InputTraceFrame[]): string {
  const canonical = [...frames]
    .sort((a, b) => a.tick - b.tick)
    .map((frame) => ({
      tick: frame.tick,
      inputs: [...frame.inputs.entries()]
        .sort(([a], [b]) => compareCodePoints(a, b))
        .map(([id, intent]) => [id, canonicalIntent(intent)] as const),
    }));
  return JSON.stringify({ version: 1, frames: canonical });
}
