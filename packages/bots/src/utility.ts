import { buildBotPerception } from './perception';
import { evaluatePassLane, expectedThreatAtPoint, scorePassOption } from './passing';
import { personalityWeight, type BotPersonalityId } from './personalities';
import {
  attackingDirection,
  clamp01,
  fieldClamp,
  findPlayer,
  horizontalDistance,
  opponentGoalZ,
  ownGoalZ,
  opponentsOf,
  teamPlayers,
  type BotPlayerSnapshot,
  type BotRole,
  type BotWorldSnapshot,
  type Vec3,
} from './types';

export interface BotDecisionContext {
  personalityId?: BotPersonalityId;
  playstyle?: 'balanced' | 'possession' | 'counter' | 'high-press' | 'direct';
  predictionHorizonSeconds?: number;
  passRiskTolerance?: number;
  coordinatedRunFrequency?: number;
  defensiveAnticipation?: number;
  previousOffBallTarget?: Vec3;
}

export interface CarrierActionDecision {
  kind: 'shoot' | 'pass' | 'dribble' | 'protect' | 'clear';
  targetPlayerId: string | null;
  score: number;
}

export type OffBallActionKind = 'support' | 'overlap' | 'width' | 'half-space' | 'back-post-run' | 'recycle';

export interface OffBallActionDecision {
  kind: OffBallActionKind;
  targetPosition: Vec3;
  score: number;
}

export interface DefensiveActionDecision {
  kind: 'press' | 'cover' | 'block-lane' | 'block-shot' | 'intercept' | 'recover-goal-side';
  targetPosition: Vec3;
  score: number;
}

function personality(id: BotPersonalityId | undefined): BotPersonalityId {
  return id ?? 'balanced';
}

function weightedCarrierScore(kind: CarrierActionDecision['kind'], base: number, context?: Readonly<BotDecisionContext>): number {
  return context ? clamp01(base * personalityWeight(personality(context.personalityId), 'carrier', kind)) : base;
}

function weightedOffBallScore(kind: OffBallActionKind, base: number, context: Readonly<BotDecisionContext>): number {
  return clamp01(base * personalityWeight(personality(context.personalityId), 'offBall', kind));
}

function weightedDefenseScore(kind: DefensiveActionDecision['kind'], base: number, context: Readonly<BotDecisionContext>): number {
  return clamp01(base * personalityWeight(personality(context.personalityId), 'defense', kind));
}

function distanceToSegment(point: Readonly<Vec3>, start: Readonly<Vec3>, end: Readonly<Vec3>): number {
  const dx = end.x - start.x;
  const dz = end.z - start.z;
  const lengthSquared = dx * dx + dz * dz;
  const t = lengthSquared > 1e-9
    ? clamp01(((point.x - start.x) * dx + (point.z - start.z) * dz) / lengthSquared)
    : 0;
  return Math.hypot(point.x - (start.x + dx * t), point.z - (start.z + dz * t));
}

function supportOptionScore(world: Readonly<BotWorldSnapshot>, carrier: Readonly<Vec3>, target: Readonly<Vec3>, direction: number, playerId: string, player: Readonly<BotPlayerSnapshot>, previousTarget?: Readonly<Vec3>): number {
  const opponents = opponentsOf(world, world.possessionTeam ?? 'home').filter((player) => !player.goalkeeper);
  let targetClearance = 9;
  let laneClearance = 9;
  for (const opponent of opponents) {
    const predicted = {
      x: opponent.position.x + opponent.velocity.x * 0.35,
      y: 0,
      z: opponent.position.z + opponent.velocity.z * 0.35,
    };
    targetClearance = Math.min(targetClearance, horizontalDistance(target, predicted));
    laneClearance = Math.min(laneClearance, distanceToSegment(predicted, carrier, target));
  }
  const forwardOption = Math.max(0, direction * (target.z - carrier.z));
  const teammateClearance = Math.min(8, ...teamPlayers(world, world.possessionTeam ?? 'home')
    .filter((player) => player.id !== world.possessionPlayerId && player.id !== playerId)
    .map((player) => horizontalDistance(target, player.position)));
  // The segment is the pass corridor: a clear arrival point is useless when
  // the ball cannot reach it. Keep this inexpensive because support is scored
  // for several candidate lanes on every tactical refresh.
  const passQuality = clamp01(laneClearance / 4.2);
  const threat = expectedThreatAtPoint(world, player.team, target);
  const movementCost = clamp01(horizontalDistance(target, player.position) / 14);
  const targetChangeCost = previousTarget ? clamp01(horizontalDistance(target, previousTarget) / 5) : 0;
  const widthReward = clamp01((Math.abs(target.x - carrier.x) - 3.5) / 3.5) * 0.12;
  return clamp01(
    clamp01(targetClearance / 6.5) * 0.28
    + passQuality * 0.30
    + clamp01(forwardOption / 6) * 0.08
    + clamp01((teammateClearance - 2.4) / 4) * 0.06
    + threat * 0.10
    + (1 - movementCost) * 0.12
    + widthReward
    - targetChangeCost * 0.06,
  );
}

export function shotQuality(world: Readonly<BotWorldSnapshot>, playerId: string): number {
  const player = findPlayer(world, playerId);
  const goal = { x: 0, y: 0, z: opponentGoalZ(world, player.team) };
  const distance = horizontalDistance(player.position, goal);
  const distanceScore = clamp01(1 - distance / (world.field.halfLength * 0.95));
  const goalWidth = Math.max(1, world.field.goalHalfWidth);
  const angle = Math.atan2(Math.max(0, Math.abs(player.position.x) - goalWidth), Math.max(1, Math.abs(goal.z - player.position.z)));
  const centrality = clamp01(1 - angle / 0.7);
  const flightTime = Math.min(0.75, distance / 24);
  const defenders = opponentsOf(world, player.team).filter((opponent) => !opponent.goalkeeper);
  let nearestBlock = Number.POSITIVE_INFINITY;
  for (const opponent of defenders) nearestBlock = Math.min(nearestBlock, horizontalDistance(player.position, opponent.position));
  const space = Number.isFinite(nearestBlock) ? clamp01(nearestBlock / 6) : 1;
  const goalkeeper = opponentsOf(world, player.team).find((opponent) => opponent.goalkeeper);
  const shotTargets = [-0.92, -0.42, 0, 0.42, 0.92].map((fraction) => fraction * goalWidth);
  const shotLaneQuality = Math.max(...shotTargets.map((targetX) => {
    const target = { x: targetX, y: 0, z: goal.z };
    let laneClearance = 5;
    for (const defender of defenders) {
      const projected = {
        x: defender.position.x + defender.velocity.x * flightTime * 0.5,
        y: 0,
        z: defender.position.z + defender.velocity.z * flightTime * 0.5,
      };
      laneClearance = Math.min(laneClearance, distanceToSegment(projected, player.position, target));
    }
    const blockerClearance = clamp01((laneClearance - 0.45) / 1.9);
    const keeperX = goalkeeper
      ? goalkeeper.position.x + goalkeeper.velocity.x * flightTime
      : Number.POSITIVE_INFINITY;
    const keeperZ = goalkeeper
      ? goalkeeper.position.z + goalkeeper.velocity.z * flightTime
      : goal.z;
    const keeperInRange = goalkeeper && Math.abs(goal.z - keeperZ) < 5.5;
    const keeperReach = goalkeeper ? 1.05 + Math.min(0.7, Math.abs(goalkeeper.velocity.x) * flightTime * 0.55) : 0;
    const keeperCoverage = keeperInRange ? clamp01(1 - Math.abs(targetX - keeperX) / keeperReach) : 0;
    const angleCost = Math.abs(Math.atan2(targetX - player.position.x, goal.z - player.position.z)) * 0.18;
    return clamp01(blockerClearance * 0.68 + (1 - keeperCoverage) * 0.32 - angleCost);
  }));
  return clamp01(distanceScore * 0.50 + centrality * 0.19 + space * 0.21 + shotLaneQuality * 0.10);
}

export function chooseDribbleTarget(
  world: Readonly<BotWorldSnapshot>,
  carrierId: string,
  context?: Pick<BotDecisionContext, 'predictionHorizonSeconds'>,
): Vec3 {
  const carrier = findPlayer(world, carrierId);
  const direction = attackingDirection(carrier.team);
  const goalDistance = Math.max(2.5, direction * (opponentGoalZ(world, carrier.team) - carrier.position.z) - 2.5);
  const advance = Math.min(7, goalDistance);
  const laneWidth = Math.min(5.2, world.field.halfWidth * 0.45);
  const horizon = Math.max(0, Math.min(1.2, context?.predictionHorizonSeconds ?? 0.35));
  const opponents = opponentsOf(world, carrier.team).filter((player) => !player.goalkeeper).map((player) => ({
    ...player,
    position: {
      ...player.position,
      x: player.position.x + player.velocity.x * horizon,
      z: player.position.z + player.velocity.z * horizon,
    },
  }));
  const inShootingLane = goalDistance <= 12;
  const candidateX = inShootingLane
    ? [-2.7, 0, 2.7]
    : [-laneWidth, 0, laneWidth].map((offset) => carrier.position.x + offset);
  const candidates = candidateX.map((x) => {
    const target = fieldClamp(world, { x, y: 0, z: carrier.position.z + direction * advance }, 0.9);
    let endpointClearance = 9;
    let laneClearance = 9;
    for (const opponent of opponents) {
      endpointClearance = Math.min(endpointClearance, horizontalDistance(target, opponent.position));
      laneClearance = Math.min(laneClearance, distanceToSegment(opponent.position, carrier.position, target));
    }
    const score = clamp01(
      clamp01(endpointClearance / 7) * 0.38
      + clamp01(laneClearance / 5) * 0.34
      + expectedThreatAtPoint(world, carrier.team, target) * 0.28,
    );
    return { target, score, lateralChange: Math.abs(target.x - carrier.position.x) };
  });
  candidates.sort((left, right) => right.score - left.score || left.lateralChange - right.lateralChange || left.target.x - right.target.x);
  return candidates[0]!.target;
}

export function chooseCarrierAction(world: Readonly<BotWorldSnapshot>, carrierId: string, context?: Readonly<BotDecisionContext>): CarrierActionDecision {
  const carrier = findPlayer(world, carrierId);
  const perception = buildBotPerception(world, carrierId, context?.predictionHorizonSeconds ?? 0.35);
  const direction = attackingDirection(carrier.team);
  const ownDanger = clamp01((6.5 - direction * (carrier.position.z - ownGoalZ(world, carrier.team))) / 6.5);
  const goalDistance = horizontalDistance(carrier.position, { x: 0, y: 0, z: opponentGoalZ(world, carrier.team) });
  const shotThreat = clamp01((12 - goalDistance) / 8);
  // A clear look near goal must outrank another safe recycle or carry. The
  // distance term fades out outside the shooting zone, while shotQuality still
  // accounts for angle, centrality, and nearby blockers.
  const quality = shotQuality(world, carrierId);
  const clearCloseLook = goalDistance <= 16
    && Math.abs(carrier.position.x) <= world.field.goalHalfWidth + 5.5
    && quality >= 0.30;
  let bestPass: { playerId: string; score: number; openness: number; interceptionMarginSeconds: number } | null = null;
  const riskTolerance = context?.passRiskTolerance ?? 0.5;
  for (const receiver of teamPlayers(world, carrier.team)) {
    if (receiver.id === carrierId || receiver.goalkeeper) continue;
    const lane = evaluatePassLane(world, carrierId, receiver.id);
    const base = scorePassOption(world, carrierId, receiver.id);
    const positiveArrivalMargin = lane.interceptionMarginSeconds > 0 ? 0.18 + clamp01(lane.interceptionMarginSeconds / 0.5) * 0.12 : 0;
    const pressureBonus = perception.pressure * (lane.openness * 0.25 + positiveArrivalMargin);
    const riskBias = context ? (riskTolerance - 0.5) * 0.18 * lane.openness : 0;
    const forwardGain = direction * (receiver.position.z - carrier.position.z);
    const unpressuredShortPassPenalty = perception.pressure < 0.35
      // Avoid empty backward circulation, but keep short forward combinations
      // available; the receiver can play the next pass before the defense sets.
      ? forwardGain < 0 ? 0.22 : forwardGain < 2 ? 0.12 : 0
      : 0;
    const progressiveDirectBonus = context?.playstyle === 'direct' && forwardGain >= 3
      ? 0.12 + clamp01((forwardGain - 3) / 8) * 0.12
      : 0;
    const securePossessionBonus = context?.playstyle === 'possession' && lane.openness >= 0.55
      ? 0.08 + clamp01(lane.interceptionMarginSeconds / 0.5) * 0.08
      : 0;
    // A receiver who has just taken a pass should scan again and release a
    // clean forward option before defenders can reset. The short receiver
    // window is carried by passReceiverId and expires in the physical match.
    const continuationBonus = world.passReceiverId === carrierId && goalDistance > 16 && forwardGain >= 3 && lane.openness >= 0.7
      ? 0.30 + clamp01((forwardGain - 3) / 8) * 0.08
      : 0;
    const progressiveOutletBonus = goalDistance > 16 && forwardGain >= 4 && lane.openness >= 0.55 ? 0.18 : 0;
    const forwardCombinationBonus = goalDistance > 16 && forwardGain >= 2 && lane.openness >= 0.7 ? 0.16 : 0;
    const score = clamp01(base + pressureBonus + riskBias + progressiveDirectBonus + securePossessionBonus + continuationBonus + progressiveOutletBonus + forwardCombinationBonus - unpressuredShortPassPenalty);
    if (!bestPass || score > bestPass.score || (score === bestPass.score && receiver.id < bestPass.playerId)) {
      bestPass = { playerId: receiver.id, score, openness: lane.openness, interceptionMarginSeconds: lane.interceptionMarginSeconds };
    }
  }
  const receiverHasClearlyBetterLook = bestPass !== null
    && shotQuality(world, bestPass.playerId) >= quality + 0.08;
  if (goalDistance <= 12 && receiverHasClearlyBetterLook && bestPass
    && bestPass.score >= 0.55 && bestPass.openness >= 0.55 && bestPass.interceptionMarginSeconds > 0) {
    return { kind: 'pass', targetPlayerId: bestPass.playerId, score: bestPass.score };
  }
  // Passing lanes can saturate at 1.0 after pressure and arrival bonuses. In
  // the compact field, that made carriers recycle an obvious near-open finish.
  // Let a clean close chance beat the numeric cap unless the receiver has a
  // meaningfully better immediate shot.
  const dominantFinishingChance = goalDistance <= 12
    && quality >= 0.72
    && Math.abs(carrier.position.x) <= world.field.goalHalfWidth + 3.5
    && !receiverHasClearlyBetterLook;
  if (dominantFinishingChance) return { kind: 'shoot', targetPlayerId: null, score: Math.max(quality, 0.95) };
  const shoot = clamp01(Math.max(
    quality * (1 - perception.pressure * 0.12) + shotThreat * 0.24,
    clearCloseLook ? (goalDistance <= 11 ? 0.96 : 0.90) : 0,
  ));
  const forwardSpace = clamp01(1 - perception.pressure);
  const dribbleTarget = chooseDribbleTarget(world, carrierId, context);
  const carryProgress = clamp01(direction * (dribbleTarget.z - carrier.position.z) / 7);
  const directForwardOutlet = context?.playstyle === 'direct' && (bestPass?.score ?? 0) >= 0.46
    ? 0.10
    : 0;
  const shotOpportunityCarryPenalty = clearCloseLook ? 0.18 : 0;
  const progressivePassCarryPenalty = goalDistance > 16 && (bestPass?.score ?? 0) >= 0.72 ? 0.08 : 0;
  const continuationCarryPenalty = world.passReceiverId === carrierId && goalDistance > 13 && !clearCloseLook && (bestPass?.score ?? 0) >= 0.65 ? 0.12 : 0;
  const dribble = clamp01(0.36 + forwardSpace * 0.32 + expectedThreatAtPoint(world, carrier.team, carrier.position) * 0.12 + carryProgress * 0.20 - perception.pressure * 0.30 - directForwardOutlet - shotOpportunityCarryPenalty - progressivePassCarryPenalty - continuationCarryPenalty);
  const viablePass = bestPass?.score ?? 0;
  const receivedOutletLane = world.passReceiverId === carrierId && bestPass
    ? evaluatePassLane(world, carrierId, bestPass.playerId)
    : null;
  const receivedForwardGain = bestPass
    ? direction * (findPlayer(world, bestPass.playerId).position.z - carrier.position.z)
    : Number.NEGATIVE_INFINITY;
  const committedForwardRun = world.passReceiverId === carrierId
    && goalDistance > 13
    && !clearCloseLook
    && bestPass !== null
    && receivedOutletLane !== null
    && receivedOutletLane.openness >= 0.55
    && bestPass.score >= 0.55
    && receivedForwardGain >= 2;
  const pressureRelease = world.passReceiverId === carrierId
    && goalDistance > 13
    && !clearCloseLook
    && bestPass !== null
    && receivedOutletLane !== null
    && receivedOutletLane.openness >= 0.54
    && bestPass.score >= 0.52
    && receivedForwardGain >= -1
    && perception.pressure >= 0.48;
  if (committedForwardRun || pressureRelease) {
    return { kind: 'pass', targetPlayerId: bestPass!.playerId, score: bestPass!.score };
  }
  const protectSuppression = 1 - clamp01((viablePass - 0.32) / 0.55) * 0.58;
  const protect = clamp01((0.18 + perception.pressure * 0.58) * protectSuppression);
  const clear = clamp01(ownDanger * (0.5 + perception.pressure * 0.35));
  const candidates: CarrierActionDecision[] = [
    { kind: 'shoot', targetPlayerId: null, score: weightedCarrierScore('shoot', shoot, context) },
    { kind: 'dribble', targetPlayerId: null, score: weightedCarrierScore('dribble', dribble, context) },
    { kind: 'protect', targetPlayerId: null, score: weightedCarrierScore('protect', protect, context) },
    { kind: 'clear', targetPlayerId: null, score: weightedCarrierScore('clear', clear, context) },
  ];
  if (bestPass) candidates.push({ kind: 'pass', targetPlayerId: bestPass.playerId, score: weightedCarrierScore('pass', bestPass.score, context) });
  return candidates.sort((a, b) => b.score - a.score || a.kind.localeCompare(b.kind))[0]!;
}

function oppositeSide(value: number, magnitude: number): number {
  if (Math.abs(value) < 0.5) return magnitude;
  return value > 0 ? -magnitude : magnitude;
}

function chooseOffBallActionLegacy(world: Readonly<BotWorldSnapshot>, playerId: string, assignedRole: BotRole): OffBallActionDecision {
  const player = findPlayer(world, playerId);
  const direction = attackingDirection(player.team);
  const carrier = world.possessionTeam === player.team && world.possessionPlayerId ? findPlayer(world, world.possessionPlayerId) : null;
  if (!carrier || carrier.id === player.id) {
    return { kind: 'recycle', targetPosition: fieldClamp(world, { x: player.position.x * 0.55, y: 0, z: world.ball.position.z - direction * 5.2 }), score: 0.52 };
  }
  const progress = direction * carrier.position.z;
  const finalThird = progress > world.field.halfLength * 0.50;
  const ballWide = Math.abs(carrier.position.x) > world.field.halfWidth * 0.36;
  const farSide = carrier.position.x * player.position.x < 0;
  if (assignedRole === 'width-support' && finalThird && ballWide && farSide) {
    const targetX = oppositeSide(carrier.position.x, Math.min(world.field.halfWidth - 1, 4.8));
    return { kind: 'back-post-run', targetPosition: fieldClamp(world, { x: targetX, y: 0, z: opponentGoalZ(world, player.team) - direction * 3.2 }, 0.8), score: 0.84 };
  }
  if (assignedRole === 'width-support') {
    const preferredSide = Math.abs(player.position.x) > 1 ? Math.sign(player.position.x) : -Math.sign(carrier.position.x || 1);
    const width = Math.max(6.2, world.field.halfWidth * 0.62);
    const widthTarget = fieldClamp(world, { x: preferredSide * width, y: 0, z: carrier.position.z + direction * 2.8 }, 0.8);
    const halfSpaceTarget = fieldClamp(world, { x: preferredSide * Math.min(4.6, world.field.halfWidth * 0.40), y: 0, z: carrier.position.z + direction * 4.1 }, 0.8);
    const widthScore = 0.64 + (Math.abs(carrier.position.x) < 3.5 ? 0.10 : 0);
    const halfSpaceScore = finalThird && Math.abs(carrier.position.x) > 4 ? 0.67 : 0.51;
    return widthScore >= halfSpaceScore ? { kind: 'width', targetPosition: widthTarget, score: clamp01(widthScore) } : { kind: 'half-space', targetPosition: halfSpaceTarget, score: clamp01(halfSpaceScore) };
  }
  if (assignedRole === 'immediate-support') {
    const side = player.position.x >= carrier.position.x ? 1 : -1;
    const supportTarget = fieldClamp(world, { x: carrier.position.x + side * 4.2, y: 0, z: carrier.position.z + direction * 1.7 }, 0.8);
    const overlapTarget = fieldClamp(world, { x: carrier.position.x + side * 5.4, y: 0, z: carrier.position.z + direction * 5.0 }, 0.8);
    const supportScore = 0.72;
    const overlapScore = finalThird && Math.abs(carrier.position.x) > 2.5 ? 0.68 : 0.46;
    return supportScore >= overlapScore ? { kind: 'support', targetPosition: supportTarget, score: supportScore } : { kind: 'overlap', targetPosition: overlapTarget, score: overlapScore };
  }
  return { kind: 'recycle', targetPosition: fieldClamp(world, { x: carrier.position.x * 0.45, y: 0, z: carrier.position.z - direction * 5.8 }, 0.8), score: 0.56 };
}

export function chooseOffBallAction(world: Readonly<BotWorldSnapshot>, playerId: string, assignedRole: BotRole, context?: Readonly<BotDecisionContext>): OffBallActionDecision {
  if (!context) return chooseOffBallActionLegacy(world, playerId, assignedRole);
  const player = findPlayer(world, playerId);
  const direction = attackingDirection(player.team);
  const carrier = world.possessionTeam === player.team && world.possessionPlayerId ? findPlayer(world, world.possessionPlayerId) : null;
  const coordinated = context.coordinatedRunFrequency ?? 0.64;
  if (!carrier || carrier.id === player.id) return { kind: 'recycle', targetPosition: fieldClamp(world, { x: player.position.x * 0.55, y: 0, z: world.ball.position.z - direction * 5.2 }), score: weightedOffBallScore('recycle', 0.52, context) };
  const progress = direction * carrier.position.z;
  const finalThird = progress > world.field.halfLength * 0.50;
  const ballWide = Math.abs(carrier.position.x) > world.field.halfWidth * 0.36;
  const farSide = carrier.position.x * player.position.x < 0;
  if (assignedRole === 'width-support' && finalThird && ballWide && farSide && coordinated >= 0.45) {
    const targetX = oppositeSide(carrier.position.x, Math.min(world.field.halfWidth - 1, 4.8));
    return { kind: 'back-post-run', targetPosition: fieldClamp(world, { x: targetX, y: 0, z: opponentGoalZ(world, player.team) - direction * 3.2 }, 0.8), score: weightedOffBallScore('back-post-run', 0.72 + coordinated * 0.14, context) };
  }
  if (assignedRole === 'width-support') {
    const preferredSide = Math.abs(player.position.x) > 1 ? Math.sign(player.position.x) : -Math.sign(carrier.position.x || 1);
    const width = Math.max(6.2, world.field.halfWidth * 0.62);
    const widthTarget = fieldClamp(world, { x: preferredSide * width, y: 0, z: carrier.position.z + direction * 2.8 }, 0.8);
    const halfSpaceTarget = fieldClamp(world, { x: preferredSide * Math.min(4.6, world.field.halfWidth * 0.40), y: 0, z: carrier.position.z + direction * 4.1 }, 0.8);
    const widthScore = weightedOffBallScore('width', 0.60 + coordinated * 0.14 + (Math.abs(carrier.position.x) < 3.5 ? 0.08 : 0), context);
    const halfSpaceScore = weightedOffBallScore('half-space', finalThird && Math.abs(carrier.position.x) > 4 ? 0.60 + coordinated * 0.12 : 0.48 + coordinated * 0.05, context);
    return widthScore >= halfSpaceScore ? { kind: 'width', targetPosition: widthTarget, score: widthScore } : { kind: 'half-space', targetPosition: halfSpaceTarget, score: halfSpaceScore };
  }
  if (assignedRole === 'immediate-support') {
    const preferredSide = player.position.x >= carrier.position.x ? 1 : -1;
    const width = Math.min(world.field.halfWidth - 1, Math.max(4.4, world.field.halfWidth * 0.55));
    const carrierPressure = world.possessionPlayerId
      ? buildBotPerception(world, world.possessionPlayerId).pressure
      : 0;
    const options = [
      { side: -1, lateral: 3.5, forward: 1.8 },
      { side: 1, lateral: 3.5, forward: 1.8 },
      { side: -1, lateral: 4.2, forward: 1.7 },
      { side: 1, lateral: 4.2, forward: 1.7 },
      { side: -1, lateral: Math.min(width, 4.6), forward: 2.8 },
      { side: 1, lateral: Math.min(width, 4.6), forward: 2.8 },
      // In the small 3v3 shape there is only one support runner. Give them a
      // true wide outlet so they do not shadow the carrier through the middle.
      { side: -1, lateral: width, forward: 3.2 },
      { side: 1, lateral: width, forward: 3.2 },
      { side: -1, lateral: 1.2, forward: 4.5 },
      { side: 1, lateral: 1.2, forward: 4.5 },
      ...(carrierPressure > 0.48
        ? [{ side: -1, lateral: 3.5, forward: -1.8 }, { side: 1, lateral: 3.5, forward: -1.8 }]
        : []),
    ].map((option) => {
      const target = fieldClamp(world, {
        x: carrier.position.x + option.side * option.lateral,
        y: 0,
        z: carrier.position.z + direction * option.forward,
      }, 0.8);
      return {
        side: Math.sign(target.x - carrier.position.x),
        target,
        score: supportOptionScore(world, carrier.position, target, direction, player.id, player, context.previousOffBallTarget),
      };
    });
    options.sort((left, right) => right.score - left.score || Number(right.side === preferredSide) - Number(left.side === preferredSide) || left.target.x - right.target.x);
    const selected = options[0]!;
    return { kind: 'support', targetPosition: selected.target, score: weightedOffBallScore('support', selected.score, context) };
  }
  return { kind: 'recycle', targetPosition: fieldClamp(world, { x: carrier.position.x * 0.45, y: 0, z: carrier.position.z - direction * 5.8 }, 0.8), score: weightedOffBallScore('recycle', 0.56, context) };
}

function chooseDefensiveActionLegacy(world: Readonly<BotWorldSnapshot>, defenderId: string): DefensiveActionDecision {
  const defender = findPlayer(world, defenderId);
  const direction = attackingDirection(defender.team);
  const fieldPlayers = teamPlayers(world, defender.team).filter((player) => !player.goalkeeper);
  const nearest = [...fieldPlayers].sort((a, b) => horizontalDistance(a.position, world.ball.position) - horizontalDistance(b.position, world.ball.position) || (a.id < b.id ? -1 : 1))[0];
  const distanceToBall = horizontalDistance(defender.position, world.ball.position);
  const opponentCarrier = world.possessionPlayerId ? world.players.find((player) => player.id === world.possessionPlayerId && player.team !== defender.team) ?? null : null;
  if (nearest?.id === defenderId && distanceToBall < 5.4) {
    const target = opponentCarrier ? opponentCarrier.position : world.ball.position;
    return { kind: distanceToBall < 2.2 ? 'intercept' : 'press', targetPosition: fieldClamp(world, { ...target, y: 0 }), score: clamp01(0.72 + (5.4 - distanceToBall) * 0.04) };
  }
  const goalZ = ownGoalZ(world, defender.team);
  if (opponentCarrier) {
    const carrierGoalDistance = horizontalDistance(opponentCarrier.position, { x: 0, y: 0, z: goalZ });
    const dangerousShot = carrierGoalDistance < 10.5 && shotQuality(world, opponentCarrier.id) > 0.44;
    if (dangerousShot) return { kind: 'block-shot', targetPosition: fieldClamp(world, { x: opponentCarrier.position.x * 0.62, y: 0, z: opponentCarrier.position.z + (goalZ - opponentCarrier.position.z) * 0.38 }, 0.55), score: clamp01(0.76 + (10.5 - carrierGoalDistance) * 0.018) };
    const receivers = opponentsOf(world, defender.team)
      .filter((player) => !player.goalkeeper && player.id !== opponentCarrier.id)
      .map((receiver) => ({ receiver, lane: evaluatePassLane(world, opponentCarrier.id, receiver.id) }))
      .sort((a, b) => b.lane.openness - a.lane.openness || (a.receiver.id < b.receiver.id ? -1 : 1));
    const bestLane = receivers[0];
    if (bestLane && bestLane.lane.openness > 0.58) {
      const blockTarget = fieldClamp(world, { x: opponentCarrier.position.x + (bestLane.lane.target.x - opponentCarrier.position.x) * 0.48, y: 0, z: opponentCarrier.position.z + (bestLane.lane.target.z - opponentCarrier.position.z) * 0.48 }, 0.6);
      const goalSide = direction * (opponentCarrier.position.z - blockTarget.z) > 0.1;
      if (goalSide) return { kind: 'block-lane', targetPosition: blockTarget, score: clamp01(0.57 + bestLane.lane.openness * 0.26) };
    }
  }
  const goalSideZ = world.ball.position.z - direction * Math.max(4, Math.min(7, horizontalDistance(world.ball.position, { x: 0, y: 0, z: goalZ }) * 0.26));
  const target = fieldClamp(world, { x: world.ball.position.x * 0.38 + defender.position.x * 0.12, y: 0, z: goalSideZ });
  const betweenBallAndGoal = direction * (world.ball.position.z - target.z) > 0;
  return { kind: betweenBallAndGoal ? 'recover-goal-side' : 'cover', targetPosition: target, score: clamp01(0.62 + Math.min(0.25, distanceToBall / 24)) };
}

export function chooseDefensiveAction(world: Readonly<BotWorldSnapshot>, defenderId: string, context?: Readonly<BotDecisionContext>): DefensiveActionDecision {
  if (!context) return chooseDefensiveActionLegacy(world, defenderId);
  const defender = findPlayer(world, defenderId);
  const direction = attackingDirection(defender.team);
  const anticipation = context.defensiveAnticipation ?? 0.60;
  const perception = buildBotPerception(world, defenderId, context.predictionHorizonSeconds ?? 0.35);
  const looseBallTarget = world.possessionTeam === null ? perception.predictedBall : world.ball.position;
  const fieldPlayers = teamPlayers(world, defender.team).filter((player) => !player.goalkeeper);
  const nearest = [...fieldPlayers].sort((a, b) => horizontalDistance(a.position, looseBallTarget) - horizontalDistance(b.position, looseBallTarget) || (a.id < b.id ? -1 : 1))[0];
  const distanceToBall = horizontalDistance(defender.position, looseBallTarget);
  const opponentCarrier = world.possessionPlayerId ? world.players.find((player) => player.id === world.possessionPlayerId && player.team !== defender.team) ?? null : null;
  const pressRadius = 3.8 + anticipation * 0.55;
  // With nobody in possession there is no carrier to contain. The closest
  // field player must actively recover the loose ball even when it is outside
  // the normal pressing radius; otherwise both teams retreat into shape and
  // an unattended ball can sit on the pitch indefinitely.
  if (world.possessionTeam === null && nearest?.id === defenderId) {
    const horizon = Math.max(0, Math.min(1.2, context.predictionHorizonSeconds ?? 0.35));
    const target = {
      x: world.ball.position.x + world.ball.velocity.x * horizon,
      y: 0,
      z: world.ball.position.z + world.ball.velocity.z * horizon,
    };
    const kind: DefensiveActionDecision['kind'] = distanceToBall < 1.8 + anticipation * 0.65 ? 'intercept' : 'press';
    return { kind, targetPosition: fieldClamp(world, target), score: weightedDefenseScore(kind, clamp01(0.74 + Math.min(0.2, distanceToBall / 30)), context) };
  }
  if (nearest?.id === defenderId && distanceToBall < pressRadius) {
    const horizon = Math.max(0, Math.min(1.2, context.predictionHorizonSeconds ?? 0.35));
    const target = opponentCarrier
      ? { x: opponentCarrier.position.x + opponentCarrier.velocity.x * horizon, y: 0, z: opponentCarrier.position.z + opponentCarrier.velocity.z * horizon }
      : looseBallTarget;
    const kind: DefensiveActionDecision['kind'] = distanceToBall < 1.8 + anticipation * 0.65 ? 'intercept' : 'press';
    return { kind, targetPosition: fieldClamp(world, { ...target, y: 0 }), score: weightedDefenseScore(kind, clamp01(0.70 + (pressRadius - distanceToBall) * 0.04), context) };
  }
  const goalZ = ownGoalZ(world, defender.team);
  if (opponentCarrier) {
    const carrierGoalDistance = horizontalDistance(opponentCarrier.position, { x: 0, y: 0, z: goalZ });
    const dangerousShot = carrierGoalDistance < 9.5 + anticipation * 1.8 && shotQuality(world, opponentCarrier.id) > 0.44 - anticipation * 0.04;
    if (dangerousShot) return { kind: 'block-shot', targetPosition: fieldClamp(world, { x: opponentCarrier.position.x * 0.62, y: 0, z: opponentCarrier.position.z + (goalZ - opponentCarrier.position.z) * 0.38 }, 0.55), score: weightedDefenseScore('block-shot', clamp01(0.72 + anticipation * 0.08 + (10.5 - carrierGoalDistance) * 0.018), context) };
    const receivers = opponentsOf(world, defender.team)
      .filter((player) => !player.goalkeeper && player.id !== opponentCarrier.id)
      .map((receiver) => ({ receiver, lane: evaluatePassLane(world, opponentCarrier.id, receiver.id) }))
      .sort((a, b) => b.lane.openness - a.lane.openness || (a.receiver.id < b.receiver.id ? -1 : 1));
    const bestLane = receivers[0];
    if (bestLane && bestLane.lane.openness > 0.64 - anticipation * 0.10) {
      const blockTarget = fieldClamp(world, { x: opponentCarrier.position.x + (bestLane.lane.target.x - opponentCarrier.position.x) * 0.48, y: 0, z: opponentCarrier.position.z + (bestLane.lane.target.z - opponentCarrier.position.z) * 0.48 }, 0.6);
      const goalSide = direction * (opponentCarrier.position.z - blockTarget.z) > 0.1;
      if (goalSide) return { kind: 'block-lane', targetPosition: blockTarget, score: weightedDefenseScore('block-lane', clamp01(0.55 + anticipation * 0.07 + bestLane.lane.openness * 0.23), context) };
    }
  }
  const goalSideZ = looseBallTarget.z - direction * Math.max(4, Math.min(7, horizontalDistance(looseBallTarget, { x: 0, y: 0, z: goalZ }) * 0.26));
  const target = fieldClamp(world, { x: looseBallTarget.x * 0.38 + defender.position.x * 0.12, y: 0, z: goalSideZ });
  const betweenBallAndGoal = direction * (looseBallTarget.z - target.z) > 0;
  const kind: DefensiveActionDecision['kind'] = betweenBallAndGoal ? 'recover-goal-side' : 'cover';
  return { kind, targetPosition: target, score: weightedDefenseScore(kind, clamp01(0.60 + anticipation * 0.05 + Math.min(0.25, distanceToBall / 24)), context) };
}
