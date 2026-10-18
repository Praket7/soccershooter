import { buildBotPerception, teamPressure } from './perception';
import {
  attackingDirection,
  horizontalDistance,
  opponentsOf,
  phaseForTeam,
  teamPlayers,
  type BotPlayerSnapshot,
  type BotWorldSnapshot,
  type TeamId,
  type TeamPhase,
} from './types';

export interface TacticalBlackboard {
  team: TeamId;
  phase: TeamPhase;
  carrierId: string | null;
  goalkeeper: BotPlayerSnapshot | null;
  fieldPlayers: BotPlayerSnapshot[];
  opponents: BotPlayerSnapshot[];
  nearestOwnPlayerToBallId: string | null;
  ballProgress: number;
  averagePressure: number;
  possessionConfidence: number;
}

export function buildTacticalBlackboard(
  world: Readonly<BotWorldSnapshot>,
  team: TeamId,
): TacticalBlackboard {
  const players = teamPlayers(world, team);
  const fieldPlayers = players.filter((player) => !player.goalkeeper);
  const goalkeeper = players.find((player) => player.goalkeeper) ?? null;
  let nearestOwnPlayerToBallId: string | null = null;
  let nearestDistance = Number.POSITIVE_INFINITY;
  for (const player of fieldPlayers) {
    const distance = horizontalDistance(player.position, world.ball.position);
    if (distance < nearestDistance || (distance === nearestDistance && player.id < (nearestOwnPlayerToBallId ?? '\uffff'))) {
      nearestDistance = distance;
      nearestOwnPlayerToBallId = player.id;
    }
  }
  const phase = phaseForTeam(world, team);
  const carrierId = world.possessionTeam === team ? world.possessionPlayerId : null;
  const direction = attackingDirection(team);
  const normalizedProgress = (world.ball.position.z * direction + world.field.halfLength) / (world.field.halfLength * 2);
  const confidence = carrierId
    ? buildBotPerception(world, carrierId).possessionProbability
    : nearestOwnPlayerToBallId
      ? buildBotPerception(world, nearestOwnPlayerToBallId).possessionProbability
      : 0;
  return {
    team,
    phase,
    carrierId,
    goalkeeper,
    fieldPlayers,
    opponents: opponentsOf(world, team),
    nearestOwnPlayerToBallId,
    ballProgress: Math.max(0, Math.min(1, normalizedProgress)),
    averagePressure: teamPressure(world, team),
    possessionConfidence: confidence,
  };
}
