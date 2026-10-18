import {
  forwardFromYaw,
  horizontalDistance,
  horizontalDot,
  normalizeHorizontal,
  type FootballActorSnapshot,
  type FootballBallSnapshot,
} from './types';

export type AerialContactKind = 'header' | 'volley';

export interface AerialContactInput {
  kind: AerialContactKind;
  actor: Readonly<FootballActorSnapshot>;
  ball: Readonly<FootballBallSnapshot>;
  jumpRequested: boolean;
}

export interface AerialContactResult {
  eligible: boolean;
  reason: 'ok' | 'out-of-reach' | 'wrong-height' | 'bad-angle' | 'jump-required';
  horizontalDistance: number;
  contactHeight: number;
  timingScore: number;
}

export function evaluateAerialContact(input: Readonly<AerialContactInput>): AerialContactResult {
  const distance = horizontalDistance(input.actor.position, input.ball.position);
  const ballHeight = input.ball.position.y;
  const toBall = normalizeHorizontal({
    x: input.ball.position.x - input.actor.position.x,
    z: input.ball.position.z - input.actor.position.z,
  }, forwardFromYaw(input.actor.facingYaw));
  const alignment = horizontalDot(forwardFromYaw(input.actor.facingYaw), toBall);
  const reach = input.kind === 'header' ? 1.08 : 1.16;
  const minHeight = input.kind === 'header' ? 1.28 : 0.34;
  const maxHeight = input.kind === 'header' ? 2.35 : 1.28;
  const centerHeight = input.kind === 'header' ? 1.72 : 0.82;
  const halfWindow = (maxHeight - minHeight) / 2;
  const timingScore = Math.max(0, 1 - Math.abs(ballHeight - centerHeight) / Math.max(0.001, halfWindow));

  if (distance > reach) return { eligible: false, reason: 'out-of-reach', horizontalDistance: distance, contactHeight: ballHeight, timingScore };
  if (ballHeight < minHeight || ballHeight > maxHeight) {
    return { eligible: false, reason: 'wrong-height', horizontalDistance: distance, contactHeight: ballHeight, timingScore };
  }
  if (alignment < Math.cos(105 * Math.PI / 180)) {
    return { eligible: false, reason: 'bad-angle', horizontalDistance: distance, contactHeight: ballHeight, timingScore };
  }
  if (input.kind === 'header' && ballHeight > 1.52 && !input.jumpRequested) {
    return { eligible: false, reason: 'jump-required', horizontalDistance: distance, contactHeight: ballHeight, timingScore };
  }
  return { eligible: true, reason: 'ok', horizontalDistance: distance, contactHeight: ballHeight, timingScore };
}
