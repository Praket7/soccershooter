import type { InputIntent } from '../index';
import { stepAthleticMotion } from './athleticMotion';
import { PlayerActionBits, clonePlayerState, type LocomotionState, type PlayerState, type Vec3 } from './PlayerState';

export interface MovementConfig {
  capsuleRadius: number;
  walkSpeed: number;
  jogSpeed: number;
  sprintSpeed: number;
  acceleration: number;
  braking: number;
  lowSpeedTurnRate: number;
  highSpeedTurnRate: number;
  facingTurnRate: number;
  staminaMax: number;
  staminaDrainPerSecond: number;
  staminaRecoveryPerSecond: number;
  sprintUnlockStamina: number;
  maxStepHeight: number;
  maxSlopeRadians: number;
  gravity: number;
  terminalFallSpeed: number;
  groundSnapDistance: number;
}

export const PLAYER_MOVEMENT_TICK_HZ = 60;

export const DEFAULT_MOVEMENT_CONFIG: Readonly<MovementConfig> = Object.freeze({
  capsuleRadius: 0.38,
  walkSpeed: 2.35,
  jogSpeed: 5.2,
  sprintSpeed: 8.8,
  // Straight-line launch keeps the established football sprint envelope. The
  // directional controller below can combine braking with re-acceleration on a
  // cut instead of pretending both must share one scalar velocity budget.
  acceleration: 7.5,
  braking: 8.5,
  lowSpeedTurnRate: 12,
  highSpeedTurnRate: 5.6,
  facingTurnRate: 12,
  staminaMax: 100,
  staminaDrainPerSecond: 16,
  staminaRecoveryPerSecond: 13,
  sprintUnlockStamina: 22,
  maxStepHeight: 0.32,
  maxSlopeRadians: (38 * Math.PI) / 180,
  gravity: 18,
  terminalFallSpeed: 22,
  groundSnapDistance: 0.08,
});

export interface MovementBounds {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

export interface AxisAlignedObstacle extends MovementBounds {
  id: string;
  minY: number;
  maxY: number;
}

export interface GroundPatch extends MovementBounds {
  id: string;
  baseHeight: number;
  slopeX: number;
  slopeZ: number;
}

export interface MovementWorld {
  bounds: MovementBounds;
  obstacles: readonly AxisAlignedObstacle[];
  ground: readonly GroundPatch[];
}

export interface NormalizedMoveIntent {
  x: number;
  y: number;
  magnitude: number;
}

export interface MovementTraceFrame {
  tick: number;
  intent: InputIntent;
}

export interface MovementTrace {
  version: 1;
  tickHz: number;
  initialState: PlayerState;
  frames: readonly MovementTraceFrame[];
}

export interface BenchmarkZone {
  id: 'sprint' | 'cut' | 'stop' | 'slalom' | 'corridor' | 'camera-wall' | 'slope' | 'step';
  label: string;
  center: Vec3;
  size: Vec3;
}

export const BENCHMARK_COURSE: Readonly<{ spawn: Vec3; zones: readonly BenchmarkZone[] }> = Object.freeze({
  spawn: Object.freeze({ x: 0, y: 0, z: -13 }),
  zones: Object.freeze<BenchmarkZone[]>([
    { id: 'sprint', label: 'STRAIGHT SPRINT', center: { x: 0, y: 0, z: -10 }, size: { x: 2.4, y: 0, z: 5 } },
    { id: 'cut', label: 'HARD CUT', center: { x: -4, y: 0, z: -5 }, size: { x: 4, y: 0, z: 3 } },
    { id: 'stop', label: 'STOP TEST', center: { x: 4, y: 0, z: -5 }, size: { x: 4, y: 0, z: 3 } },
    { id: 'slalom', label: 'SLALOM', center: { x: 0, y: 0, z: 0 }, size: { x: 5, y: 0, z: 6 } },
    { id: 'corridor', label: 'TIGHT CORRIDOR', center: { x: 0, y: 0, z: 7 }, size: { x: 3.4, y: 2.4, z: 6 } },
    { id: 'camera-wall', label: 'CAMERA WALL', center: { x: 6.5, y: 1.7, z: 8 }, size: { x: 4, y: 3.4, z: 7 } },
    { id: 'slope', label: 'LEGAL SLOPE', center: { x: -7, y: 0.16, z: 8 }, size: { x: 3.5, y: 0.32, z: 4 } },
    { id: 'step', label: 'STEP TEST', center: { x: 6, y: 0.11, z: -2 }, size: { x: 4, y: 0.22, z: 3 } },
  ]),
});

const TAU = Math.PI * 2;
const EPSILON = 1e-9;
// Ordinary 45-90 degree football cuts must stay responsive. A committed plant
// is reserved for genuine high-speed reversals where momentum should matter.
const PLANT_CUT_ENTER_ANGLE = (120 * Math.PI) / 180;
const PLANT_CUT_EXIT_ANGLE = (42 * Math.PI) / 180;
const PLANT_CUT_MIN_SPEED = 6.1;
// Keep lateral redirection and braking within a human-scale force envelope.
// Soccer change-of-direction relies on braking and re-acceleration across
// support steps, not a large instantaneous sideways velocity correction.
const MIN_DIRECTIONAL_BRAKING = 6.5;
const MAX_DIRECTIONAL_BRAKING = 8.5;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function normalizeAngle(value: number): number {
  const wrapped = ((value + Math.PI) % TAU + TAU) % TAU - Math.PI;
  return Object.is(wrapped, -0) ? 0 : wrapped;
}

function angleDelta(from: number, to: number): number {
  return normalizeAngle(to - from);
}

function moveAngleToward(from: number, to: number, maxDelta: number): number {
  const delta = angleDelta(from, to);
  if (Math.abs(delta) <= maxDelta) return normalizeAngle(to);
  return normalizeAngle(from + Math.sign(delta) * maxDelta);
}

function moveToward(current: number, target: number, maxDelta: number): number {
  const delta = target - current;
  if (Math.abs(delta) <= maxDelta) return target;
  return current + Math.sign(delta) * maxDelta;
}

function moveVectorToward(currentX: number, currentZ: number, targetX: number, targetZ: number, maxDelta: number) {
  const dx = targetX - currentX;
  const dz = targetZ - currentZ;
  const distance = Math.hypot(dx, dz);
  if (distance <= maxDelta || distance < EPSILON) return { x: targetX, z: targetZ };
  const scale = maxDelta / distance;
  return { x: currentX + dx * scale, z: currentZ + dz * scale };
}

export function normalizeMoveIntent(moveX: number, moveY: number): NormalizedMoveIntent {
  if (!Number.isFinite(moveX) || !Number.isFinite(moveY)) throw new TypeError('movement axes must be finite');
  const length = Math.hypot(moveX, moveY);
  if (length < EPSILON) return { x: 0, y: 0, magnitude: 0 };
  const magnitude = Math.min(1, length);
  const scale = magnitude / length;
  return { x: moveX * scale, y: moveY * scale, magnitude };
}

export function createFlatMovementWorld(bounds: MovementBounds = { minX: -24, maxX: 24, minZ: -16, maxZ: 16 }): MovementWorld {
  return { bounds: { ...bounds }, obstacles: [], ground: [] };
}

export function createMovementBenchmarkWorld(): MovementWorld {
  return {
    bounds: { minX: -24, maxX: 24, minZ: -16, maxZ: 16 },
    obstacles: [
      { id: 'slalom-a', minX: -1.15, maxX: -0.72, minZ: -2.4, maxZ: -1.97, minY: 0, maxY: 1.05 },
      { id: 'slalom-b', minX: 0.72, maxX: 1.15, minZ: -0.45, maxZ: -0.02, minY: 0, maxY: 1.05 },
      { id: 'slalom-c', minX: -1.15, maxX: -0.72, minZ: 1.5, maxZ: 1.93, minY: 0, maxY: 1.05 },
      { id: 'corridor-left', minX: -1.9, maxX: -1.62, minZ: 4, maxZ: 10.4, minY: 0, maxY: 2.4 },
      { id: 'corridor-right', minX: 1.62, maxX: 1.9, minZ: 4, maxZ: 10.4, minY: 0, maxY: 2.4 },
      { id: 'camera-wall', minX: 5.2, maxX: 5.48, minZ: 4.5, maxZ: 12.5, minY: 0, maxY: 3.6 },
    ],
    ground: [
      { id: 'step-platform', minX: 4, maxX: 8, minZ: -3.5, maxZ: -0.5, baseHeight: 0.22, slopeX: 0, slopeZ: 0 },
      { id: 'ramp', minX: -8.75, maxX: -5.25, minZ: 6, maxZ: 10, baseHeight: 0, slopeX: 0, slopeZ: 0.08 },
    ],
  };
}

function patchHeight(patch: GroundPatch, x: number, z: number): number {
  return patch.baseHeight + (x - patch.minX) * patch.slopeX + (z - patch.minZ) * patch.slopeZ;
}

function sampleGround(world: MovementWorld, x: number, z: number): { height: number; slopeRadians: number } {
  let height = 0;
  let slopeRadians = 0;
  for (const patch of world.ground) {
    if (x < patch.minX || x > patch.maxX || z < patch.minZ || z > patch.maxZ) continue;
    const candidate = patchHeight(patch, x, z);
    if (candidate >= height) {
      height = candidate;
      slopeRadians = Math.atan(Math.hypot(patch.slopeX, patch.slopeZ));
    }
  }
  return { height, slopeRadians };
}

function overlapsExpanded(value: number, min: number, max: number, radius: number): boolean {
  return value > min - radius + EPSILON && value < max + radius - EPSILON;
}

function resolveX(startX: number, endX: number, z: number, radius: number, obstacles: readonly AxisAlignedObstacle[]) {
  let resolved = endX;
  let collided = false;
  for (const obstacle of obstacles) {
    if (!overlapsExpanded(z, obstacle.minZ, obstacle.maxZ, radius)) continue;
    const min = obstacle.minX - radius;
    const max = obstacle.maxX + radius;
    if (endX > startX && startX <= min && resolved > min) {
      resolved = Math.min(resolved, min);
      collided = true;
    } else if (endX < startX && startX >= max && resolved < max) {
      resolved = Math.max(resolved, max);
      collided = true;
    } else if (resolved > min && resolved < max) {
      const toMin = Math.abs(resolved - min);
      const toMax = Math.abs(max - resolved);
      resolved = toMin <= toMax ? min : max;
      collided = true;
    }
  }
  return { value: resolved, collided };
}

function resolveZ(startZ: number, endZ: number, x: number, radius: number, obstacles: readonly AxisAlignedObstacle[]) {
  let resolved = endZ;
  let collided = false;
  for (const obstacle of obstacles) {
    if (!overlapsExpanded(x, obstacle.minX, obstacle.maxX, radius)) continue;
    const min = obstacle.minZ - radius;
    const max = obstacle.maxZ + radius;
    if (endZ > startZ && startZ <= min && resolved > min) {
      resolved = Math.min(resolved, min);
      collided = true;
    } else if (endZ < startZ && startZ >= max && resolved < max) {
      resolved = Math.max(resolved, max);
      collided = true;
    } else if (resolved > min && resolved < max) {
      const toMin = Math.abs(resolved - min);
      const toMax = Math.abs(max - resolved);
      resolved = toMin <= toMax ? min : max;
      collided = true;
    }
  }
  return { value: resolved, collided };
}

function chooseLocomotion(speed: number, targetMagnitude: number, sprinting: boolean, plantCut: boolean): LocomotionState {
  if (speed < 0.08) return 'idle';
  if (targetMagnitude < 0.05) return 'decelerate';
  if (plantCut) return 'sharp-cut';
  if (sprinting && speed > 5.3) return 'sprint';
  if (speed <= DEFAULT_MOVEMENT_CONFIG.walkSpeed + 0.25) return 'walk';
  return 'jog';
}

function directionalVelocity(
  currentX: number,
  currentZ: number,
  desiredX: number,
  desiredZ: number,
  targetSpeed: number,
  currentSpeed: number,
  turnDelta: number,
  plantCut: boolean,
  deltaSeconds: number,
  config: Readonly<MovementConfig>,
): { x: number; z: number } {
  const speedFraction = clamp(currentSpeed / Math.max(0.1, config.sprintSpeed), 0, 1);
  const turnSeverity = clamp(Math.abs(turnDelta) / (Math.PI / 2), 0, 1);
  const turnPropulsionScale = 1 - 0.18 * turnSeverity * (1 - 0.25 * speedFraction);
  const launchAcceleration = config.acceleration * turnPropulsionScale;
  const directionalBraking = MAX_DIRECTIONAL_BRAKING
    + (MIN_DIRECTIONAL_BRAKING - MAX_DIRECTIONAL_BRAKING) * speedFraction;

  // Resolve velocity in a basis aligned to the user's requested travel. This
  // is the key difference from the old point-mass moveVectorToward response:
  // cancelling stale sideways momentum no longer steals the entire budget that
  // should also be building the new requested direction.
  const perpendicularX = -desiredZ;
  const perpendicularZ = desiredX;
  const forwardVelocity = currentX * desiredX + currentZ * desiredZ;
  const lateralVelocity = currentX * perpendicularX + currentZ * perpendicularZ;

  const forwardRate = forwardVelocity < -0.05 || plantCut ? config.braking : launchAcceleration;
  const plantTargetSpeed = plantCut ? Math.min(targetSpeed, config.jogSpeed * 0.78) : targetSpeed;
  const nextForward = moveToward(forwardVelocity, plantTargetSpeed, forwardRate * deltaSeconds);
  const nextLateral = moveToward(
    lateralVelocity,
    0,
    (plantCut ? config.braking : directionalBraking) * deltaSeconds,
  );

  let x = desiredX * nextForward + perpendicularX * nextLateral;
  let z = desiredZ * nextForward + perpendicularZ * nextLateral;
  const magnitude = Math.hypot(x, z);
  const legalMax = Math.max(config.sprintSpeed, targetSpeed);
  if (magnitude > legalMax + EPSILON) {
    const scale = legalMax / magnitude;
    x *= scale;
    z *= scale;
  }
  return { x, z };
}

export function stepPlayerMovement(
  previous: Readonly<PlayerState>,
  intent: Readonly<InputIntent>,
  world: Readonly<MovementWorld>,
  deltaSeconds: number,
  config: Readonly<MovementConfig> = DEFAULT_MOVEMENT_CONFIG,
): PlayerState {
  if (!Number.isFinite(deltaSeconds) || deltaSeconds <= 0 || deltaSeconds > 0.25) {
    throw new RangeError('deltaSeconds must be finite and in (0, 0.25]');
  }

  const state = clonePlayerState(previous);
  const move = normalizeMoveIntent(intent.moveX, intent.moveY);
  const aimYaw = normalizeAngle(intent.aimYaw);

  let stamina = clamp(state.stamina, 0, config.staminaMax);
  let sprintLocked = state.sprintLocked;
  if (sprintLocked && stamina >= config.sprintUnlockStamina) sprintLocked = false;
  const sprinting = Boolean(intent.sprint && move.magnitude > 0.12 && !sprintLocked && stamina > 0);
  if (sprinting) {
    stamina = Math.max(0, stamina - config.staminaDrainPerSecond * deltaSeconds);
    if (stamina <= EPSILON) {
      stamina = 0;
      sprintLocked = true;
    }
  } else {
    stamina = Math.min(config.staminaMax, stamina + config.staminaRecoveryPerSecond * deltaSeconds);
    if (sprintLocked && stamina >= config.sprintUnlockStamina) sprintLocked = false;
  }

  const sin = Math.sin(aimYaw);
  const cos = Math.cos(aimYaw);
  const desiredX = move.y * sin - move.x * cos;
  const desiredZ = move.y * cos + move.x * sin;
  const currentSpeed = Math.hypot(state.velocity.x, state.velocity.z);
  const topSpeed = sprinting ? config.sprintSpeed : config.jogSpeed;
  const requestedTargetSpeed = topSpeed * move.magnitude;

  let turnDelta = 0;
  let plantCut = false;
  if (requestedTargetSpeed > 0.01 && currentSpeed > 0.08) {
    const currentHeading = Math.atan2(state.velocity.x, state.velocity.z);
    const desiredHeading = Math.atan2(desiredX, desiredZ);
    turnDelta = angleDelta(currentHeading, desiredHeading);
    const enteringPlantCut = Math.abs(turnDelta) >= PLANT_CUT_ENTER_ANGLE && currentSpeed > PLANT_CUT_MIN_SPEED;
    const continuingPlantCut = previous.locomotion === 'sharp-cut'
      && Math.abs(turnDelta) > PLANT_CUT_EXIT_ANGLE
      && currentSpeed > config.walkSpeed;
    plantCut = enteringPlantCut || continuingPlantCut;
  }

  let velocity: { x: number; z: number };
  if (move.magnitude <= 0.01) {
    velocity = moveVectorToward(
      state.velocity.x,
      state.velocity.z,
      0,
      0,
      config.braking * deltaSeconds,
    );
  } else {
    velocity = directionalVelocity(
      state.velocity.x,
      state.velocity.z,
      desiredX,
      desiredZ,
      requestedTargetSpeed,
      currentSpeed,
      turnDelta,
      plantCut,
      deltaSeconds,
      config,
    );
  }

  const startX = state.position.x;
  const startZ = state.position.z;
  let nextX = startX + velocity.x * deltaSeconds;
  let nextZ = startZ + velocity.z * deltaSeconds;

  const xResolved = resolveX(startX, nextX, startZ, config.capsuleRadius, world.obstacles);
  nextX = clamp(xResolved.value, world.bounds.minX + config.capsuleRadius, world.bounds.maxX - config.capsuleRadius);
  const zResolved = resolveZ(startZ, nextZ, nextX, config.capsuleRadius, world.obstacles);
  nextZ = clamp(zResolved.value, world.bounds.minZ + config.capsuleRadius, world.bounds.maxZ - config.capsuleRadius);

  let nextVelocityX = xResolved.collided || nextX !== xResolved.value ? 0 : velocity.x;
  let nextVelocityZ = zResolved.collided || nextZ !== zResolved.value ? 0 : velocity.z;

  const currentGround = sampleGround(world, startX, startZ);
  const nextGround = sampleGround(world, nextX, nextZ);
  const stepUp = nextGround.height - currentGround.height;
  if (state.grounded && (nextGround.slopeRadians > config.maxSlopeRadians + EPSILON || stepUp > config.maxStepHeight + EPSILON)) {
    nextX = startX;
    nextZ = startZ;
    nextVelocityX = 0;
    nextVelocityZ = 0;
  }
  const resolvedGround = sampleGround(world, nextX, nextZ);

  let nextY = state.position.y;
  let nextVelocityY = state.velocity.y;
  let grounded = state.grounded;
  if (grounded) {
    const dropToSupport = state.position.y - resolvedGround.height;
    if (dropToSupport <= config.groundSnapDistance + EPSILON) {
      nextY = resolvedGround.height;
      nextVelocityY = 0;
    } else {
      grounded = false;
    }
  }

  if (!grounded) {
    nextVelocityY = Math.max(-config.terminalFallSpeed, state.velocity.y - config.gravity * deltaSeconds);
    nextY = state.position.y + nextVelocityY * deltaSeconds;
    if (nextVelocityY <= 0 && nextY <= resolvedGround.height + EPSILON) {
      nextY = resolvedGround.height;
      nextVelocityY = 0;
      grounded = true;
    }
  }

  state.position = { x: nextX, y: nextY, z: nextZ };
  state.velocity = { x: nextVelocityX, y: nextVelocityY, z: nextVelocityZ };
  state.groundHeight = resolvedGround.height;
  state.grounded = grounded;
  state.stamina = stamina;
  state.sprintLocked = sprintLocked;

  // Authoritative facing remains tied to action/aim intent. Rendered locomotion
  // may align hips and gait to travel direction, but that presentation concern
  // must not silently alter pass/shot body-angle legality or bot tactics.
  const locomotionSpeed = Math.hypot(nextVelocityX, nextVelocityZ);
  state.facingYaw = moveAngleToward(state.facingYaw, aimYaw, config.facingTurnRate * deltaSeconds);

  state.locomotion = grounded
    ? chooseLocomotion(locomotionSpeed, move.magnitude, sprinting, plantCut)
    : 'airborne';
  state.athleticMotion = stepAthleticMotion(previous.athleticMotion, {
    position: { x: nextX, z: nextZ },
    currentVelocity: { x: nextVelocityX, z: nextVelocityZ },
    desiredDirection: { x: desiredX, z: desiredZ },
    moveMagnitude: move.magnitude,
    sprinting,
    grounded,
    plantCut,
    turnDelta,
    deltaSeconds,
    jogSpeed: config.jogSpeed,
    sprintSpeed: config.sprintSpeed,
    acceleration: config.acceleration,
    braking: config.braking,
    strikePreparation: (intent.actionBits & PlayerActionBits.ShootHeld) !== 0,
  });
  state.actionHooks = {
    jumpRequested: (intent.actionBits & PlayerActionBits.Jump) !== 0,
    tackleRequested: (intent.actionBits & PlayerActionBits.Tackle) !== 0,
  };
  return state;
}

function cloneIntent(intent: Readonly<InputIntent>): InputIntent {
  return {
    moveX: intent.moveX,
    moveY: intent.moveY,
    aimYaw: intent.aimYaw,
    sprint: intent.sprint,
    actionBits: intent.actionBits >>> 0,
  };
}

export function recordMovementTrace(
  initialState: Readonly<PlayerState>,
  intents: readonly Readonly<InputIntent>[],
  tickHz = PLAYER_MOVEMENT_TICK_HZ,
): MovementTrace {
  if (!Number.isSafeInteger(tickHz) || tickHz <= 0 || tickHz > 240) throw new RangeError('tickHz must be 1..240');
  return {
    version: 1,
    tickHz,
    initialState: clonePlayerState(initialState),
    frames: intents.map((intent, tick) => ({ tick, intent: cloneIntent(intent) })),
  };
}

export function replayMovementTrace(
  trace: Readonly<MovementTrace>,
  world: Readonly<MovementWorld>,
  config: Readonly<MovementConfig> = DEFAULT_MOVEMENT_CONFIG,
): PlayerState {
  if (trace.version !== 1) throw new RangeError('unsupported movement trace version');
  let state = clonePlayerState(trace.initialState);
  const dt = 1 / trace.tickHz;
  for (let expectedTick = 0; expectedTick < trace.frames.length; expectedTick += 1) {
    const frame = trace.frames[expectedTick];
    if (!frame || frame.tick !== expectedTick) throw new Error(`movement trace tick mismatch at ${expectedTick}`);
    state = stepPlayerMovement(state, frame.intent, world, dt, config);
  }
  return state;
}
