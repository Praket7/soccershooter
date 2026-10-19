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
  if (plantIntensity >= 0.34) return 'plant';
  if (brakingDemand >= 0.35 && speed > 1.2) return 'brake';
  if (sprinting && speed >= 5.2) return 'sprint';
  if (speed < 0.9) return 'walk';
  if (speed < 3.1) return 'walk';
  return 'jog';
}

function futureTrajectory(input: Readonly<AthleticMotionInput>, plantIntensity: number): AthleticTrajectorySample[] {
  const direction = normalize(input.desiredDirection);
  const speed = Math.hypot(input.currentVelocity.x, input.currentVelocity.z);
  const requestedTopSpeed = input.sprinting ? input.sprintSpeed : input.jogSpeed;
  const requestedSpeed = requestedTopSpeed * clamp(input.moveMagnitude, 0, 1);
  const plantSpeedScale = 1 - plantIntensity * 0.58;
  const targetSpeed = requestedSpeed * plantSpeedScale;
  const targetX = direction.x * targetSpeed;
  const targetZ = direction.z * targetSpeed;
  const response = input.moveMagnitude < 0.05 || plantIntensity > 0.2 ? input.braking : input.acceleration;

  let x = finite(input.position.x);
  let z = finite(input.position.z);
  let vx = finite(input.currentVelocity.x);
  let vz = finite(input.currentVelocity.z);
  const samples: AthleticTrajectorySample[] = [];

  for (let index = 1; index <= TRAJECTORY_SAMPLE_COUNT; index += 1) {
    const dt = TRAJECTORY_STEP_SECONDS;
    const maxVelocityDelta = Math.max(0, response) * dt;
    const dx = targetX - vx;
    const dz = targetZ - vz;
    const distance = Math.hypot(dx, dz);
    if (distance <= maxVelocityDelta || distance <= EPSILON) {
      vx = targetX;
      vz = targetZ;
    } else {
      const scale = maxVelocityDelta / distance;
      vx += dx * scale;
      vz += dz * scale;
    }
    x += vx * dt;
    z += vz * dt;
    samples.push({
      time: index * TRAJECTORY_STEP_SECONDS,
      position: { x, z },
      velocity: { x: vx, z: vz },
    });
  }

  // A trajectory is a near-future query, not a second movement authority. The
  // first sample deliberately retains substantial current momentum even when
  // intent changes abruptly; later samples bend toward the requested path.
  if (samples[0] && speed > 0.1) {
    samples[0].velocity.x = moveToward(
      input.currentVelocity.x,
      samples[0].velocity.x,
      Math.max(0, input.acceleration) * TRAJECTORY_STEP_SECONDS,
    );
    samples[0].velocity.z = moveToward(
      input.currentVelocity.z,
      samples[0].velocity.z,
      Math.max(0, input.acceleration) * TRAJECTORY_STEP_SECONDS,
    );
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
    : clamp(turnSeverity * speedFraction * 1.18, 0, 1);

  const releaseBrake = moveMagnitude < 0.05 ? clamp(speed / Math.max(0.1, input.jogSpeed), 0, 1) : 0;
  const turningBrake = clamp(plantIntensity * (0.55 + speedFraction * 0.45), 0, 1);
  const brakingDemand = Math.max(releaseBrake, turningBrake);
  const propulsionDemand = clamp(moveMagnitude * (1 - brakingDemand * 0.86), 0, 1);

  const targetStride = strideForSpeed(speed, input.sprinting);
  const strideSeconds = moveToward(previous.strideSeconds, targetStride, 0.55 * dt);
  let gaitPhase = previous.gaitPhase;
  if (input.grounded && (speed > 0.12 || moveMagnitude > 0.05)) {
    gaitPhase = (gaitPhase + dt / Math.max(0.2, strideSeconds)) % 1;
  } else if (speed <= 0.12 && moveMagnitude <= 0.05) {
    gaitPhase = 0;
  }

  const supportFoot: AthleticFoot = speed <= 0.12 && moveMagnitude <= 0.05
    ? 'both'
    : gaitPhase < 0.5 ? 'left' : 'right';
  const nextFoot: 'left' | 'right' = supportFoot === 'left'
    ? 'right'
    : supportFoot === 'right'
      ? 'left'
      : previous.nextFoot;

  const desired = normalize(input.desiredDirection);
  const requestedTopSpeed = input.sprinting ? input.sprintSpeed : input.jogSpeed;
  const plannedSpeed = requestedTopSpeed * moveMagnitude * (1 - plantIntensity * 0.5);
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
  // A hard grounded plant needs a short weight-transfer/recovery beat before
  // ordinary propulsion resumes. This state never moves the root by itself; it
  // simply makes the already-authoritative braking/turn transition explicit to
  // contact planning and presentation.
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
