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
  type BotRole,
  type BotWorldSnapshot,
  type Vec3,
} from './types';

export interface BotDecisionContext {
  personalityId?: BotPersonalityId;
  predictionHorizonSeconds?: number;
  passRiskTolerance?: number;
  coordinatedRunFrequency?: number;
  defensiveAnticipation?: number;
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
  return clamp01(base * personalityWeight(personality(context?.personalityId), 'carrier', kind));
}

function weightedOffBallScore(kind: OffBallActionKind, base: number, context?: Readonly<BotDecisionContext>): number {
  return clamp01(base * personalityWeight(personality(context?.personalityId), 'offBall', kind));
}

function weightedDefenseScore(kind: DefensiveActionDecision['kind'], base: number, context?: Readonly<BotDecisionContext>): number {
  return clamp01(base * personalityWeight(personality(context?.personalityId), 'defense', kind));
}

export function shotQuality(world: Readonly<BotWorldSnapshot>, playerId: string): number {
  const player = findPlayer(world, playerId);
  const goal = { x: 0, y: 0, z: opponentGoalZ(world, player.team) };
  const distance = horizontalDistance(player.position, goal);
  const distanceScore = clamp01(1 - distance / (world.field.halfLength * 0.95));
  const centrality = clamp01(1 - Math.abs(player.position.x) / Math.max(1, world.field.halfWidth));
  let nearestBlock = Number.POSITIVE_INFINITY;
  for (const opponent of opponentsOf(world, player.team)) {
    nearestBlock = Math.min(nearestBlock, horizontalDistance(player.position, opponent.position));
  }
  const space = Number.isFinite(nearestBlock) ? clamp01(nearestBlock / 5.5) : 1;
  return clamp01(distanceScore * 0.57 + centrality * 0.20 + space * 0.23);
}

export function chooseCarrierAction(
  world: Readonly<BotWorldSnapshot>,
  carrierId: string,
  context?: Readonly<BotDecisionContext>,
): CarrierActionDecision {
  const carrier = findPlayer(world, carrierId);
  const perception = buildBotPerception(world, carrierId, context?.predictionHorizonSeconds ?? 0.35);
  const direction = attackingDirection(carrier.team);
  const ownDanger = clamp01((6.5 - direction * (carrier.position.z - ownGoalZ(world, carrier.team))) / 6.5);
  const shoot = shotQuality(world, carrierId) * (1 - perception.pressure * 0.12);
  let bestPass: { playerId: string; score: number } | null = null;
  const riskTolerance = context?.passRiskTolerance ?? 0.5;
  for (const receiver of teamPlayers(world, carrier.team)) {
    if (receiver.id === carrierId || receiver.goalkeeper) continue;
    const lane = evaluatePassLane(world, carrierId, receiver.id);
    const base = scorePassOption(world, carrierId, receiver.id);
    const positiveArrivalMargin = lane.interceptionMarginSeconds > 0
      ? 0.18 + clamp01(lane.interceptionMarginSeconds / 0.5) * 0.12
      : 0;
    const pressureBonus = perception.pressure * (lane.openness * 0.25 + positiveArrivalMargin);
    // Risk tolerance may reward a progressive but still viable lane. It can never
    // turn a physically closed lane into a viable one because openness gates it.
    const riskBias = (riskTolerance - 0.5) * 0.18 * lane.openness;
    const score = clamp01(base + pressureBonus + riskBias);
    if (!bestPass || score > bestPass.score || (score === bestPass.score && receiver.id < bestPass.playerId)) {
      bestPass = { playerId: receiver.id, score };
    }
  }
  const forwardSpace = clamp01(1 - perception.pressure);
  const dribble = clamp01(0.36 + forwardSpace * 0.32 + expectedThreatAtPoint(world, carrier.team, carrier.position) * 0.12 - perception.pressure * 0.30);
  const viablePass = bestPass?.score ?? 0;
  const protectSuppression = 1 - clamp01((viablePass - 0.32) / 0.55) * 0.58;
  const protect = clamp01((0.18 + perception.pressure * 0.58) * protectSuppression);
  const clear = clamp01(ownDanger * (0.5 + perception.pressure * 0.35));
  const candidates: CarrierActionDecision[] = [
    { kind: 'shoot', targetPlayerId: null, score: weightedCarrierScore('shoot', shoot, context) },
    { kind: 'dribble', targetPlayerId: null, score: weightedCarrierScore('dribble', dribble, context) },
    { kind: 'protect', targetPlayerId: null, score: weightedCarrierScore('protect', protect, context) },
    { kind: 'clear', targetPlayerId: null, score: weightedCarrierScore('clear', clear, context) },
  ];
  if (bestPass) candidates.push({
    kind: 'pass',
    targetPlayerId: bestPass.playerId,
    score: weightedCarrierScore('pass', bestPass.score, context),
  });
  return candidates.sort((a, b) => b.score - a.score || a.kind.localeCompare(b.kind))[0]!;
}

function oppositeSide(value: number, magnitude: number): number {
  if (Math.abs(value) < 0.5) return magnitude;
  return value > 0 ? -magnitude : magnitude;
}

export function chooseOffBallAction(
  world: Readonly<BotWorldSnapshot>,
  playerId: string,
  assignedRole: BotRole,
  context?: Readonly<BotDecisionContext>,
): OffBallActionDecision {
  const player = findPlayer(world, playerId);
  const direction = attackingDirection(player.team);
  const carrier = world.possessionTeam === player.team && world.possessionPlayerId
    ? findPlayer(world, world.possessionPlayerId)
    : null;
  const coordinated = context?.coordinatedRunFrequency ?? 0.64;

  if (!carrier || carrier.id === player.id) {
    return {
      kind: 'recycle',
      targetPosition: fieldClamp(world, {
        x: player.position.x * 0.55,
        y: 0,
        z: world.ball.position.z - direction * 5.2,
      }),
      score: weightedOffBallScore('recycle', 0.52, context),
    };
  }

  const progress = direction * carrier.position.z;
  const finalThird = progress > world.field.halfLength * 0.50;
  const ballWide = Math.abs(carrier.position.x) > world.field.halfWidth * 0.36;
  const farSide = carrier.position.x * player.position.x < 0;
  if (assignedRole === 'width-support' && finalThird && ballWide && farSide && coordinated >= 0.45) {
    const targetX = oppositeSide(carrier.position.x, Math.min(world.field.halfWidth - 1, 4.8));
    return {
      kind: 'back-post-run',
      targetPosition: fieldClamp(world, {
        x: targetX,
        y: 0,
        z: opponentGoalZ(world, player.team) - direction * 3.2,
      }, 0.8),
      score: weightedOffBallScore('back-post-run', 0.72 + coordinated * 0.14, context),
    };
  }

  if (assignedRole === 'width-support') {
    const preferredSide = Math.abs(player.position.x) > 1
      ? Math.sign(player.position.x)
      : -Math.sign(carrier.position.x || 1);
    const width = Math.max(6.2, world.field.halfWidth * 0.62);
    const widthTarget = fieldClamp(world, {
      x: preferredSide * width,
      y: 0,
      z: carrier.position.z + direction * 2.8,
    }, 0.8);
    const halfSpaceTarget = fieldClamp(world, {
      x: preferredSide * Math.min(4.6, world.field.halfWidth * 0.40),
      y: 0,
      z: carrier.position.z + direction * 4.1,
    }, 0.8);
    const widthScore = weightedOffBallScore('width', 0.60 + coordinated * 0.14 + (Math.abs(carrier.position.x) < 3.5 ? 0.08 : 0), context);
    const halfSpaceScore = weightedOffBallScore('half-space', finalThird && Math.abs(carrier.position.x) > 4 ? 0.60 + coordinated * 0.12 : 0.48 + coordinated * 0.05, context);
    return widthScore >= halfSpaceScore
      ? { kind: 'width', targetPosition: widthTarget, score: widthScore }
      : { kind: 'half-space', targetPosition: halfSpaceTarget, score: halfSpaceScore };
  }

  if (assignedRole === 'immediate-support') {
    const side = player.position.x >= carrier.position.x ? 1 : -1;
    const supportTarget = fieldClamp(world, {
      x: carrier.position.x + side * 4.2,
      y: 0,
      z: carrier.position.z + direction * 1.7,
    }, 0.8);
    const overlapTarget = fieldClamp(world, {
      x: carrier.position.x + side * 5.4,
      y: 0,
      z: carrier.position.z + direction * 5.0,
    }, 0.8);
    const supportScore = weightedOffBallScore('support', 0.72, context);
    const overlapScore = weightedOffBallScore('overlap', finalThird && Math.abs(carrier.position.x) > 2.5 ? 0.50 + coordinated * 0.28 : 0.40 + coordinated * 0.10, context);
    return supportScore >= overlapScore
      ? { kind: 'support', targetPosition: supportTarget, score: supportScore }
      : { kind: 'overlap', targetPosition: overlapTarget, score: overlapScore };
  }

  return {
    kind: 'recycle',
    targetPosition: fieldClamp(world, {
      x: carrier.position.x * 0.45,
      y: 0,
      z: carrier.position.z - direction * 5.8,
    }, 0.8),
    score: weightedOffBallScore('recycle', 0.56, context),
  };
}

export function chooseDefensiveAction(
  world: Readonly<BotWorldSnapshot>,
  defenderId: string,
  context?: Readonly<BotDecisionContext>,
): DefensiveActionDecision {
  const defender = findPlayer(world, defenderId);
  const direction = attackingDirection(defender.team);
  const anticipation = context?.defensiveAnticipation ?? 0.60;
  const fieldPlayers = teamPlayers(world, defender.team).filter((player) => !player.goalkeeper);
  const nearest = [...fieldPlayers].sort((a, b) => horizontalDistance(a.position, world.ball.position) - horizontalDistance(b.position, world.ball.position) || (a.id < b.id ? -1 : 1))[0];
  const distanceToBall = horizontalDistance(defender.position, world.ball.position);
  const opponentCarrier = world.possessionPlayerId
    ? world.players.find((player) => player.id === world.possessionPlayerId && player.team !== defender.team) ?? null
    : null;

  const pressRadius = 4.8 + anticipation;
  if (nearest?.id === defenderId && distanceToBall < pressRadius) {
    const target = opponentCarrier ? opponentCarrier.position : world.ball.position;
    const kind: DefensiveActionDecision['kind'] = distanceToBall < 1.8 + anticipation * 0.65 ? 'intercept' : 'press';
    return {
      kind,
      targetPosition: fieldClamp(world, { ...target, y: 0 }),
      score: weightedDefenseScore(kind, clamp01(0.70 + (pressRadius - distanceToBall) * 0.04), context),
    };
  }

  const goalZ = ownGoalZ(world, defender.team);
  if (opponentCarrier) {
    const carrierGoalDistance = horizontalDistance(opponentCarrier.position, { x: 0, y: 0, z: goalZ });
    const dangerousShot = carrierGoalDistance < 9.5 + anticipation * 1.8 && shotQuality(world, opponentCarrier.id) > 0.50 - anticipation * 0.04;
    if (dangerousShot) {
      return {
        kind: 'block-shot',
        targetPosition: fieldClamp(world, {
          x: opponentCarrier.position.x * 0.62,
          y: 0,
          z: opponentCarrier.position.z + (goalZ - opponentCarrier.position.z) * 0.38,
        }, 0.55),
        score: weightedDefenseScore('block-shot', clamp01(0.72 + anticipation * 0.08 + (10.5 - carrierGoalDistance) * 0.018), context),
      };
    }

    const receivers = opponentsOf(world, defender.team)
      .filter((player) => !player.goalkeeper && player.id !== opponentCarrier.id)
      .map((receiver) => ({ receiver, lane: evaluatePassLane(world, opponentCarrier.id, receiver.id) }))
      .sort((a, b) => b.lane.openness - a.lane.openness || (a.receiver.id < b.receiver.id ? -1 : 1));
    const bestLane = receivers[0];
    if (bestLane && bestLane.lane.openness > 0.64 - anticipation * 0.10) {
      const blockTarget = fieldClamp(world, {
        x: opponentCarrier.position.x + (bestLane.lane.target.x - opponentCarrier.position.x) * 0.48,
        y: 0,
        z: opponentCarrier.position.z + (bestLane.lane.target.z - opponentCarrier.position.z) * 0.48,
      }, 0.6);
      const goalSide = direction * (opponentCarrier.position.z - blockTarget.z) > 0.1;
      if (goalSide) {
        return {
          kind: 'block-lane',
          targetPosition: blockTarget,
          score: weightedDefenseScore('block-lane', clamp01(0.55 + anticipation * 0.07 + bestLane.lane.openness * 0.23), context),
        };
      }
    }
  }

  const goalSideZ = world.ball.position.z - direction * Math.max(4, Math.min(7, horizontalDistance(world.ball.position, { x: 0, y: 0, z: goalZ }) * 0.26));
  const target = fieldClamp(world, {
    x: world.ball.position.x * 0.38 + defender.position.x * 0.12,
    y: 0,
    z: goalSideZ,
  });
  const betweenBallAndGoal = direction * (world.ball.position.z - target.z) > 0;
  const kind: DefensiveActionDecision['kind'] = betweenBallAndGoal ? 'recover-goal-side' : 'cover';
  return {
    kind,
    targetPosition: target,
    score: weightedDefenseScore(kind, clamp01(0.60 + anticipation * 0.05 + Math.min(0.25, distanceToBall / 24)), context),
  };
}
