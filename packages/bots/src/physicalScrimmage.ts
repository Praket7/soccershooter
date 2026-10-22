import { BALL_CONSTANTS, cloneBallState, createBallState, type BallState } from '../../physics/src/ball/BallState';
import { MATCH_BALL_PROFILE } from '../../physics/src/ball/aerodynamics';
import { BALL_SUBSTEP_DT, stepBall } from '../../physics/src/ball/trajectory';
import { buildControlTouch } from '../../sim/src/football/controlEnvelope';
import {
  createDefenderActionState,
  resolveChallenge,
  stepDefenderActionState,
  type DefenderActionState,
} from '../../sim/src/football/defending';
import { solvePass, type PassType } from '../../sim/src/football/passing';
import { buildShot, type ShotStyle } from '../../sim/src/football/shooting';
import {
  applyBallContact,
  normalizeHorizontal as normalizeFootballHorizontal,
  type BallContactCommand,
  type FootballActorSnapshot,
  type FootballBallSnapshot,
} from '../../sim/src/football/types';
import { createPlayerState, type PlayerState } from '../../sim/src/player/PlayerState';
import { DEFAULT_MOVEMENT_CONFIG, stepPlayerMovement, type MovementWorld } from '../../sim/src/player/movement';
import { physicalDifficultySnapshot, type BotDifficultyTier, type PhysicalDifficultySnapshot } from './difficulty';
import { createTeamBotRuntime, stepTeamBotRuntime, type TeamBotIntent, type TeamBotRuntimeState } from './runtime';
import type { TeamPlaystyle } from './runtime';
import type { BotPersonalityId } from './personalities';
import type { BotPlayerSnapshot, BotWorldSnapshot, TeamId, Vec3 } from './types';

export function chooseShotTargetX(
  shooter: Readonly<Vec3>,
  goalZ: number,
  goalHalfWidth: number,
  opponents: readonly Pick<BotPlayerSnapshot, 'goalkeeper' | 'position' | 'velocity'>[],
): number {
  const distance = Math.hypot(shooter.x, goalZ - shooter.z);
  const flightTime = Math.min(0.75, distance / 24);
  const goalkeeper = opponents.find((opponent) => opponent.goalkeeper);
  const defenders = opponents.filter((opponent) => !opponent.goalkeeper);
  const fractions = [-0.92, -0.56, -0.28, 0, 0.28, 0.56, 0.92];
  return fractions.map((fraction) => {
    const targetX = fraction * goalHalfWidth;
    let laneClearance = 5;
    for (const defender of defenders) {
      const projectedX = defender.position.x + defender.velocity.x * flightTime * 0.5;
      const projectedZ = defender.position.z + defender.velocity.z * flightTime * 0.5;
      const dx = targetX - shooter.x;
      const dz = goalZ - shooter.z;
      const lengthSquared = dx * dx + dz * dz || 1;
      const t = Math.max(0, Math.min(1, ((projectedX - shooter.x) * dx + (projectedZ - shooter.z) * dz) / lengthSquared));
      laneClearance = Math.min(laneClearance, Math.hypot(projectedX - (shooter.x + dx * t), projectedZ - (shooter.z + dz * t)));
    }
    const blockerScore = Math.min(1, laneClearance / 1.8);
    const keeperX = goalkeeper ? goalkeeper.position.x + goalkeeper.velocity.x * flightTime : Number.POSITIVE_INFINITY;
    const keeperZ = goalkeeper ? goalkeeper.position.z + goalkeeper.velocity.z * flightTime : goalZ;
    const keeperCoversLine = goalkeeper && Math.abs(goalZ - keeperZ) < 5.5;
    const keeperReach = goalkeeper ? 1.25 + Math.min(0.55, Math.abs(goalkeeper.velocity.x) * flightTime * 0.45) : 0;
    const keeperScore = keeperCoversLine
      ? Math.min(1, Math.abs(targetX - keeperX) / (Math.max(1, goalHalfWidth) + keeperReach))
      : 1;
    const angleCost = Math.abs(Math.atan2(targetX - shooter.x, goalZ - shooter.z));
    const score = keeperScore * 0.57 + blockerScore * 0.34 - angleCost * 0.10;
    return { targetX, score };
  }).sort((left, right) => right.score - left.score || left.targetX - right.targetX)[0]!.targetX;
}

export interface PhysicalScrimmagePlayer extends PlayerState {
  id: string;
  team: TeamId;
  goalkeeper: boolean;
}

export interface PhysicalContactEvent {
  tick: number;
  playerId: string;
  kind: BallContactCommand['kind'];
  diagnostic: string;
}

export interface PhysicalScrimmageState {
  seed: number;
  tick: number;
  timeSeconds: number;
  field: BotWorldSnapshot['field'];
  ball: BallState;
  players: PhysicalScrimmagePlayer[];
  possessionTeam: TeamId | null;
  possessionPlayerId: string | null;
  passReceiverId: string | null;
  passReceiverExpiresAtTick: number;
  homeRuntime: TeamBotRuntimeState;
  awayRuntime: TeamBotRuntimeState;
  touchCooldowns: Record<string, number>;
  defenderStates: Record<string, DefenderActionState>;
  contactCount: number;
  looseBallTicks: number;
  possessionChanges: number;
  score: Record<TeamId, number>;
  restartCount: number;
  lastEvent: string;
  recentContacts: PhysicalContactEvent[];
  checksum: string;
}

export interface HumanScrimmageInput {
  playerId: string;
  moveX: number;
  moveY: number;
  aimYaw: number;
  sprint: boolean;
  action: 'carry' | 'pass' | 'shoot' | 'challenge';
  targetPlayerId?: string | null;
}

export interface TeamBotDifficultySelection {
  home: BotDifficultyTier;
  away: BotDifficultyTier;
}

const MOVEMENT_DT = 1 / 60;
const MAX_RECENT_CONTACTS = 16;
const CONTROL_DISTANCE = 1.32;
// A controlled ball may move ahead of a sprinting player between touch frames.
// Keep ownership while that contact remains locally playable; control-envelope
// eligibility and actual shot/pass contacts still decide what the player can do.
const POSSESSION_DISTANCE = 1.42;
const POSSESSION_RELATIVE_SPEED = 7.2;
const FIELD = Object.freeze({ halfWidth: 12, halfLength: 18, goalHalfWidth: 3.66 });
const MOVEMENT_WORLD: MovementWorld = Object.freeze({
  bounds: Object.freeze({ minX: -FIELD.halfWidth, maxX: FIELD.halfWidth, minZ: -FIELD.halfLength, maxZ: FIELD.halfLength }),
  obstacles: Object.freeze([]),
  ground: Object.freeze([]),
});

function makePlayer(id: string, team: TeamId, x: number, z: number, goalkeeper = false): PhysicalScrimmagePlayer {
  return {
    id,
    team,
    goalkeeper,
    ...createPlayerState({
      position: { x, y: 0, z },
      facingYaw: team === 'home' ? 0 : Math.PI,
      stamina: DEFAULT_MOVEMENT_CONFIG.staminaMax,
      grounded: true,
      groundHeight: 0,
    }),
  };
}

function clonePlayer(player: Readonly<PhysicalScrimmagePlayer>): PhysicalScrimmagePlayer {
  return {
    ...player,
    position: { ...player.position },
    velocity: { ...player.velocity },
    actionHooks: { ...player.actionHooks },
  };
}

function botSnapshot(player: Readonly<PhysicalScrimmagePlayer>): BotPlayerSnapshot {
  return {
    id: player.id,
    team: player.team,
    goalkeeper: player.goalkeeper,
    position: { ...player.position },
    velocity: { ...player.velocity },
    facingYaw: player.facingYaw,
  };
}

function worldSnapshot(state: Readonly<PhysicalScrimmageState>): BotWorldSnapshot {
  return {
    tick: state.tick,
    timeSeconds: state.timeSeconds,
    field: { ...state.field },
    ball: { position: { ...state.ball.position }, velocity: { ...state.ball.velocity } },
    players: state.players.map(botSnapshot),
    possessionTeam: state.possessionTeam,
    possessionPlayerId: state.possessionPlayerId,
    passReceiverId: state.passReceiverId,
  };
}

function footballBall(ball: Readonly<BallState>): FootballBallSnapshot {
  return {
    position: { ...ball.position },
    velocity: { ...ball.velocity },
    angularVelocity: { ...ball.angularVelocity },
    radius: BALL_CONSTANTS.radius,
    mass: BALL_CONSTANTS.mass,
    grounded: ball.grounded,
  };
}

function nearestOpponentDistance(state: Readonly<PhysicalScrimmageState>, player: Readonly<PhysicalScrimmagePlayer>): number {
  let nearest = Number.POSITIVE_INFINITY;
  for (const opponent of state.players) {
    if (opponent.team === player.team) continue;
    nearest = Math.min(nearest, Math.hypot(opponent.position.x - player.position.x, opponent.position.z - player.position.z));
  }
  return nearest;
}

function actorSnapshot(state: Readonly<PhysicalScrimmageState>, player: Readonly<PhysicalScrimmagePlayer>): FootballActorSnapshot {
  const nearestOpponent = nearestOpponentDistance(state, player);
  const pressure = Math.max(0, Math.min(1, (3 - nearestOpponent) / 3));
  const speed = Math.hypot(player.velocity.x, player.velocity.z);
  const balance = player.locomotion === 'sharp-cut' ? 0.7 : Math.max(0.72, 1 - Math.max(0, speed - 5.2) * 0.035);
  return {
    position: { ...player.position },
    velocity: { ...player.velocity },
    facingYaw: player.facingYaw,
    balance,
    pressure,
    sprinting: player.locomotion === 'sprint',
    preferredFoot: 'right',
  };
}

function applyContactToBall(ball: Readonly<BallState>, command: Readonly<BallContactCommand>): BallState {
  const contacted = applyBallContact(footballBall(ball), command);
  const next = cloneBallState(ball);
  next.velocity = { ...contacted.velocity };
  next.angularVelocity = { ...contacted.angularVelocity };
  if (next.velocity.y > 0.04) next.grounded = false;
  return next;
}

function worldMoveToInput(worldX: number, worldZ: number, aimYaw: number): { x: number; y: number } {
  const sin = Math.sin(aimYaw);
  const cos = Math.cos(aimYaw);
  return {
    x: -cos * worldX + sin * worldZ,
    y: sin * worldX + cos * worldZ,
  };
}

function movePlayers(
  players: readonly PhysicalScrimmagePlayer[],
  intents: ReadonlyMap<string, TeamBotIntent>,
  deltaSeconds: number,
): PhysicalScrimmagePlayer[] {
  let next = players.map(clonePlayer);
  let remaining = deltaSeconds;
  while (remaining > 1e-9) {
    const dt = Math.min(MOVEMENT_DT, remaining);
    next = next.map((player) => {
      const intent = intents.get(player.id);
      if (!intent) return player;
      const axes = worldMoveToInput(intent.moveX, intent.moveY, intent.aimYaw);
      const stepped = stepPlayerMovement(player, {
        moveX: axes.x,
        moveY: axes.y,
        aimYaw: intent.aimYaw,
        sprint: intent.sprint,
        actionBits: 0,
      }, MOVEMENT_WORLD, dt);
      return { ...player, ...stepped, position: { ...stepped.position }, velocity: { ...stepped.velocity }, actionHooks: { ...stepped.actionHooks } };
    });
    remaining -= dt;
  }
  return next;
}

function passTypeForTechnique(technique: string | null | undefined): PassType {
  if (technique === 'driven-pass') return 'driven';
  if (technique === 'lofted-pass') return 'lofted';
  if (technique === 'through-pass') return 'through';
  return 'ground';
}

function shotStyleForTechnique(technique: string | null | undefined): ShotStyle {
  if (technique === 'finesse-shot') return 'finesse';
  if (technique === 'chip-shot') return 'chip';
  if (technique === 'driven-shot') return 'driven';
  if (technique === 'knuckle-shot') return 'knuckle';
  if (technique === 'outside-foot-shot') return 'outside-foot';
  return 'normal';
}

function recordContact(
  state: PhysicalScrimmageState,
  playerId: string,
  command: Readonly<BallContactCommand>,
): void {
  state.ball = applyContactToBall(state.ball, command);
  state.contactCount += 1;
  state.lastEvent = `${command.kind}:${playerId}`;
  state.recentContacts = [
    ...state.recentContacts,
    { tick: state.tick, playerId, kind: command.kind, diagnostic: command.diagnostic },
  ].slice(-MAX_RECENT_CONTACTS);
}

function tryCarrierAction(
  state: PhysicalScrimmageState,
  intent: Readonly<TeamBotIntent>,
): boolean {
  if (state.possessionPlayerId !== intent.playerId) return false;
  const player = state.players.find((candidate) => candidate.id === intent.playerId);
  if (!player) return false;
  const ball = footballBall(state.ball);
  const actor = actorSnapshot(state, player);

  if ((intent.action === 'pass' || intent.action === 'distribute') && intent.targetPlayerId) {
    const target = state.players.find((candidate) => candidate.id === intent.targetPlayerId && candidate.team === player.team);
    if (!target) return false;
    const aim = normalizeFootballHorizontal({ x: target.position.x - player.position.x, z: target.position.z - player.position.z });
    const pass = solvePass({
      type: passTypeForTechnique(intent.technique),
      passer: actor,
      ball,
      receiver: { position: { ...target.position }, velocity: { ...target.velocity } },
      userAim: aim,
      assist: 0.58,
      pressure: actor.pressure,
      allowBehindBodyTechnique: false,
    });
    if (pass.command) {
      recordContact(state, player.id, pass.command);
      state.touchCooldowns[player.id] = 0.16;
      state.possessionTeam = null;
      state.possessionPlayerId = null;
      state.passReceiverId = target.id;
      state.passReceiverExpiresAtTick = state.tick + 75;
      return true;
    }
  }

  if (intent.action === 'shoot') {
    const goalZ = player.team === 'home' ? state.field.halfLength : -state.field.halfLength;
    const opponents = state.players.filter((candidate) => candidate.team !== player.team);
    const selectedTarget = { x: chooseShotTargetX(player.position, goalZ, state.field.goalHalfWidth, opponents), y: 1.15, z: goalZ };
    const aim = normalizeFootballHorizontal({ x: selectedTarget.x - player.position.x, z: goalZ - player.position.z });
    const shot = buildShot({
      style: shotStyleForTechnique(intent.technique),
      shooter: actor,
      ball,
      aim,
      charge: 0.72,
      spinInput: 0.6,
      pressure: actor.pressure,
      balance: actor.balance,
      contactFoot: 'right',
      knuckleSeed: (state.seed ^ state.tick) >>> 0,
    });
    if (shot.command) {
      recordContact(state, player.id, shot.command);
      state.ball.knuckleSeed = shot.knuckleSeed;
      state.touchCooldowns[player.id] = 0.2;
      state.possessionTeam = null;
      state.possessionPlayerId = null;
      state.passReceiverId = null;
      return true;
    }
  }

  if (intent.action === 'clear') {
    const direction = player.team === 'home' ? 1 : -1;
    const aim = { x: 0, z: direction };
    const pass = solvePass({
      type: 'lofted',
      passer: actor,
      ball,
      receiver: {
        position: { x: 0, y: 0, z: direction * (state.field.halfLength - 1) },
        velocity: { x: 0, y: 0, z: 0 },
      },
      userAim: aim,
      assist: 0,
      pressure: actor.pressure,
      allowBehindBodyTechnique: true,
    });
    if (pass.command) {
      recordContact(state, player.id, pass.command);
      state.touchCooldowns[player.id] = 0.18;
      state.possessionTeam = null;
      state.possessionPlayerId = null;
      state.passReceiverId = null;
      state.passReceiverExpiresAtTick = 0;
      return true;
    }
  }

  return false;
}

function tryChallenge(
  state: PhysicalScrimmageState,
  intent: Readonly<TeamBotIntent>,
): boolean {
  if (intent.action !== 'intercept' && intent.action !== 'press') return false;
  if (!state.possessionPlayerId) return false;
  const defender = state.players.find((candidate) => candidate.id === intent.playerId);
  const carrier = state.players.find((candidate) => candidate.id === state.possessionPlayerId);
  if (!defender || !carrier || defender.team === carrier.team) return false;
  const distance = Math.hypot(defender.position.x - state.ball.position.x, defender.position.z - state.ball.position.z);
  // Tactical pressure is already represented by movement toward the carrier.
  // Require an actual close approach before converting that pressure into a
  // standing tackle, otherwise 3v3 collapses into constant ankle-range contacts.
  if (distance > 1.08) return false;
  const current = state.defenderStates[defender.id] ?? createDefenderActionState();
  const challenge = resolveChallenge({
    kind: 'standing',
    state: current,
    defender: actorSnapshot(state, defender),
    ball: footballBall(state.ball),
    opponentPosition: { ...carrier.position },
  });
  state.defenderStates[defender.id] = challenge.nextState;
  if (challenge.command) {
    recordContact(state, defender.id, challenge.command);
    state.touchCooldowns[defender.id] = 0.16;
    return true;
  }
  return false;
}

function tryControlTouch(state: PhysicalScrimmageState, intents: ReadonlyMap<string, TeamBotIntent>): boolean {
  const ordered = [...state.players].sort((left, right) => {
    const leftPriority = left.id === state.possessionPlayerId ? -1 : 0;
    const rightPriority = right.id === state.possessionPlayerId ? -1 : 0;
    if (leftPriority !== rightPriority) return leftPriority - rightPriority;
    const ld = Math.hypot(left.position.x - state.ball.position.x, left.position.z - state.ball.position.z);
    const rd = Math.hypot(right.position.x - state.ball.position.x, right.position.z - state.ball.position.z);
    return ld - rd || left.id.localeCompare(right.id);
  });

  for (const player of ordered) {
    if (player.goalkeeper) continue;
    if ((state.touchCooldowns[player.id] ?? 0) > 0) continue;
    const distance = Math.hypot(player.position.x - state.ball.position.x, player.position.z - state.ball.position.z);
    if (distance > CONTROL_DISTANCE) continue;
    const intent = intents.get(player.id);
    if (!intent) continue;
    const desired = normalizeFootballHorizontal(
      { x: intent.moveX, z: intent.moveY },
      { x: Math.sin(player.facingYaw), z: Math.cos(player.facingYaw) },
    );
    const precision = intent.action === 'protect' || intent.technique === 'controlled-dribble';
    const touch = buildControlTouch({
      actor: actorSnapshot(state, player),
      ball: footballBall(state.ball),
      desiredDirection: desired,
      precision,
      sprint: intent.sprint,
      pressure: actorSnapshot(state, player).pressure,
      moveIntentMagnitude: Math.hypot(intent.moveX, intent.moveY),
    });
    if (!touch.eligible || !touch.command) continue;
    recordContact(state, player.id, touch.command);
    state.touchCooldowns[player.id] = touch.touchMode === 'effort-turn' ? 0.08 : touch.touchMode === 'precision' ? 0.1 : intent.sprint ? 0.14 : 0.12;
    return true;
  }
  return false;
}

function tryGoalkeeperCollection(state: PhysicalScrimmageState): boolean {
  if (state.possessionPlayerId !== null) return false;
  for (const goalkeeper of state.players) {
    if (!goalkeeper.goalkeeper) continue;
    const distance = Math.hypot(goalkeeper.position.x - state.ball.position.x, goalkeeper.position.z - state.ball.position.z);
    const speed = Math.hypot(state.ball.velocity.x, state.ball.velocity.z);
    if (distance > 1.4 || state.ball.position.y > 1.25 || speed > 9.5) continue;
    const attackDirection = goalkeeper.team === 'home' ? 1 : -1;
    state.ball.position = { x: goalkeeper.position.x, y: BALL_CONSTANTS.radius, z: goalkeeper.position.z + attackDirection * 0.4 };
    state.ball.velocity = { x: 0, y: 0, z: 0 };
    state.ball.angularVelocity = { x: 0, y: 0, z: 0 };
    state.ball.grounded = true;
    state.possessionTeam = goalkeeper.team;
    state.possessionPlayerId = goalkeeper.id;
    state.lastEvent = `claim:${goalkeeper.id}`;
    return true;
  }
  return false;
}

function stepBallPhysics(ball: Readonly<BallState>, deltaSeconds: number): BallState {
  let next = cloneBallState(ball);
  let remaining = deltaSeconds;
  while (remaining > 1e-9) {
    const dt = Math.min(BALL_SUBSTEP_DT, remaining);
    next = stepBall(next, dt, MATCH_BALL_PROFILE, null);
    remaining -= dt;
  }
  return next;
}

function inferPossession(state: Readonly<PhysicalScrimmageState>): { team: TeamId | null; playerId: string | null } {
  if (state.ball.position.y - BALL_CONSTANTS.radius > 0.5) return { team: null, playerId: null };
  let best: { player: PhysicalScrimmagePlayer; distance: number; relativeSpeed: number } | null = null;
  for (const player of state.players) {
    if (player.goalkeeper) continue;
    const distance = Math.hypot(player.position.x - state.ball.position.x, player.position.z - state.ball.position.z);
    if (distance > POSSESSION_DISTANCE) continue;
    const toBallX = state.ball.position.x - player.position.x;
    const toBallZ = state.ball.position.z - player.position.z;
    const forwardProjection = toBallX * Math.sin(player.facingYaw) + toBallZ * Math.cos(player.facingYaw);
    if (forwardProjection < -0.05) continue;
    const relativeSpeed = Math.hypot(player.velocity.x - state.ball.velocity.x, player.velocity.z - state.ball.velocity.z);
    if (relativeSpeed > POSSESSION_RELATIVE_SPEED) continue;
    if (!best || distance < best.distance || (distance === best.distance && player.id < best.player.id)) {
      best = { player, distance, relativeSpeed };
    }
  }
  const incumbent = state.possessionPlayerId
    ? state.players.find((player) => player.id === state.possessionPlayerId)
    : null;
  if (incumbent?.goalkeeper) {
    const keeperDistance = Math.hypot(incumbent.position.x - state.ball.position.x, incumbent.position.z - state.ball.position.z);
    const ballSpeed = Math.hypot(state.ball.velocity.x, state.ball.velocity.z);
    if (keeperDistance <= 1.25 && ballSpeed <= 1.2) return { team: incumbent.team, playerId: incumbent.id };
  }
  if (incumbent && best && best.player.id !== incumbent.id) {
    const incumbentDistance = Math.hypot(incumbent.position.x - state.ball.position.x, incumbent.position.z - state.ball.position.z);
    const incumbentRelativeSpeed = Math.hypot(incumbent.velocity.x - state.ball.velocity.x, incumbent.velocity.z - state.ball.velocity.z);
    const incumbentStillPlayable = incumbentDistance <= 1.5 && incumbentRelativeSpeed <= 8;
    const challengerClearlyWins = best.distance + 0.9 < incumbentDistance
      || (best.player.team !== incumbent.team && best.distance < 0.58);
    if (incumbentStillPlayable && !challengerClearlyWins) return { team: incumbent.team, playerId: incumbent.id };
  }
  return best ? { team: best.player.team, playerId: best.player.id } : { team: null, playerId: null };
}

function resolveGoalkeeperSave(
  state: PhysicalScrimmageState,
  previousBall: Readonly<BallState>,
  intents: ReadonlyMap<string, TeamBotIntent>,
): boolean {
  const recentShot = [...state.recentContacts].reverse().find((contact) => contact.kind === 'shot');
  if (!recentShot || state.tick - recentShot.tick > 90) return false;
  for (const goalkeeper of state.players) {
    if (!goalkeeper.goalkeeper) continue;
    const intent = intents.get(goalkeeper.id);
    if (!intent) continue;
    const attackDirection = goalkeeper.team === 'home' ? 1 : -1;
    const goalZ = -attackDirection * state.field.halfLength;
    const savePlane = goalZ + attackDirection * 1.05;
    const before = (previousBall.position.z - savePlane) * attackDirection;
    const after = (state.ball.position.z - savePlane) * attackDirection;
    if (before < -1e-6 || after > 1e-6 || before - after < 1e-9) continue;

    const t = Math.max(0, Math.min(1, before / (before - after)));
    const crossingX = previousBall.position.x + (state.ball.position.x - previousBall.position.x) * t;
    const crossingY = previousBall.position.y + (state.ball.position.y - previousBall.position.y) * t;
    const dive = intent.action === 'dive';
    // The keeper's movement target already tracks the projected crossing, so
    // this is only the final hand/body extension beyond that position. Treating
    // a dive as an extra 2.15 m on top of the movement target made post-bound
    // shots unrealistically saveable and erased good shooting angles.
    const reach = dive ? 2.05 : 0.9;
    const heightReach = dive ? 2.25 : 1.72;
    const lateralDistance = Math.abs(crossingX - goalkeeper.position.x);
    if (lateralDistance > reach || crossingY > heightReach || crossingY < 0) continue;

    const caughtCleanly = lateralDistance < (dive ? 1.55 : 0.65) && crossingY < 1.35;
    const incomingSpeed = Math.hypot(state.ball.velocity.x, state.ball.velocity.z);
    if (caughtCleanly) {
      state.ball.position = { x: goalkeeper.position.x, y: BALL_CONSTANTS.radius, z: savePlane + attackDirection * 0.12 };
      state.ball.velocity = { x: 0, y: 0, z: 0 };
      state.ball.angularVelocity = { x: 0, y: 0, z: 0 };
      state.ball.grounded = true;
      state.possessionTeam = goalkeeper.team;
      state.possessionPlayerId = goalkeeper.id;
      state.lastEvent = `save:${goalkeeper.id}:catch`;
      return true;
    }
    const side = Math.sign(crossingX - goalkeeper.position.x) || (state.ball.velocity.x >= 0 ? -1 : 1);
    state.ball.position = {
      x: crossingX,
      y: Math.max(BALL_CONSTANTS.radius, crossingY + (dive ? 0.28 : 0.12)),
      z: savePlane + attackDirection * 0.12,
    };
    state.ball.velocity = {
      x: side * Math.max(2.8, incomingSpeed * (dive ? 0.28 : 0.16)),
      y: Math.max(1.8, incomingSpeed * (dive ? 0.22 : 0.12)),
      z: attackDirection * Math.max(5.2, incomingSpeed * (dive ? 0.42 : 0.30)),
    };
    state.ball.grounded = false;
    state.possessionTeam = null;
    state.possessionPlayerId = null;
    state.lastEvent = `save:${goalkeeper.id}:${dive ? 'dive' : 'parry'}`;
    return true;
  }
  return false;
}

function quantize(value: number): number {
  return Math.round(value * 10000);
}

function mix(hash: number, value: number): number {
  let next = (hash ^ (value >>> 0)) >>> 0;
  next = Math.imul(next, 16777619) >>> 0;
  return next;
}

function checksum(state: Readonly<PhysicalScrimmageState>): string {
  let hash = 2166136261 >>> 0;
  hash = mix(hash, state.tick);
  for (const value of [state.ball.position.x, state.ball.position.y, state.ball.position.z, state.ball.velocity.x, state.ball.velocity.y, state.ball.velocity.z]) hash = mix(hash, quantize(value));
  for (const player of [...state.players].sort((a, b) => a.id.localeCompare(b.id))) {
    for (const value of [player.position.x, player.position.z, player.velocity.x, player.velocity.z, player.facingYaw]) hash = mix(hash, quantize(value));
  }
  hash = mix(hash, state.contactCount);
  hash = mix(hash, state.looseBallTicks);
  hash = mix(hash, state.score.home);
  hash = mix(hash, state.score.away);
  hash = mix(hash, state.restartCount);
  return hash.toString(16).padStart(8, '0');
}

export function getPhysicalDifficultySnapshot(tier: BotDifficultyTier): PhysicalDifficultySnapshot {
  return physicalDifficultySnapshot(tier);
}

export function createPhysicalScrimmage(seed = 0x507a11, kickoffTeam: TeamId = 'home'): PhysicalScrimmageState {
  const players = [
    makePlayer('h-gk', 'home', 0, -16.2, true),
    makePlayer('h-1', 'home', -1.4, -4),
    makePlayer('h-2', 'home', 4.2, -1.5),
    makePlayer('a-gk', 'away', 0, 16.2, true),
    makePlayer('a-1', 'away', 1.5, 4),
    makePlayer('a-2', 'away', -4.1, 1.8),
  ];
  const state: PhysicalScrimmageState = {
    seed: seed >>> 0,
    tick: 0,
    timeSeconds: 0,
    field: { ...FIELD },
    ball: createBallState({ position: kickoffTeam === 'home'
      ? { x: -1.4, y: BALL_CONSTANTS.radius, z: -3.15 }
      : { x: 1.5, y: BALL_CONSTANTS.radius, z: 3.15 }, grounded: true }),
    players,
    possessionTeam: kickoffTeam,
    possessionPlayerId: kickoffTeam === 'home' ? 'h-1' : 'a-1',
    passReceiverId: null,
    passReceiverExpiresAtTick: 0,
    homeRuntime: createTeamBotRuntime(),
    awayRuntime: createTeamBotRuntime(),
    touchCooldowns: Object.fromEntries(players.map((player) => [player.id, 0])),
    defenderStates: Object.fromEntries(players.map((player) => [player.id, createDefenderActionState()])),
    contactCount: 0,
    looseBallTicks: 0,
    possessionChanges: 0,
    score: { home: 0, away: 0 },
    restartCount: 0,
    lastEvent: 'scrimmage-ready',
    recentContacts: [],
    checksum: '',
  };
  state.checksum = checksum(state);
  return state;
}

export function stepPhysicalScrimmage(
  previous: Readonly<PhysicalScrimmageState>,
  deltaSeconds: number,
  tier: BotDifficultyTier = 'standard',
  personalitiesByPlayerId: Readonly<Record<string, BotPersonalityId>> = {},
  humanInput?: Readonly<HumanScrimmageInput>,
  playstyles: Readonly<Record<TeamId, TeamPlaystyle>> = { home: 'balanced', away: 'balanced' },
  teamTiers: Readonly<TeamBotDifficultySelection> = { home: tier, away: tier },
): PhysicalScrimmageState {
  if (!Number.isFinite(deltaSeconds) || deltaSeconds <= 0 || deltaSeconds > 0.1) throw new RangeError('deltaSeconds must be in (0, 0.1]');
  const state: PhysicalScrimmageState = {
    ...previous,
    tick: previous.tick + 1,
    timeSeconds: previous.timeSeconds + deltaSeconds,
    field: { ...previous.field },
    ball: cloneBallState(previous.ball),
    players: previous.players.map(clonePlayer),
    touchCooldowns: { ...previous.touchCooldowns },
    defenderStates: Object.fromEntries(Object.entries(previous.defenderStates).map(([id, value]) => [id, { ...value }])),
    recentContacts: previous.recentContacts.map((event) => ({ ...event })),
  };
  for (const id of Object.keys(state.touchCooldowns)) state.touchCooldowns[id] = Math.max(0, (state.touchCooldowns[id] ?? 0) - deltaSeconds);
  for (const id of Object.keys(state.defenderStates)) state.defenderStates[id] = stepDefenderActionState(state.defenderStates[id]!, deltaSeconds);

  if (state.passReceiverId && (state.tick > state.passReceiverExpiresAtTick
    || (state.possessionPlayerId !== null && state.possessionPlayerId !== state.passReceiverId))) {
    state.passReceiverId = null;
    state.passReceiverExpiresAtTick = 0;
  }

  const world = worldSnapshot(state);
  const home = stepTeamBotRuntime(world, 'home', state.homeRuntime, { tier: teamTiers.home, seed: state.seed ^ 0x11111111, personalitiesByPlayerId, playstyle: playstyles.home });
  const away = stepTeamBotRuntime(world, 'away', state.awayRuntime, { tier: teamTiers.away, seed: state.seed ^ 0x22222222, personalitiesByPlayerId, playstyle: playstyles.away });
  state.homeRuntime = home.state;
  state.awayRuntime = away.state;
  const intents = new Map<string, TeamBotIntent>([...home.intents, ...away.intents].map((intent) => [intent.playerId, intent]));
  if (humanInput) {
    const botIntent = intents.get(humanInput.playerId);
    const player = state.players.find((candidate) => candidate.id === humanInput.playerId);
    if (botIntent && player && !player.goalkeeper) {
      const axis = (value: number) => Number.isFinite(value) ? Math.max(-1, Math.min(1, value)) : 0;
      intents.set(humanInput.playerId, {
        ...botIntent,
        moveX: axis(humanInput.moveX),
        moveY: axis(humanInput.moveY),
        aimYaw: Number.isFinite(humanInput.aimYaw) ? humanInput.aimYaw : player.facingYaw,
        sprint: humanInput.sprint,
        action: humanInput.action === 'challenge' ? 'intercept' : humanInput.action,
        targetPlayerId: humanInput.action === 'pass' ? humanInput.targetPlayerId ?? null : null,
        technique: null,
      });
    }
  }
  let contacted = false;
  // Start an already-ready shot at the current contact point before movement
  // advances the carrier past the free ball. Movement still runs this tick,
  // so the shooter can strike while moving instead of freezing to shoot.
  if (state.possessionPlayerId) {
    const carrierIntent = intents.get(state.possessionPlayerId);
    if (carrierIntent?.action === 'shoot' && (state.touchCooldowns[carrierIntent.playerId] ?? 0) <= 0) {
      contacted = tryCarrierAction(state, carrierIntent);
    }
  }

  state.players = movePlayers(state.players, intents, deltaSeconds);

  tryGoalkeeperCollection(state);

  if (state.possessionPlayerId) {
    const carrierIntent = intents.get(state.possessionPlayerId);
    if (!contacted && carrierIntent && (state.touchCooldowns[carrierIntent.playerId] ?? 0) <= 0) contacted = tryCarrierAction(state, carrierIntent);
  }
  if (!contacted) {
    for (const intent of [...intents.values()].sort((a, b) => a.playerId.localeCompare(b.playerId))) {
      if (tryChallenge(state, intent)) { contacted = true; break; }
    }
  }
  if (!contacted) tryControlTouch(state, intents);

  const previousBall = cloneBallState(state.ball);
  state.ball = stepBallPhysics(state.ball, deltaSeconds);
  const goalkeeperSaved = resolveGoalkeeperSave(state, previousBall, intents);
  let restarted = false;
  const crossedEndLine = Math.abs(state.ball.position.z) > state.field.halfLength;
  const scored = crossedEndLine
    && Math.abs(state.ball.position.x) <= state.field.goalHalfWidth - BALL_CONSTANTS.radius
    && state.ball.position.y <= 2.44;
  const outOfBounds = Math.abs(state.ball.position.x) > state.field.halfWidth
    || crossedEndLine;
  if (scored || outOfBounds) {
    let restartTeam: TeamId;
    if (scored) {
      const scoringTeam: TeamId = state.ball.position.z > 0 ? 'home' : 'away';
      state.score[scoringTeam] += 1;
      restartTeam = scoringTeam === 'home' ? 'away' : 'home';
      state.lastEvent = `goal:${scoringTeam}`;
      const kickoffTeam: TeamId = restartTeam;
      const kickoffDirection = kickoffTeam === 'home' ? 1 : -1;
      const formation: Record<string, Vec3> = {
        // Start the taker just behind the stationary ball so the first stride
        // can make a clean, legal kickoff touch instead of leaving six players
        // milling around a motionless center ball.
        [`${kickoffTeam === 'home' ? 'h' : 'a'}-1`]: { x: 0, y: 0, z: -kickoffDirection * 0.48 },
        [`${kickoffTeam === 'home' ? 'h' : 'a'}-2`]: { x: kickoffDirection * -5.2, y: 0, z: -kickoffDirection * 4.8 },
        [`${kickoffTeam === 'home' ? 'a' : 'h'}-1`]: { x: -kickoffDirection * 4.6, y: 0, z: kickoffDirection * 5.1 },
        [`${kickoffTeam === 'home' ? 'a' : 'h'}-2`]: { x: kickoffDirection * 4.6, y: 0, z: kickoffDirection * 5.1 },
      };
      for (const player of state.players) {
        if (player.goalkeeper) continue;
        const position = formation[player.id];
        if (position) player.position = { ...position };
        player.velocity = { x: 0, y: 0, z: 0 };
        player.facingYaw = player.team === 'home' ? 0 : Math.PI;
      }
    } else {
      const lastContact = [...state.recentContacts].reverse().find((contact) => contact.tick <= state.tick);
      const lastToucher = lastContact ? state.players.find((player) => player.id === lastContact.playerId) : null;
      restartTeam = lastToucher?.team === 'home' ? 'away' : 'home';
      state.lastEvent = 'restart:out-of-play';
    }
    const restartPlayer = state.players
      .filter((player) => player.team === restartTeam && !player.goalkeeper)
      .sort((left, right) => Math.hypot(left.position.x, left.position.z) - Math.hypot(right.position.x, right.position.z) || left.id.localeCompare(right.id))[0];
    if (state.lastEvent === 'restart:out-of-play' && restartPlayer) {
      // A restart taker must actually be able to play the stationary ball.
      // Assigning possession to a distant player leaves the whole team waiting
      // outside control range, so the dead ball never re-enters play.
      restartPlayer.position = { x: 0, y: 0, z: restartTeam === 'home' ? -0.48 : 0.48 };
      restartPlayer.velocity = { x: 0, y: 0, z: 0 };
      restartPlayer.facingYaw = restartTeam === 'home' ? 0 : Math.PI;
    }
    state.ball = createBallState({ position: { x: 0, y: BALL_CONSTANTS.radius, z: 0 }, grounded: true });
    state.possessionTeam = restartTeam;
    state.possessionPlayerId = restartPlayer?.id ?? null;
    state.passReceiverId = null;
    state.passReceiverExpiresAtTick = 0;
    state.touchCooldowns = Object.fromEntries(state.players.map((player) => [player.id, 0]));
    state.restartCount += 1;
    if (state.possessionPlayerId !== previous.possessionPlayerId) state.possessionChanges += 1;
    restarted = true;
  }
  if (!restarted) {
    const inferred = inferPossession(state);
    if (inferred.playerId === null) state.looseBallTicks += 1;
    if (inferred.playerId !== previous.possessionPlayerId) state.possessionChanges += 1;
    state.possessionTeam = inferred.team;
    state.possessionPlayerId = inferred.playerId;
    if (inferred.playerId !== null && inferred.playerId !== state.passReceiverId) {
      state.passReceiverId = null;
      state.passReceiverExpiresAtTick = 0;
    }
    if (!contacted && !goalkeeperSaved && inferred.playerId === null) state.lastEvent = 'loose-ball';
  }
  state.checksum = checksum(state);
  return state;
}
