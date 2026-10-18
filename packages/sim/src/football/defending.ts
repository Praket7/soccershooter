import {
  clampFootball,
  commandTowardVelocity,
  forwardFromYaw,
  horizontalDistance,
  horizontalDot,
  normalizeHorizontal,
  type BallContactCommand,
  type FootballActorSnapshot,
  type FootballBallSnapshot,
  type FootballVec3,
} from './types';

export type ChallengeKind = 'standing' | 'committed';

export interface DefenderActionState {
  recoverySeconds: number;
  lastOutcome: 'ready' | 'won' | 'missed' | 'recovering';
}

export interface ResolveChallengeInput {
  kind: ChallengeKind;
  state: Readonly<DefenderActionState>;
  defender: Readonly<FootballActorSnapshot>;
  ball: Readonly<FootballBallSnapshot>;
  opponentPosition: FootballVec3;
}

export interface ChallengeResult {
  accepted: boolean;
  wonBall: boolean;
  reason: 'ok' | 'recovering' | 'out-of-window' | 'ball-too-high';
  nextState: DefenderActionState;
  command?: BallContactCommand;
}

export interface InterceptionInput {
  defender: Readonly<FootballActorSnapshot>;
  ball: Readonly<FootballBallSnapshot>;
  horizonSeconds: number;
}

export interface InterceptionResult {
  eligible: boolean;
  reason: 'ok' | 'moving-away' | 'outside-window' | 'ball-too-high';
  timeToWindow: number;
  closestDistance: number;
  predictedPoint: FootballVec3;
}

export function createDefenderActionState(): DefenderActionState {
  return { recoverySeconds: 0, lastOutcome: 'ready' };
}

export function stepDefenderActionState(
  state: Readonly<DefenderActionState>,
  deltaSeconds: number,
): DefenderActionState {
  const recoverySeconds = Math.max(0, state.recoverySeconds - Math.max(0, Number.isFinite(deltaSeconds) ? deltaSeconds : 0));
  return {
    recoverySeconds,
    lastOutcome: recoverySeconds > 0 ? 'recovering' : 'ready',
  };
}

export function resolveChallenge(input: Readonly<ResolveChallengeInput>): ChallengeResult {
  if (input.state.recoverySeconds > 1e-9) {
    return {
      accepted: false,
      wonBall: false,
      reason: 'recovering',
      nextState: { ...input.state, lastOutcome: 'recovering' },
    };
  }

  const distance = horizontalDistance(input.defender.position, input.ball.position);
  const toBall = normalizeHorizontal({
    x: input.ball.position.x - input.defender.position.x,
    z: input.ball.position.z - input.defender.position.z,
  }, forwardFromYaw(input.defender.facingYaw));
  const alignment = horizontalDot(forwardFromYaw(input.defender.facingYaw), toBall);
  const reach = input.kind === 'committed' ? 2.15 : 1.28;
  const minimumAlignment = input.kind === 'committed' ? -0.08 : 0.18;
  const maxBallHeight = input.kind === 'committed' ? 0.68 : 0.56;
  const ballHeight = input.ball.position.y - input.ball.radius;
  const heightLegal = ballHeight <= maxBallHeight;
  const wonBall = distance <= reach && alignment >= minimumAlignment && heightLegal;

  const recoverySeconds = input.kind === 'committed'
    ? wonBall ? 0.58 : 1.18
    : wonBall ? 0.16 : 0.34;
  const nextState: DefenderActionState = {
    recoverySeconds,
    lastOutcome: wonBall ? 'won' : 'missed',
  };

  if (!heightLegal) {
    return { accepted: true, wonBall: false, reason: 'ball-too-high', nextState };
  }
  if (!wonBall) {
    return { accepted: true, wonBall: false, reason: 'out-of-window', nextState };
  }

  const opponentDirection = normalizeHorizontal({
    x: input.ball.position.x - input.opponentPosition.x,
    z: input.ball.position.z - input.opponentPosition.z,
  }, toBall);
  const defenderMomentum = Math.hypot(input.defender.velocity.x, input.defender.velocity.z);
  const deflectionSpeed = input.kind === 'committed'
    ? clampFootball(6.5 + defenderMomentum * 0.45, 6.5, 11.5)
    : clampFootball(3.8 + defenderMomentum * 0.25, 3.8, 7.2);
  const targetVelocity: FootballVec3 = {
    x: opponentDirection.x * deflectionSpeed,
    y: input.kind === 'committed' ? 0.8 : 0.35,
    z: opponentDirection.z * deflectionSpeed,
  };
  const command = commandTowardVelocity(
    input.kind === 'committed' ? 'committed-challenge' : 'standing-challenge',
    input.ball,
    targetVelocity,
    { x: 0, y: 0, z: 0 },
    input.kind === 'committed' ? 7.5 : 5.2,
    `${input.kind} challenge distance=${distance.toFixed(2)} align=${alignment.toFixed(2)} recovery=${recoverySeconds.toFixed(2)}`,
  );

  return { accepted: true, wonBall: true, reason: 'ok', nextState, command };
}

export function evaluateInterception(input: Readonly<InterceptionInput>): InterceptionResult {
  const horizon = clampFootball(input.horizonSeconds, 0, 2);
  const relative = {
    x: input.ball.position.x - input.defender.position.x,
    z: input.ball.position.z - input.defender.position.z,
  };
  const relativeVelocity = {
    x: input.ball.velocity.x - input.defender.velocity.x,
    z: input.ball.velocity.z - input.defender.velocity.z,
  };
  const velocitySquared = relativeVelocity.x ** 2 + relativeVelocity.z ** 2;
  const rawTime = velocitySquared > 1e-9
    ? -(relative.x * relativeVelocity.x + relative.z * relativeVelocity.z) / velocitySquared
    : 0;
  const timeToWindow = clampFootball(rawTime, 0, horizon);
  const predictedPoint: FootballVec3 = {
    x: input.ball.position.x + input.ball.velocity.x * timeToWindow,
    y: input.ball.position.y + input.ball.velocity.y * timeToWindow,
    z: input.ball.position.z + input.ball.velocity.z * timeToWindow,
  };
  const closestDistance = horizontalDistance(input.defender.position, predictedPoint);
  const ballHeight = predictedPoint.y - input.ball.radius;
  const movingToward = rawTime > 0;
  const reachable = closestDistance <= 0.92 + Math.min(0.4, Math.hypot(input.defender.velocity.x, input.defender.velocity.z) * 0.05);

  if (ballHeight > 1.15) return { eligible: false, reason: 'ball-too-high', timeToWindow, closestDistance, predictedPoint };
  if (!movingToward) return { eligible: false, reason: 'moving-away', timeToWindow, closestDistance, predictedPoint };
  if (!reachable || rawTime > horizon) return { eligible: false, reason: 'outside-window', timeToWindow, closestDistance, predictedPoint };
  return { eligible: true, reason: 'ok', timeToWindow, closestDistance, predictedPoint };
}
