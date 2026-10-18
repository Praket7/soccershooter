import { buildBotPerception } from './perception';
import { evaluatePassLane, expectedThreatAtPoint, scorePassOption } from './passing';
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
  type BotWorldSnapshot,
  type Vec3,
} from './types';

export interface CarrierActionDecision {
  kind: 'shoot' | 'pass' | 'dribble' | 'protect' | 'clear';
  targetPlayerId: string | null;
  score: number;
}

export interface DefensiveActionDecision {
  kind: 'press' | 'cover' | 'block-lane' | 'block-shot' | 'intercept' | 'recover-goal-side';
  targetPosition: Vec3;
  score: number;
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
): CarrierActionDecision {
  const carrier = findPlayer(world, carrierId);
  const perception = buildBotPerception(world, carrierId);
  const direction = attackingDirection(carrier.team);
  const ownDanger = clamp01((6.5 - direction * (carrier.position.z - ownGoalZ(world, carrier.team))) / 6.5);
  const shoot = shotQuality(world, carrierId) * (1 - perception.pressure * 0.12);
  let bestPass: { playerId: string; score: number } | null = null;
  for (const receiver of teamPlayers(world, carrier.team)) {
    if (receiver.id === carrierId || receiver.goalkeeper) continue;
    const lane = evaluatePassLane(world, carrierId, receiver.id);
    const base = scorePassOption(world, carrierId, receiver.id);
    const pressureBonus = perception.pressure * lane.openness * 0.22;
    const score = clamp01(base + pressureBonus);
    if (!bestPass || score > bestPass.score || (score === bestPass.score && receiver.id < bestPass.playerId)) {
      bestPass = { playerId: receiver.id, score };
    }
  }
  const forwardSpace = clamp01(1 - perception.pressure);
  const dribble = clamp01(0.36 + forwardSpace * 0.32 + expectedThreatAtPoint(world, carrier.team, carrier.position) * 0.12 - perception.pressure * 0.30);
  const protect = clamp01(0.18 + perception.pressure * 0.58);
  const clear = clamp01(ownDanger * (0.5 + perception.pressure * 0.35));
  const candidates: CarrierActionDecision[] = [
    { kind: 'shoot', targetPlayerId: null, score: shoot },
    { kind: 'dribble', targetPlayerId: null, score: dribble },
    { kind: 'protect', targetPlayerId: null, score: protect },
    { kind: 'clear', targetPlayerId: null, score: clear },
  ];
  if (bestPass) candidates.push({ kind: 'pass', targetPlayerId: bestPass.playerId, score: bestPass.score });
  return candidates.sort((a, b) => b.score - a.score || a.kind.localeCompare(b.kind))[0]!;
}

export function chooseDefensiveAction(
  world: Readonly<BotWorldSnapshot>,
  defenderId: string,
): DefensiveActionDecision {
  const defender = findPlayer(world, defenderId);
  const direction = attackingDirection(defender.team);
  const fieldPlayers = teamPlayers(world, defender.team).filter((player) => !player.goalkeeper);
  const nearest = [...fieldPlayers].sort((a, b) => horizontalDistance(a.position, world.ball.position) - horizontalDistance(b.position, world.ball.position) || (a.id < b.id ? -1 : 1))[0];
  const distanceToBall = horizontalDistance(defender.position, world.ball.position);
  if (nearest?.id === defenderId && distanceToBall < 5.4) {
    const opponentCarrier = world.possessionPlayerId ? world.players.find((player) => player.id === world.possessionPlayerId) : null;
    const target = opponentCarrier?.team !== defender.team ? opponentCarrier.position : world.ball.position;
    return { kind: distanceToBall < 2.2 ? 'intercept' : 'press', targetPosition: fieldClamp(world, { ...target, y: 0 }), score: clamp01(0.72 + (5.4 - distanceToBall) * 0.04) };
  }
  const goalZ = ownGoalZ(world, defender.team);
  const goalSideZ = world.ball.position.z - direction * Math.max(4, Math.min(7, horizontalDistance(world.ball.position, { x: 0, y: 0, z: goalZ }) * 0.26));
  const target = fieldClamp(world, {
    x: world.ball.position.x * 0.38 + defender.position.x * 0.12,
    y: 0,
    z: goalSideZ,
  });
  const betweenBallAndGoal = direction * (world.ball.position.z - target.z) > 0;
  return {
    kind: betweenBallAndGoal ? 'recover-goal-side' : 'cover',
    targetPosition: target,
    score: clamp01(0.62 + Math.min(0.25, distanceToBall / 24)),
  };
}
