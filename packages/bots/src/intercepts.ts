import {
  clamp,
  horizontalDistance,
  horizontalSpeed,
  normalizeHorizontal,
  type BotBallSnapshot,
  type BotPlayerSnapshot,
  type Vec3,
} from './types';

export interface InterceptModelOptions {
  reactionSeconds: number;
  maxAcceleration: number;
  maxSpeed: number;
  reachRadius: number;
}

export const DEFAULT_INTERCEPT_MODEL: Readonly<InterceptModelOptions> = Object.freeze({
  reactionSeconds: 0.14,
  maxAcceleration: 9.2,
  maxSpeed: 8.2,
  reachRadius: 0.68,
});

export function estimatePlayerTimeToPoint(
  player: Readonly<BotPlayerSnapshot>,
  target: Readonly<Vec3>,
  options: Readonly<InterceptModelOptions> = DEFAULT_INTERCEPT_MODEL,
): number {
  const reaction = Math.max(0, options.reactionSeconds);
  const reactionPosition = {
    x: player.position.x + player.velocity.x * reaction,
    y: 0,
    z: player.position.z + player.velocity.z * reaction,
  };
  const direction = normalizeHorizontal({ x: target.x - reactionPosition.x, z: target.z - reactionPosition.z });
  const distance = Math.max(0, horizontalDistance(reactionPosition, target) - Math.max(0, options.reachRadius));
  if (distance <= 1e-9) return reaction;
  const towardSpeed = Math.max(0, player.velocity.x * direction.x + player.velocity.z * direction.z);
  const acceleration = Math.max(0.001, options.maxAcceleration);
  const maxSpeed = Math.max(0.1, options.maxSpeed);
  const initialSpeed = Math.min(maxSpeed, towardSpeed);
  const timeToMax = Math.max(0, (maxSpeed - initialSpeed) / acceleration);
  const accelerationDistance = initialSpeed * timeToMax + 0.5 * acceleration * timeToMax * timeToMax;
  if (distance <= accelerationDistance + 1e-9) {
    const movingTime = (-initialSpeed + Math.sqrt(initialSpeed * initialSpeed + 2 * acceleration * distance)) / acceleration;
    return reaction + movingTime;
  }
  return reaction + timeToMax + (distance - accelerationDistance) / maxSpeed;
}

export function nominalPassSpeed(distance: number): number {
  return clamp(10.5 + Math.max(0, distance) * 0.34, 10.5, 18.5);
}

export function estimateBallTimeToPoint(
  ball: Readonly<BotBallSnapshot>,
  target: Readonly<Vec3>,
  launchSpeed?: number,
): number {
  const distance = horizontalDistance(ball.position, target);
  const current = horizontalSpeed(ball.velocity);
  const speed = Math.max(1, launchSpeed ?? (current > 1 ? current : nominalPassSpeed(distance)));
  // Tactical prediction intentionally stays cheaper than Stage 04 integration. It
  // is only an arrival-time estimate and never moves authoritative ball state.
  return distance / speed;
}

export interface BallInterceptPrediction {
  reachable: boolean;
  timeSeconds: number;
  point: Vec3;
  marginSeconds: number;
}

export function predictBallIntercept(
  player: Readonly<BotPlayerSnapshot>,
  ball: Readonly<BotBallSnapshot>,
  horizonSeconds = 2.4,
): BallInterceptPrediction {
  const horizon = clamp(horizonSeconds, 0.1, 4);
  let best: BallInterceptPrediction = {
    reachable: false,
    timeSeconds: horizon,
    point: { ...ball.position },
    marginSeconds: Number.NEGATIVE_INFINITY,
  };
  for (let index = 1; index <= 16; index += 1) {
    const t = horizon * index / 16;
    const point = {
      x: ball.position.x + ball.velocity.x * t,
      y: Math.max(0, ball.position.y + ball.velocity.y * t),
      z: ball.position.z + ball.velocity.z * t,
    };
    const playerTime = estimatePlayerTimeToPoint(player, point);
    const margin = t - playerTime;
    if (margin >= 0) return { reachable: true, timeSeconds: t, point, marginSeconds: margin };
    if (margin > best.marginSeconds) best = { reachable: false, timeSeconds: t, point, marginSeconds: margin };
  }
  return best;
}
