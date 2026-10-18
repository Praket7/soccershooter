import { BALL_CONSTANTS, type BallState, type Vec3 } from './BallState';
import { add, clampMagnitude, cross, dot, magnitude, normalize, scale, smoothstep, subtract } from './vector';

export interface CoefficientSample {
  input: number;
  coefficient: number;
}

export interface BallCoefficientProfile {
  id: string;
  dragBySpeed: readonly CoefficientSample[];
  liftBySpinParameter: readonly CoefficientSample[];
  airDensity: number;
  spinDecayPerSecond: number;
  knuckleMaxCoefficient: number;
  knuckleSpinParameterLimit: number;
  groundRestitution: number;
  turfFriction: number;
  rollingResistance: number;
  groundAngularDamping: number;
  goalFrameRestitution: number;
  goalFrameTangentialRetention: number;
}

export const MATCH_BALL_PROFILE: BallCoefficientProfile = Object.freeze({
  id: 'match-balanced-v1',
  // Smoothed match-ball calibration around the drag crisis. The 16-20 m/s
  // supercritical region is anchored near the ~0.17 value measured in free flight.
  dragBySpeed: Object.freeze([
    { input: 0, coefficient: 0.47 },
    { input: 5, coefficient: 0.47 },
    { input: 8, coefficient: 0.44 },
    { input: 11, coefficient: 0.36 },
    { input: 14, coefficient: 0.23 },
    { input: 16, coefficient: 0.17 },
    { input: 20, coefficient: 0.17 },
    { input: 25, coefficient: 0.18 },
    { input: 32, coefficient: 0.20 },
    { input: 40, coefficient: 0.22 },
  ]),
  // Free-flight measurements show Cl rising with Sp = r*omega/v and leveling
  // around the mid/high-spin region instead of growing without bound.
  liftBySpinParameter: Object.freeze([
    { input: 0, coefficient: 0 },
    { input: 0.05, coefficient: 0.06 },
    { input: 0.1, coefficient: 0.11 },
    { input: 0.2, coefficient: 0.20 },
    { input: 0.3, coefficient: 0.27 },
    { input: 0.5, coefficient: 0.35 },
    { input: 0.75, coefficient: 0.37 },
    { input: 1.0, coefficient: 0.38 },
  ]),
  airDensity: BALL_CONSTANTS.airDensity,
  spinDecayPerSecond: 0.11,
  knuckleMaxCoefficient: 0.085,
  knuckleSpinParameterLimit: 0.09,
  groundRestitution: 0.56,
  turfFriction: 0.72,
  rollingResistance: 0.34,
  groundAngularDamping: 0.24,
  goalFrameRestitution: 0.62,
  goalFrameTangentialRetention: 0.94,
});

function interpolateTable(input: number, table: readonly CoefficientSample[]): number {
  if (table.length === 0) throw new Error('coefficient table must not be empty');
  const first = table[0];
  const last = table[table.length - 1];
  if (!first || !last) throw new Error('coefficient table must not be empty');
  if (input <= first.input) return first.coefficient;
  if (input >= last.input) return last.coefficient;
  for (let index = 1; index < table.length; index += 1) {
    const upper = table[index];
    const lower = table[index - 1];
    if (!upper || !lower || input > upper.input) continue;
    const width = upper.input - lower.input;
    const t = width <= 0 ? 0 : (input - lower.input) / width;
    return lower.coefficient + (upper.coefficient - lower.coefficient) * t;
  }
  return last.coefficient;
}

export function dragCoefficientForSpeed(speed: number, profile: BallCoefficientProfile = MATCH_BALL_PROFILE): number {
  return interpolateTable(Math.max(0, speed), profile.dragBySpeed);
}

export function liftCoefficientForSpinParameter(spinParameter: number, profile: BallCoefficientProfile = MATCH_BALL_PROFILE): number {
  return interpolateTable(Math.max(0, spinParameter), profile.liftBySpinParameter);
}

export function spinParameter(state: Readonly<BallState>): number {
  const speed = magnitude(state.velocity);
  if (speed < 1e-6) return 0;
  const direction = normalize(state.velocity);
  const parallel = scale(direction, dot(state.angularVelocity, direction));
  const perpendicularSpin = magnitude(subtract(state.angularVelocity, parallel));
  return BALL_CONSTANTS.radius * perpendicularSpin / speed;
}

function dynamicAccelerationForSpeed(speed: number, profile: BallCoefficientProfile): number {
  return 0.5 * profile.airDensity * BALL_CONSTANTS.crossSectionArea * speed * speed / BALL_CONSTANTS.mass;
}

export function dragAcceleration(
  state: Readonly<BallState>,
  profile: BallCoefficientProfile = MATCH_BALL_PROFILE,
): Vec3 {
  const speed = magnitude(state.velocity);
  if (speed < 1e-6) return { x: 0, y: 0, z: 0 };
  const direction = scale(state.velocity, 1 / speed);
  return scale(direction, -dynamicAccelerationForSpeed(speed, profile) * dragCoefficientForSpeed(speed, profile));
}

function seedUnit(seed: number, salt: number): number {
  let value = (seed ^ Math.imul(salt, 0x9e3779b1)) >>> 0;
  value ^= value >>> 16;
  value = Math.imul(value, 0x7feb352d) >>> 0;
  value ^= value >>> 15;
  value = Math.imul(value, 0x846ca68b) >>> 0;
  value ^= value >>> 16;
  return (value >>> 0) / 0x1_0000_0000;
}

function perpendicularBasis(direction: Readonly<Vec3>): [Vec3, Vec3] {
  const reference = Math.abs(direction.y) < 0.9 ? { x: 0, y: 1, z: 0 } : { x: 1, y: 0, z: 0 };
  const first = normalize(cross(direction, reference), { x: 1, y: 0, z: 0 });
  const second = normalize(cross(direction, first), { x: 0, y: 1, z: 0 });
  return [first, second];
}

export function knuckleAcceleration(state: Readonly<BallState>, profile: BallCoefficientProfile = MATCH_BALL_PROFILE): Vec3 {
  if (state.knuckleSeed === 0) return { x: 0, y: 0, z: 0 };
  const speed = magnitude(state.velocity);
  if (speed < 1e-6) return { x: 0, y: 0, z: 0 };
  const sp = spinParameter(state);
  if (sp >= profile.knuckleSpinParameterLimit) return { x: 0, y: 0, z: 0 };

  // Knuckle effects are strongest around the experimentally observed soccer
  // window (~20-25 m/s), then fade at both lower and higher speeds.
  const speedWindow = smoothstep(15, 20, speed) * (1 - smoothstep(25, 31, speed));
  const spinWindow = 1 - smoothstep(0.025, profile.knuckleSpinParameterLimit, sp);
  const envelope = speedWindow * spinWindow;
  if (envelope <= 1e-8) return { x: 0, y: 0, z: 0 };

  const direction = normalize(state.velocity, { x: 0, y: 0, z: 1 });
  const [basisA, basisB] = perpendicularBasis(direction);
  const t = state.flightSeconds;
  const phaseA = seedUnit(state.knuckleSeed, 1) * Math.PI * 2;
  const phaseB = seedUnit(state.knuckleSeed, 2) * Math.PI * 2;
  const frequencyA = 4.2 + seedUnit(state.knuckleSeed, 3) * 2.4;
  const frequencyB = 6.1 + seedUnit(state.knuckleSeed, 4) * 2.9;
  const waveA = Math.sin(phaseA + frequencyA * t) + 0.35 * Math.sin(phaseB + 0.53 * frequencyA * t);
  const waveB = Math.sin(phaseB + frequencyB * t) + 0.28 * Math.sin(phaseA + 0.61 * frequencyB * t);
  const lateralDirection = normalize(add(scale(basisA, waveA), scale(basisB, waveB)), basisA);

  return scale(lateralDirection, dynamicAccelerationForSpeed(speed, profile) * profile.knuckleMaxCoefficient * envelope);
}

export function aerodynamicAcceleration(state: Readonly<BallState>, profile: BallCoefficientProfile = MATCH_BALL_PROFILE): Vec3 {
  const speed = magnitude(state.velocity);
  if (speed < 1e-6) return { x: 0, y: 0, z: 0 };

  const drag = dragAcceleration(state, profile);
  const dynamicAcceleration = dynamicAccelerationForSpeed(speed, profile);
  const omegaCrossVelocity = cross(state.angularVelocity, state.velocity);
  const crossLength = magnitude(omegaCrossVelocity);
  let magnus: Vec3 = { x: 0, y: 0, z: 0 };
  if (crossLength > 1e-8) {
    const cl = liftCoefficientForSpinParameter(spinParameter(state), profile);
    magnus = scale(omegaCrossVelocity, dynamicAcceleration * cl / crossLength);
  }

  return add(add(drag, magnus), knuckleAcceleration(state, profile));
}

export function decayAngularVelocity(angularVelocity: Readonly<Vec3>, dt: number, profile: BallCoefficientProfile = MATCH_BALL_PROFILE): Vec3 {
  const factor = Math.exp(-Math.max(0, profile.spinDecayPerSecond) * Math.max(0, dt));
  return clampMagnitude(scale(angularVelocity, factor), 300);
}