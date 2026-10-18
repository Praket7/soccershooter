import {
  BALL_CONSTANTS,
  cloneBallState,
  createBallState,
  kineticEnergy,
  type BallState,
  type Vec3,
} from './BallState';
import {
  MATCH_BALL_PROFILE,
  aerodynamicAcceleration,
  decayAngularVelocity,
  type BallCoefficientProfile,
} from './aerodynamics';
import { resolveGroundContact } from './groundContact';
import { add, dot, magnitude, normalize, scale, subtract } from './vector';

export const BALL_SUBSTEP_HZ = 120;
export const BALL_SUBSTEP_DT = 1 / BALL_SUBSTEP_HZ;

export interface GoalFrame {
  planeZ: number;
  halfWidth: number;
  height: number;
  postRadius: number;
}

export const STANDARD_GOAL_FRAME: GoalFrame = Object.freeze({
  planeZ: 12,
  halfWidth: 3.66,
  height: 2.44,
  postRadius: 0.06,
});

export interface TrajectorySample {
  time: number;
  state: BallState;
}

export interface BallTrace {
  samples: TrajectorySample[];
  finalState: BallState;
}

export interface SimulateOptions {
  seconds: number;
  profile?: BallCoefficientProfile;
  goalFrame?: GoalFrame | null;
}

export interface PredictOptions {
  profile?: BallCoefficientProfile;
  goalFrame?: GoalFrame | null;
  maxSeconds?: number;
}

export interface LandingPrediction {
  position: Vec3;
  time: number;
}

export interface TrajectoryPrediction {
  landing: LandingPrediction;
  apex: Vec3;
  samples: TrajectorySample[];
}

function launch(speed: number, elevationDegrees: number, spin: Vec3, seed = 0): BallState {
  const elevation = elevationDegrees * Math.PI / 180;
  return createBallState({
    position: { x: 0, y: BALL_CONSTANTS.radius, z: 0 },
    velocity: { x: 0, y: Math.sin(elevation) * speed, z: Math.cos(elevation) * speed },
    angularVelocity: spin,
    knuckleSeed: seed,
  });
}

export const GOLDEN_LAUNCHES = Object.freeze({
  driven10: launch(12.5, 5, { x: -8, y: 0, z: 0 }),
  straight20: launch(24, 12, { x: 0, y: 0, z: 0 }),
  curl20: launch(24, 12, { x: 0, y: 58, z: 0 }),
  power25: launch(29, 10, { x: 0, y: 10, z: 0 }),
  lofted: launch(19, 27, { x: -22, y: 0, z: 0 }),
  chip: launch(15, 34, { x: -34, y: 0, z: 0 }),
  knuckle: launch(24, 10, { x: 0.3, y: 0.2, z: 0.15 }, 0x9a17b5),
  postRebound: createBallState({
    position: { x: STANDARD_GOAL_FRAME.halfWidth - 0.03, y: 0.9, z: STANDARD_GOAL_FRAME.planeZ - 0.07 },
    velocity: { x: 0.5, y: 0.2, z: 24 },
    angularVelocity: { x: 0, y: 20, z: 0 },
  }),
});

interface ClosestPointResult {
  point: Vec3;
  distance: number;
  id: string;
}

function closestPointOnSegment(point: Readonly<Vec3>, start: Readonly<Vec3>, end: Readonly<Vec3>): Vec3 {
  const segment = subtract(end, start);
  const lengthSquared = dot(segment, segment);
  if (lengthSquared <= 1e-12) return { ...start };
  const t = Math.max(0, Math.min(1, dot(subtract(point, start), segment) / lengthSquared));
  return add(start, scale(segment, t));
}

function closestFramePoint(position: Readonly<Vec3>, frame: GoalFrame): ClosestPointResult {
  const members = [
    { id: 'left-post', a: { x: -frame.halfWidth, y: 0, z: frame.planeZ }, b: { x: -frame.halfWidth, y: frame.height, z: frame.planeZ } },
    { id: 'right-post', a: { x: frame.halfWidth, y: 0, z: frame.planeZ }, b: { x: frame.halfWidth, y: frame.height, z: frame.planeZ } },
    { id: 'crossbar', a: { x: -frame.halfWidth, y: frame.height, z: frame.planeZ }, b: { x: frame.halfWidth, y: frame.height, z: frame.planeZ } },
  ];
  let best: ClosestPointResult = {
    point: { ...members[0]!.a },
    distance: Number.POSITIVE_INFINITY,
    id: members[0]!.id,
  };
  for (const member of members) {
    const point = closestPointOnSegment(position, member.a, member.b);
    const distance = magnitude(subtract(position, point));
    if (distance < best.distance) best = { point, distance, id: member.id };
  }
  return best;
}

export function resolveGoalFrameCollision(
  input: Readonly<BallState>,
  frame: GoalFrame = STANDARD_GOAL_FRAME,
  profile: BallCoefficientProfile = MATCH_BALL_PROFILE,
): BallState {
  const state = cloneBallState(input);
  const closest = closestFramePoint(state.position, frame);
  const contactRadius = BALL_CONSTANTS.radius + frame.postRadius;
  if (closest.distance >= contactRadius) return state;

  let normal = normalize(subtract(state.position, closest.point));
  if (magnitude(normal) < 1e-8) normal = normalize(scale(state.velocity, -1), { x: 0, y: 0, z: -1 });
  state.position = add(closest.point, scale(normal, contactRadius + 1e-5));
  const normalSpeed = dot(state.velocity, normal);
  if (normalSpeed < 0) {
    const normalVelocity = scale(normal, normalSpeed);
    const tangentialVelocity = subtract(state.velocity, normalVelocity);
    state.velocity = add(
      scale(tangentialVelocity, profile.goalFrameTangentialRetention),
      scale(normalVelocity, -profile.goalFrameRestitution),
    );
  }
  state.angularVelocity = scale(state.angularVelocity, profile.goalFrameTangentialRetention);
  state.lastContact = { kind: 'goal-frame', id: closest.id, atSeconds: state.flightSeconds };

  const beforeEnergy = kineticEnergy(input);
  const afterEnergy = kineticEnergy(state);
  if (afterEnergy > beforeEnergy && afterEnergy > 1e-12) {
    const ratio = Math.sqrt(beforeEnergy / afterEnergy);
    state.velocity = scale(state.velocity, ratio);
    state.angularVelocity = scale(state.angularVelocity, ratio);
  }
  return state;
}

function resolveSweptGoalFrameCollision(
  previous: Readonly<BallState>,
  current: Readonly<BallState>,
  frame: GoalFrame,
  profile: BallCoefficientProfile,
): BallState {
  const displacement = subtract(current.position, previous.position);
  const distance = magnitude(displacement);
  const contactRadius = BALL_CONSTANTS.radius + frame.postRadius;
  const sampleSpacing = Math.max(0.015, contactRadius * 0.25);
  const samples = Math.max(1, Math.min(48, Math.ceil(distance / sampleSpacing)));
  const endTime = current.flightSeconds;

  for (let index = 1; index <= samples; index += 1) {
    const t = index / samples;
    const position = add(previous.position, scale(displacement, t));
    const closest = closestFramePoint(position, frame);
    if (closest.distance >= contactRadius) continue;

    const impactTime = previous.flightSeconds + (endTime - previous.flightSeconds) * t;
    const candidate = cloneBallState(current);
    candidate.position = position;
    candidate.flightSeconds = impactTime;
    let resolved = resolveGoalFrameCollision(candidate, frame, profile);

    // The swept hit occurs partway through this authoritative 120 Hz step.
    // Resolve at impact, then consume the remainder with the reflected velocity
    // so a frame contact cannot silently shorten simulation time.
    const remainingSeconds = Math.max(0, endTime - impactTime);
    resolved.position = add(resolved.position, scale(resolved.velocity, remainingSeconds));
    resolved.flightSeconds = endTime;

    // A corner hit can end the residual move against another frame member.
    // Re-resolving only at the endpoint keeps the state non-penetrating without
    // adding another time increment or any artificial energy.
    resolved = resolveGoalFrameCollision(resolved, frame, profile);
    resolved.flightSeconds = endTime;
    return resolved;
  }

  return resolveGoalFrameCollision(current, frame, profile);
}

export function crossedGoalPlane(
  previous: Readonly<BallState>,
  current: Readonly<BallState>,
  frame: GoalFrame = STANDARD_GOAL_FRAME,
): boolean {
  if (!(previous.position.z < frame.planeZ && current.position.z >= frame.planeZ)) return false;
  const dz = current.position.z - previous.position.z;
  const t = Math.abs(dz) < 1e-9 ? 1 : (frame.planeZ - previous.position.z) / dz;
  const x = previous.position.x + (current.position.x - previous.position.x) * t;
  const y = previous.position.y + (current.position.y - previous.position.y) * t;
  return Math.abs(x) <= frame.halfWidth - BALL_CONSTANTS.radius
    && y >= BALL_CONSTANTS.radius
    && y <= frame.height - BALL_CONSTANTS.radius;
}

export function stepBall(
  input: Readonly<BallState>,
  dt: number = BALL_SUBSTEP_DT,
  profile: BallCoefficientProfile = MATCH_BALL_PROFILE,
  goalFrame: GoalFrame | null = null,
): BallState {
  const clampedDt = Math.max(0, Math.min(BALL_SUBSTEP_DT, dt));
  if (clampedDt === 0) return cloneBallState(input);

  let state = cloneBallState(input);
  const wasGrounded = state.grounded;
  if (state.velocity.y > 0.04) state.grounded = false;

  if (!state.grounded) {
    const aero = aerodynamicAcceleration(state, profile);
    state.velocity.x += aero.x * clampedDt;
    state.velocity.y += (aero.y - BALL_CONSTANTS.gravity) * clampedDt;
    state.velocity.z += aero.z * clampedDt;
    state.angularVelocity = decayAngularVelocity(state.angularVelocity, clampedDt, profile);
  } else {
    state.velocity.y = 0;
  }

  const beforeMove = cloneBallState(state);
  state.position.x += state.velocity.x * clampedDt;
  state.position.y += state.velocity.y * clampedDt;
  state.position.z += state.velocity.z * clampedDt;
  state.flightSeconds += clampedDt;

  // Resolve thin goal-frame geometry before turf response. This keeps a low
  // driven shot from applying ground friction first and then using that altered
  // velocity to retroactively resolve an earlier post impact in the same step.
  if (goalFrame) state = resolveSweptGoalFrameCollision(beforeMove, state, goalFrame, profile);
  if (state.position.y <= BALL_CONSTANTS.radius || wasGrounded) {
    state = resolveGroundContact(state, clampedDt, profile);
  }
  return state;
}

export function simulateBall(initial: Readonly<BallState>, options: SimulateOptions): BallTrace {
  const profile = options.profile ?? MATCH_BALL_PROFILE;
  const goalFrame = options.goalFrame ?? null;
  const totalSteps = Math.max(0, Math.round(options.seconds * BALL_SUBSTEP_HZ));
  let state = cloneBallState(initial);
  const samples: TrajectorySample[] = [{ time: 0, state: cloneBallState(state) }];
  for (let step = 0; step < totalSteps; step += 1) {
    state = stepBall(state, BALL_SUBSTEP_DT, profile, goalFrame);
    samples.push({ time: (step + 1) * BALL_SUBSTEP_DT, state: cloneBallState(state) });
  }
  return { samples, finalState: state };
}

export function predictTrajectory(initial: Readonly<BallState>, options: PredictOptions = {}): TrajectoryPrediction {
  const profile = options.profile ?? MATCH_BALL_PROFILE;
  const goalFrame = options.goalFrame ?? null;
  const maxSeconds = options.maxSeconds ?? 8;
  const maxSteps = Math.ceil(maxSeconds * BALL_SUBSTEP_HZ);
  let state = cloneBallState(initial);
  let apex = { ...state.position };
  let becameAirborne = !state.grounded && state.velocity.y > 0.02;
  const samples: TrajectorySample[] = [{ time: 0, state: cloneBallState(state) }];

  for (let step = 0; step < maxSteps; step += 1) {
    state = stepBall(state, BALL_SUBSTEP_DT, profile, goalFrame);
    const time = (step + 1) * BALL_SUBSTEP_DT;
    samples.push({ time, state: cloneBallState(state) });
    if (state.position.y > apex.y) apex = { ...state.position };
    if (!state.grounded || state.position.y > BALL_CONSTANTS.radius + 1e-5) becameAirborne = true;
    if (becameAirborne && state.grounded && time > BALL_SUBSTEP_DT) {
      return { landing: { position: { ...state.position }, time }, apex, samples };
    }
  }

  return {
    landing: { position: { ...state.position }, time: maxSteps * BALL_SUBSTEP_DT },
    apex,
    samples,
  };
}
