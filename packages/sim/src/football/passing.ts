import {
  clampFootball,
  commandTowardVelocity,
  forwardFromYaw,
  horizontalDistance,
  horizontalDot,
  normalizeHorizontal,
  pitchSpinForDirection,
  type BallContactCommand,
  type FootballActorSnapshot,
  type FootballBallSnapshot,
  type FootballHorizontalDirection,
  type FootballVec3,
} from './types';

export type PassType = 'ground' | 'driven' | 'lofted' | 'through' | 'chipped-through';

export interface PassReceiverSnapshot {
  position: FootballVec3;
  velocity: FootballVec3;
}

export interface PassTargetCandidate extends PassReceiverSnapshot {
  id: string;
  laneOpenness: number;
}

export interface PassTargetSelectionInput {
  origin: FootballVec3;
  userAim: FootballHorizontalDirection;
  candidates: readonly PassTargetCandidate[];
  aimConeDegrees?: number;
}

export interface PassTargetSelection {
  receiver: PassTargetCandidate;
  leadPoint: FootballVec3;
  alignment: number;
  laneOpenness: number;
  score: number;
}

export interface PassSolveInput {
  type: PassType;
  passer: Readonly<FootballActorSnapshot>;
  ball: Readonly<FootballBallSnapshot>;
  receiver: Readonly<PassReceiverSnapshot>;
  userAim: FootballHorizontalDirection;
  assist: number;
  pressure: number;
  allowBehindBodyTechnique: boolean;
}

export interface PassSolution {
  legal: boolean;
  reason: 'ok' | 'behind-body' | 'ball-out-of-reach';
  targetPoint: FootballVec3;
  launchVelocity: FootballVec3;
  launchSpeed: number;
  assistUsed: number;
  command?: BallContactCommand;
}

const PASS_CONTACT_REACH = 1.38;
const BACK_BODY_DOT = Math.cos(110 * Math.PI / 180);

function speedFor(type: PassType, distance: number): number {
  if (type === 'driven') return clampFootball(14 + distance * 0.48, 15, 25);
  if (type === 'lofted') return clampFootball(12 + distance * 0.35, 13, 20);
  if (type === 'chipped-through') return clampFootball(11.5 + distance * 0.38, 12.5, 20);
  if (type === 'through') return clampFootball(11 + distance * 0.43, 12, 21);
  return clampFootball(8.5 + distance * 0.42, 9.5, 17.5);
}

function leadFactor(type: PassType): number {
  if (type === 'chipped-through') return 1.28;
  if (type === 'through') return 1.18;
  if (type === 'driven') return 0.5;
  if (type === 'lofted') return 0.72;
  return 0.42;
}

function blendDirection(
  userAim: FootballHorizontalDirection,
  ideal: FootballHorizontalDirection,
  assist: number,
): { direction: FootballHorizontalDirection; assistUsed: number } {
  const user = normalizeHorizontal(userAim);
  const target = normalizeHorizontal(ideal, user);
  const dot = horizontalDot(user, target);
  const minimumDot = Math.cos(38 * Math.PI / 180);
  if (dot < minimumDot) return { direction: user, assistUsed: 0 };
  const amount = clampFootball(assist, 0, 1) * 0.72;
  return {
    direction: normalizeHorizontal({
      x: user.x * (1 - amount) + target.x * amount,
      z: user.z * (1 - amount) + target.z * amount,
    }, user),
    assistUsed: amount,
  };
}

/**
 * Selects a receiver only when that receiver already lies inside the player's
 * requested passing lane. Assistance ranks candidates; it never invents a
 * receiver for a deliberate open-space command.
 */
export function selectPassTarget(input: Readonly<PassTargetSelectionInput>): PassTargetSelection | null {
  const aim = normalizeHorizontal(input.userAim);
  const coneDegrees = clampFootball(input.aimConeDegrees ?? 38, 1, 89);
  const minimumDot = Math.cos(coneDegrees * Math.PI / 180);
  let best: PassTargetSelection | null = null;

  for (const receiver of input.candidates) {
    const toReceiver = normalizeHorizontal({
      x: receiver.position.x - input.origin.x,
      z: receiver.position.z - input.origin.z,
    }, aim);
    const alignment = horizontalDot(aim, toReceiver);
    if (alignment < minimumDot) continue;

    const distance = horizontalDistance(input.origin, receiver.position);
    const travelSeconds = clampFootball(distance / 14, 0.12, 1.4);
    const leadPoint: FootballVec3 = {
      x: receiver.position.x + receiver.velocity.x * travelSeconds,
      y: receiver.position.y,
      z: receiver.position.z + receiver.velocity.z * travelSeconds,
    };
    const laneOpenness = clampFootball(receiver.laneOpenness, 0, 1);
    const score = alignment * 0.72 + laneOpenness * 0.28;
    const selection: PassTargetSelection = { receiver: { ...receiver }, leadPoint, alignment, laneOpenness, score };
    if (!best || score > best.score || (score === best.score && receiver.id < best.receiver.id)) best = selection;
  }

  return best;
}

export function solvePass(input: Readonly<PassSolveInput>): PassSolution {
  const distanceToReceiver = horizontalDistance(input.passer.position, input.receiver.position);
  const nominalSpeed = speedFor(input.type, distanceToReceiver);
  const nominalTravelSeconds = clampFootball(distanceToReceiver / Math.max(1, nominalSpeed), 0.08, 2.4);
  const lead = leadFactor(input.type);
  const targetPoint: FootballVec3 = {
    x: input.receiver.position.x + input.receiver.velocity.x * nominalTravelSeconds * lead,
    y: input.receiver.position.y,
    z: input.receiver.position.z + input.receiver.velocity.z * nominalTravelSeconds * lead,
  };
  const idealDirection = normalizeHorizontal({
    x: targetPoint.x - input.ball.position.x,
    z: targetPoint.z - input.ball.position.z,
  });
  const facing = forwardFromYaw(input.passer.facingYaw);
  const targetFacingDot = horizontalDot(facing, idealDirection);
  const aim = normalizeHorizontal(input.userAim, facing);
  const aimFacingDot = horizontalDot(facing, aim);

  if (!input.allowBehindBodyTechnique && Math.min(targetFacingDot, aimFacingDot) < BACK_BODY_DOT) {
    return {
      legal: false,
      reason: 'behind-body',
      targetPoint,
      launchVelocity: { x: 0, y: 0, z: 0 },
      launchSpeed: 0,
      assistUsed: 0,
    };
  }
  if (horizontalDistance(input.passer.position, input.ball.position) > PASS_CONTACT_REACH) {
    return {
      legal: false,
      reason: 'ball-out-of-reach',
      targetPoint,
      launchVelocity: { x: 0, y: 0, z: 0 },
      launchSpeed: 0,
      assistUsed: 0,
    };
  }

  const blended = blendDirection(aim, idealDirection, input.assist);
  const pressureFactor = 1 - clampFootball(input.pressure, 0, 1) * 0.12;
  const horizontalSpeed = nominalSpeed * pressureFactor;
  const elevationDegrees = input.type === 'lofted'
    ? 27
    : input.type === 'chipped-through'
      ? 18
      : input.type === 'through'
        ? 4.5
        : input.type === 'driven'
          ? 1.2
          : 2.2;
  const elevation = elevationDegrees * Math.PI / 180;
  const launchVelocity: FootballVec3 = {
    x: blended.direction.x * horizontalSpeed * Math.cos(elevation),
    y: horizontalSpeed * Math.sin(elevation),
    z: blended.direction.z * horizontalSpeed * Math.cos(elevation),
  };
  const launchSpeed = Math.hypot(launchVelocity.x, launchVelocity.y, launchVelocity.z);
  const signedPitchSpin = input.type === 'lofted' || input.type === 'chipped-through'
    ? -18
    : input.type === 'driven'
      ? 4
      : -4;
  const angularVelocityDelta = pitchSpinForDirection(blended.direction, signedPitchSpin);
  const maxImpulse = Math.min(12.5, input.ball.mass * 30);
  const command = commandTowardVelocity(
    'pass',
    input.ball,
    launchVelocity,
    angularVelocityDelta,
    maxImpulse,
    `${input.type} pass lead=${lead.toFixed(2)} assist=${blended.assistUsed.toFixed(2)} pressure=${clampFootball(input.pressure, 0, 1).toFixed(2)}`,
  );

  return {
    legal: true,
    reason: 'ok',
    targetPoint,
    launchVelocity,
    launchSpeed,
    assistUsed: blended.assistUsed,
    command,
  };
}
