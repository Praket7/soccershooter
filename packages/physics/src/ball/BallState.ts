export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export type BallContactKind = 'ground' | 'goal-frame' | 'wall';

export interface ContactTag {
  kind: BallContactKind;
  id?: string;
  atSeconds: number;
}

export interface BallState {
  position: Vec3;
  velocity: Vec3;
  angularVelocity: Vec3;
  knuckleSeed: number;
  flightSeconds: number;
  grounded: boolean;
  lastContact?: ContactTag;
}

export interface BallStateInit {
  position?: Partial<Vec3>;
  velocity?: Partial<Vec3>;
  angularVelocity?: Partial<Vec3>;
  knuckleSeed?: number;
  flightSeconds?: number;
  grounded?: boolean;
  lastContact?: ContactTag;
}

export const BALL_CONSTANTS = Object.freeze({
  radius: 0.11,
  diameter: 0.22,
  mass: 0.436,
  gravity: 9.81,
  airDensity: 1.225,
  crossSectionArea: Math.PI * 0.11 * 0.11,
  // A football is much closer to a thin spherical shell than a solid sphere.
  momentOfInertia: (2 / 3) * 0.436 * 0.11 * 0.11,
});

function finiteOr(value: number | undefined, fallback: number, field: string): number {
  const resolved = value ?? fallback;
  if (!Number.isFinite(resolved)) throw new TypeError(`${field} must be finite`);
  return resolved;
}

function finiteVec(source: Partial<Vec3> | undefined, fallback: Vec3, field: string): Vec3 {
  return {
    x: finiteOr(source?.x, fallback.x, `${field}.x`),
    y: finiteOr(source?.y, fallback.y, `${field}.y`),
    z: finiteOr(source?.z, fallback.z, `${field}.z`),
  };
}

export function createBallState(init: BallStateInit = {}): BallState {
  const state: BallState = {
    position: finiteVec(init.position, { x: 0, y: BALL_CONSTANTS.radius, z: 0 }, 'position'),
    velocity: finiteVec(init.velocity, { x: 0, y: 0, z: 0 }, 'velocity'),
    angularVelocity: finiteVec(init.angularVelocity, { x: 0, y: 0, z: 0 }, 'angularVelocity'),
    // Seed zero means a stable wake. A non-zero seed activates the deterministic
    // low-spin knuckle perturbation so a straight shot and a knuckle can coexist.
    knuckleSeed: finiteOr(init.knuckleSeed, 0, 'knuckleSeed') >>> 0,
    flightSeconds: finiteOr(init.flightSeconds, 0, 'flightSeconds'),
    grounded: init.grounded ?? false,
  };
  if (init.lastContact) state.lastContact = { ...init.lastContact };
  return state;
}

export function cloneBallState(state: Readonly<BallState>): BallState {
  const cloned: BallState = {
    position: { ...state.position },
    velocity: { ...state.velocity },
    angularVelocity: { ...state.angularVelocity },
    knuckleSeed: state.knuckleSeed >>> 0,
    flightSeconds: state.flightSeconds,
    grounded: state.grounded,
  };
  if (state.lastContact) cloned.lastContact = { ...state.lastContact };
  return cloned;
}

export function kineticEnergy(state: Readonly<BallState>): number {
  const linearSquared = state.velocity.x ** 2 + state.velocity.y ** 2 + state.velocity.z ** 2;
  const angularSquared = state.angularVelocity.x ** 2 + state.angularVelocity.y ** 2 + state.angularVelocity.z ** 2;
  return 0.5 * BALL_CONSTANTS.mass * linearSquared + 0.5 * BALL_CONSTANTS.momentOfInertia * angularSquared;
}

export function assertFiniteBallState(state: Readonly<BallState>): void {
  const values = [
    state.position.x, state.position.y, state.position.z,
    state.velocity.x, state.velocity.y, state.velocity.z,
    state.angularVelocity.x, state.angularVelocity.y, state.angularVelocity.z,
    state.flightSeconds,
  ];
  if (!values.every(Number.isFinite)) throw new RangeError('BallState contains NaN or Infinity');
}
