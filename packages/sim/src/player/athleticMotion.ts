export type AthleticGait = 'idle' | 'walk' | 'jog' | 'sprint' | 'brake' | 'plant' | 'recover';
export type AthleticFoot = 'left' | 'right' | 'both';

export interface AthleticHorizontalVector {
  x: number;
  z: number;
}

export interface AthleticTrajectorySample {
  time: number;
  position: AthleticHorizontalVector;
  velocity: AthleticHorizontalVector;
}

export interface AthleticMotionState {
  gait: AthleticGait;
  gaitPhase: number;
  supportFoot: AthleticFoot;
  nextFoot: Exclude<AthleticFoot, 'both'>;
  strideSeconds: number;
  plantIntensity: number;
  turnDemand: number;
  brakingDemand: number;
  propulsionDemand: number;
  bodyLean: { forward: number; lateral: number };
  plannedVelocity: AthleticHorizontalVector;
  trajectory: AthleticTrajectorySample[];
}

export interface AthleticMotionInput {
  position: AthleticHorizontalVector;
  currentVelocity: AthleticHorizontalVector;
  desiredDirection: AthleticHorizontalVector;
  moveMagnitude: number;
  sprinting: boolean;
  grounded: boolean;
  plantCut: boolean;
  turnDelta: number;
  deltaSeconds: number;
  jogSpeed: number;
  sprintSpeed: number;
  acceleration: number;
  braking: number;
}

const EPSILON = 1e-9;
const TRAJECTORY_STEP_SECONDS = 0.15;
const TRAJECTORY_SAMPLE_COUNT = 4;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function finite(value: number, fallback = 0): number {
  return Number.isFinite(value) ? value : fallback;
}

function moveToward(current: number, target: number, maxDelta: number): number {
  const delta = target - current;
  if (Math.abs(delta) <= maxDelta) return target;
  return current + Math.sign(delta) * maxDelta;
}

function normalize(value: AthleticHorizontalVector): AthleticHorizontalVector {
  const length = Math.hypot(value.x, value.z);
  if (length <= EPSILON) return { x: 0, z: 1 };
  return { x: value.x / length, z: value.z / length };
}

function strideForSpeed(speed: number, sprinting: boolean): number {
  if (sprinting || speed >= 6.2) return 0.34;
  if (speed >= 3.2) return 0.42;
  if (speed >= 0.7) return 0.54;
  return 0.62;
}

function chooseGait(
  grounded: boolean,
  speed: number,
  moveMagnitude: number,
  sprinting: boolean,
  plantIntensity: number,
  brakingDemand: number,
): AthleticGait {
  if (!grounded) return 'recover';
  if (moveMagnitude < 0.05) return speed > 0.1 ? 'brake' : 'idle';
  if (plantIntensity >= 0.62) return 'plant';
  if (brakingDemand >= 0.48 && speed > 1.2) return 'brake';
  if (sprinting && speed >= 5.2) return 'sprint';
  if (speed < 3.1) return 'walk';
  return 'jog';
}

function futureTrajectory(input: Readonly<AthleticMotionInput>, plantIntensity: number): AthleticTrajectorySample[] {
  const direction = normalize(input.desiredDirection);
  const speed = Math.hypot(input.currentVelocity.x, input.currentVelocity.z);
  const speedFraction = clamp(speed / Math.max(0.1, input.sprintSpeed), 0, 1);
  const turnSeverity = clamp(Math.abs(input.turnDelta) / (Math.PI / 2), 0, 1);
  const requestedTopSpeed = input.sprinting ? input.sprintSpeed : input.jogSpeed;
  const requestedSpeed = requestedTopSpeed * clamp(input.moveMagnitude, 0, 1);
  const plantSpeedScale = 1 - plantIntensity * 0.44;
  const targetSpeed = requestedSpeed * plantSpeedScale;
  const perpendicular = { x: -direction.z, z: direction.x };
  const directionalBraking = input.braking * (1.34 - 0.34 * speedFraction);
  const turnPropulsion = input.acceleration * (1 + 0.34 * turnSeverity * (1 - 0.25 * speedFraction));

  let x = finite(input.position.x);
  let z = finite(input.position.z);
  let vx = finite(input.currentVelocity.x);
  let vz = finite(input.currentVelocity.z);
  const samples: AthleticTrajectorySample[] = [];

  for (let index = 1; index <= TRAJECTORY_SAMPLE_COUNT; index += 1) {
    const dt = TRAJECTORY_STEP_SECONDS;
    if (input.moveMagnitude < 0.05) {
      const magnitude = Math.hypot(vx, vz);
      const nextMagnitude = moveToward(magnitude, 0, Math.max(0, input.braking) * dt);
      const scale = magnitude > EPSILON ? nextMagnitude / magnitude : 0;
      vx *= scale;
      vz *= scale;
    } else {
      const forward = vx * direction.x + vz * direction.z;
      const lateral = vx * perpendicular.x + vz * perpendicular.z;
      const forwardRate = forward < -0.05 || input.plantCut ? input.braking : turnPropulsion;
      const nextForward = moveToward(forward, targetSpeed, Math.max(0, forwardRate) * dt);
      const nextLateral = moveToward(lateral, 0, Math.max(0, directionalBraking) * dt);
      vx = direction.x * nextForward + perpendicular.x * nextLateral;
      vz = direction.z * nextForward + perpendicular.z * nextLateral;
    }
    x += vx * dt;
    z += vz * dt;
    samples.push({
      time: index * TRAJECTORY_STEP_SECONDS,
      position: { x, z },
      velocity: { x: vx, z: vz },
    });
  }

  return samples;
}

export function createAthleticMotionState(): AthleticMotionState {
  return {
    gait: 'idle',
    gaitPhase: 0,
    supportFoot: 'both',
    nextFoot: 'right',
    strideSeconds: 0.62,
    plantIntensity: 0,
    turnDemand: 0,
    brakingDemand: 0,
    propulsionDemand: 0,
    bodyLean: { forward: 0, lateral: 0 },
    plannedVelocity: { x: 0, z: 0 },
    trajectory: [],
  };
}

export function cloneAthleticMotionState(state: Readonly<AthleticMotionState>): AthleticMotionState {
  return {
    ...state,
    bodyLean: { ...state.bodyLean },
    plannedVelocity: { ...state.plannedVelocity },
    trajectory: state.trajectory.map((sample) => ({
      time: sample.time,
      position: { ...sample.position },
      velocity: { ...sample.velocity },
    })),
  };
}

function stanceFootForPhase(phase: number): AthleticFoot {
  // Stance is deliberately shorter than half a cycle. The previous half-cycle
  // lock let a boot remain nailed to world space while the pelvis translated,
  // which produced the stretched/crossing-leg sideways glitch.
  if (phase >= 0.06 && phase < 0.40) return 'left';
  if (phase >= 0.56 && phase < 0.90) return 'right';
  return 'both';
}

function nextSwingFoot(phase: number, support: AthleticFoot): 'left' | 'right' {
  if (support === 'left') return 'right';
  if (support === 'right') return 'left';
  return phase < 0.5 ? 'left' : 'right';
}

export function stepAthleticMotion(
  previous: Readonly<AthleticMotionState>,
  input: Readonly<AthleticMotionInput>,
): AthleticMotionState {
  const dt = clamp(finite(input.deltaSeconds), 0, 0.25);
  const speed = Math.hypot(input.currentVelocity.x, input.currentVelocity.z);
  const speedFraction = clamp(speed / Math.max(0.1, input.sprintSpeed), 0, 1);
  const moveMagnitude = clamp(input.moveMagnitude, 0, 1);
  const signedTurn = clamp(finite(input.turnDelta) / Math.PI, -1, 1);
  const turnSeverity = Math.abs(signedTurn);

  const plantIntensity = input.plantCut
    ? clamp(turnSeverity * (0.78 + speedFraction * 0.72), 0, 1)
    : clamp(turnSeverity * speedFraction * 0.88, 0, 0.58);

  const releaseBrake = moveMagnitude < 0.05 ? clamp(speed / Math.max(0.1, input.jogSpeed), 0, 1) : 0;
  const turningBrake = clamp(plantIntensity * (0.48 + speedFraction * 0.42), 0, 1);
  const brakingDemand = Math.max(releaseBrake, turningBrake);
  const propulsionDemand = clamp(moveMagnitude * (1 - brakingDemand * 0.72), 0, 1);

  const targetStride = strideForSpeed(speed, input.sprinting);
  const strideSeconds = moveToward(previous.strideSeconds, targetStride, 0.72 * dt);
  let gaitPhase = previous.gaitPhase;
  if (input.grounded && (speed > 0.12 || moveMagnitude > 0.05)) {
    gaitPhase = (gaitPhase + dt / Math.max(0.2, strideSeconds)) % 1;
  } else if (speed <= 0.12 && moveMagnitude <= 0.05) {
    gaitPhase = 0;
  }

  const supportFoot: AthleticFoot = speed <= 0.12 && moveMagnitude <= 0.05
    ? 'both'
    : stanceFootForPhase(gaitPhase);
  const nextFoot = nextSwingFoot(gaitPhase, supportFoot);

  const desired = normalize(input.desiredDirection);
  const requestedTopSpeed = input.sprinting ? input.sprintSpeed : input.jogSpeed;
  const plannedSpeed = requestedTopSpeed * moveMagnitude * (1 - plantIntensity * 0.40);
  const plannedVelocity = {
    x: desired.x * plannedSpeed,
    z: desired.z * plannedSpeed,
  };

  const baseGait = chooseGait(
    input.grounded,
    speed,
    moveMagnitude,
    input.sprinting,
    plantIntensity,
    brakingDemand,
  );
  const leavingPlant = input.grounded
    && previous.gait === 'plant'
    && baseGait !== 'plant'
    && moveMagnitude > 0.05;
  const continuingRecovery = input.grounded
    && previous.gait === 'recover'
    && baseGait !== 'plant'
    && brakingDemand > 0.12
    && speed > 0.6
    && moveMagnitude > 0.05;
  const gait: AthleticGait = leavingPlant || continuingRecovery ? 'recover' : baseGait;

  return {
    gait,
    gaitPhase,
    supportFoot,
    nextFoot,
    strideSeconds,
    plantIntensity,
    turnDemand: signedTurn,
    brakingDemand,
    propulsionDemand,
    bodyLean: {
      forward: clamp((propulsionDemand - brakingDemand) * 0.22, -0.22, 0.22),
      lateral: clamp(signedTurn * (0.12 + speedFraction * 0.18), -0.3, 0.3),
    },
    plannedVelocity,
    trajectory: futureTrajectory(input, plantIntensity),
  };
}
