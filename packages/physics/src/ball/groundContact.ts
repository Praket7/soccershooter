import { BALL_CONSTANTS, cloneBallState, type BallState, type Vec3 } from './BallState';
import { MATCH_BALL_PROFILE, type BallCoefficientProfile } from './aerodynamics';

function horizontalSpeed(v: Readonly<Vec3>): number {
  return Math.hypot(v.x, v.z);
}

function applyTangentialImpulse(state: BallState, normalImpulse: number, profile: BallCoefficientProfile): void {
  const radius = BALL_CONSTANTS.radius;
  const slipX = state.velocity.x + state.angularVelocity.z * radius;
  const slipZ = state.velocity.z - state.angularVelocity.x * radius;
  const slip = Math.hypot(slipX, slipZ);
  if (slip < 1e-8 || normalImpulse <= 0) return;

  const inverseEffectiveMass = 1 / BALL_CONSTANTS.mass + radius * radius / BALL_CONSTANTS.momentOfInertia;
  const idealImpulseMagnitude = slip / inverseEffectiveMass;
  const impulseMagnitude = Math.min(idealImpulseMagnitude, profile.turfFriction * normalImpulse);
  const jx = -slipX / slip * impulseMagnitude;
  const jz = -slipZ / slip * impulseMagnitude;

  state.velocity.x += jx / BALL_CONSTANTS.mass;
  state.velocity.z += jz / BALL_CONSTANTS.mass;
  // r=(0,-R,0), so r x J = (-R*Jz, 0, R*Jx).
  state.angularVelocity.x += (-radius * jz) / BALL_CONSTANTS.momentOfInertia;
  state.angularVelocity.z += (radius * jx) / BALL_CONSTANTS.momentOfInertia;
}

function applyRollingResistance(state: BallState, dt: number, profile: BallCoefficientProfile): void {
  const safeDt = Math.max(0, dt);
  const angularDamping = Math.exp(-profile.groundAngularDamping * safeDt);
  const speed = horizontalSpeed(state.velocity);

  if (speed <= 1e-8) {
    state.velocity.x = 0;
    state.velocity.z = 0;
    state.angularVelocity.x *= angularDamping;
    state.angularVelocity.y *= angularDamping;
    state.angularVelocity.z *= angularDamping;
    if (Math.hypot(state.angularVelocity.x, state.angularVelocity.y, state.angularVelocity.z) < 0.02) {
      state.angularVelocity.x = 0;
      state.angularVelocity.y = 0;
      state.angularVelocity.z = 0;
    }
    return;
  }

  const nextSpeed = Math.max(0, speed - profile.rollingResistance * safeDt);
  const factor = nextSpeed / speed;
  state.velocity.x *= factor;
  state.velocity.z *= factor;

  // Rolling resistance removes energy from the coupled translation/rotation
  // system. Scaling the horizontal rolling spin with the same factor preserves
  // a no-slip state without manufacturing rotational energy. Any residual
  // sliding is handled by the physically dissipative tangential impulse above.
  state.angularVelocity.x *= factor;
  state.angularVelocity.z *= factor;
  state.angularVelocity.y *= angularDamping;

  if (nextSpeed < 0.045) {
    state.velocity.x = 0;
    state.velocity.z = 0;
    state.angularVelocity.x = 0;
    state.angularVelocity.z = 0;
  }
}

export function resolveGroundContact(
  input: Readonly<BallState>,
  dt: number,
  profile: BallCoefficientProfile = MATCH_BALL_PROFILE,
): BallState {
  const state = cloneBallState(input);
  const radius = BALL_CONSTANTS.radius;
  const touching = state.position.y <= radius + 1e-7 || state.grounded;
  if (!touching) return state;

  state.position.y = state.grounded ? radius : Math.max(radius, state.position.y);
  let normalImpulse = 0;
  if (state.velocity.y < 0) {
    const incomingY = state.velocity.y;
    const reboundY = Math.abs(incomingY) >= 0.72 ? -incomingY * profile.groundRestitution : 0;
    state.velocity.y = reboundY;
    normalImpulse = BALL_CONSTANTS.mass * (reboundY - incomingY);
    state.lastContact = { kind: 'ground', atSeconds: state.flightSeconds };
  } else if (state.grounded) {
    normalImpulse = BALL_CONSTANTS.mass * BALL_CONSTANTS.gravity * Math.max(0, dt);
  }

  applyTangentialImpulse(state, normalImpulse, profile);

  if (state.velocity.y <= 0.02) {
    state.velocity.y = 0;
    state.position.y = radius;
    state.grounded = true;
    applyRollingResistance(state, Math.max(0, dt), profile);
  } else {
    state.grounded = false;
  }

  return state;
}