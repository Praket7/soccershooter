export type TeamId = 'home' | 'away';

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface BotPlayerSnapshot {
  id: string;
  team: TeamId;
  position: Vec3;
  velocity: Vec3;
  facingYaw: number;
  goalkeeper: boolean;
}

export interface BotBallSnapshot {
  position: Vec3;
  velocity: Vec3;
}

export interface BotFieldGeometry {
  halfWidth: number;
  halfLength: number;
  goalHalfWidth: number;
  /** Optional for legacy fixtures; regulation-size default is used when absent. */
  goalHeight?: number;
}

export type MatchPhase = 'live' | 'restart' | 'stopped';
export type RestartKind = 'none' | 'kickoff' | 'goal-kick' | 'throw-in' | 'corner' | 'free-kick';

export interface BotMatchState {
  phase: MatchPhase;
  restart: RestartKind;
  restartTeam: TeamId | null;
  scoreHome: number;
  scoreAway: number;
  secondsRemaining: number;
}

export interface BotWorldSnapshot {
  tick: number;
  timeSeconds: number;
  field: BotFieldGeometry;
  ball: BotBallSnapshot;
  players: BotPlayerSnapshot[];
  possessionTeam: TeamId | null;
  possessionPlayerId: string | null;
  /** Intended receiver of a currently traveling physical pass, if known. */
  passReceiverId?: string | null;
  matchState?: BotMatchState;
}

export type BotRole =
  | 'goalkeeper'
  | 'ball-carrier'
  | 'receiver'
  | 'immediate-support'
  | 'width-support'
  | 'presser'
  | 'cover-defender'
  | 'recovery-runner';

export type TeamPhase = 'attack' | 'defend' | 'loose';

export const DEFAULT_BOT_MATCH_STATE: Readonly<BotMatchState> = Object.freeze({
  phase: 'live',
  restart: 'none',
  restartTeam: null,
  scoreHome: 0,
  scoreAway: 0,
  secondsRemaining: 0,
});

export function resolvedMatchState(world: Readonly<BotWorldSnapshot>): Readonly<BotMatchState> {
  return world.matchState ?? DEFAULT_BOT_MATCH_STATE;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function clamp01(value: number): number {
  return clamp(value, 0, 1);
}

export function horizontalDistance(a: Readonly<Vec3>, b: Readonly<Vec3>): number {
  return Math.hypot(a.x - b.x, a.z - b.z);
}

export function horizontalSpeed(value: Readonly<Vec3>): number {
  return Math.hypot(value.x, value.z);
}

export function attackingDirection(team: TeamId): 1 | -1 {
  return team === 'home' ? 1 : -1;
}

export function ownGoalZ(world: Readonly<BotWorldSnapshot>, team: TeamId): number {
  return -attackingDirection(team) * world.field.halfLength;
}

export function opponentGoalZ(world: Readonly<BotWorldSnapshot>, team: TeamId): number {
  return attackingDirection(team) * world.field.halfLength;
}

export function phaseForTeam(world: Readonly<BotWorldSnapshot>, team: TeamId): TeamPhase {
  if (world.possessionTeam === team) return 'attack';
  if (world.passReceiverId) {
    const receiver = world.players.find((player) => player.id === world.passReceiverId);
    if (receiver) return receiver.team === team ? 'attack' : 'defend';
  }
  if (world.possessionTeam === null) return 'loose';
  return 'defend';
}

export function findPlayer(world: Readonly<BotWorldSnapshot>, playerId: string): BotPlayerSnapshot {
  const player = world.players.find((candidate) => candidate.id === playerId);
  if (!player) throw new RangeError(`Unknown bot player: ${playerId}`);
  return player;
}

export function teamPlayers(world: Readonly<BotWorldSnapshot>, team: TeamId): BotPlayerSnapshot[] {
  return world.players.filter((player) => player.team === team).sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
}

export function opponentsOf(world: Readonly<BotWorldSnapshot>, team: TeamId): BotPlayerSnapshot[] {
  return world.players.filter((player) => player.team !== team).sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
}

export function normalizeHorizontal(value: Pick<Vec3, 'x' | 'z'>): { x: number; z: number } {
  const length = Math.hypot(value.x, value.z);
  if (length <= 1e-9) return { x: 0, z: 1 };
  return { x: value.x / length, z: value.z / length };
}

export function dotHorizontal(a: Pick<Vec3, 'x' | 'z'>, b: Pick<Vec3, 'x' | 'z'>): number {
  const left = normalizeHorizontal(a);
  const right = normalizeHorizontal(b);
  return clamp(left.x * right.x + left.z * right.z, -1, 1);
}

export function facingDirection(yaw: number): { x: number; z: number } {
  return { x: Math.sin(yaw), z: Math.cos(yaw) };
}

export function fieldClamp(world: Readonly<BotWorldSnapshot>, point: Readonly<Vec3>, margin = 0.65): Vec3 {
  return {
    x: clamp(point.x, -world.field.halfWidth + margin, world.field.halfWidth - margin),
    y: 0,
    z: clamp(point.z, -world.field.halfLength + margin, world.field.halfLength - margin),
  };
}

export function lerpVec3(a: Readonly<Vec3>, b: Readonly<Vec3>, t: number): Vec3 {
  const amount = clamp01(t);
  return {
    x: a.x + (b.x - a.x) * amount,
    y: a.y + (b.y - a.y) * amount,
    z: a.z + (b.z - a.z) * amount,
  };
}
