import {
  clamp01,
  findPlayer,
  horizontalDistance,
  opponentsOf,
  opponentGoalZ,
  ownGoalZ,
  teamPlayers,
  type BotPlayerSnapshot,
  type BotWorldSnapshot,
  type TeamId,
  type Vec3,
} from './types';

export interface BotPerception {
  self: BotPlayerSnapshot;
  teammates: BotPlayerSnapshot[];
  opponents: BotPlayerSnapshot[];
  ballDistance: number;
  nearestOpponentDistance: number;
  pressure: number;
  possessionProbability: number;
  hasTeamPossession: boolean;
  predictedBall: Vec3;
  ownGoal: Vec3;
  opponentGoal: Vec3;
}

function nearestDistance(origin: Readonly<Vec3>, players: readonly BotPlayerSnapshot[]): number {
  let nearest = Number.POSITIVE_INFINITY;
  for (const player of players) nearest = Math.min(nearest, horizontalDistance(origin, player.position));
  return nearest;
}

function loosePossessionProbability(
  world: Readonly<BotWorldSnapshot>,
  player: Readonly<BotPlayerSnapshot>,
): number {
  const ownDistance = horizontalDistance(player.position, world.ball.position);
  const opponentDistance = nearestDistance(world.ball.position, opponentsOf(world, player.team));
  const teammateDistance = Math.min(
    ownDistance,
    ...teamPlayers(world, player.team).filter((candidate) => candidate.id !== player.id)
      .map((candidate) => horizontalDistance(candidate.position, world.ball.position)),
  );
  if (!Number.isFinite(opponentDistance)) return 1;
  const advantage = opponentDistance - teammateDistance;
  return clamp01(0.5 + advantage / 6);
}

export function buildBotPerception(
  world: Readonly<BotWorldSnapshot>,
  playerId: string,
  predictionHorizonSeconds = 0.35,
): BotPerception {
  const self = findPlayer(world, playerId);
  const teammates = teamPlayers(world, self.team).filter((player) => player.id !== self.id);
  const opponents = opponentsOf(world, self.team);
  const nearestOpponentDistance = nearestDistance(self.position, opponents);
  const pressure = Number.isFinite(nearestOpponentDistance)
    ? clamp01((4.5 - nearestOpponentDistance) / 4.5)
    : 0;
  const possessionProbability = world.possessionTeam === self.team
    ? 1
    : world.possessionTeam === null
      ? loosePossessionProbability(world, self)
      : 0;
  const horizon = Math.max(0, Math.min(1.2, predictionHorizonSeconds));
  return {
    self,
    teammates,
    opponents,
    ballDistance: horizontalDistance(self.position, world.ball.position),
    nearestOpponentDistance,
    pressure,
    possessionProbability,
    hasTeamPossession: world.possessionTeam === self.team,
    predictedBall: {
      x: world.ball.position.x + world.ball.velocity.x * horizon,
      y: Math.max(0, world.ball.position.y + world.ball.velocity.y * horizon),
      z: world.ball.position.z + world.ball.velocity.z * horizon,
    },
    ownGoal: { x: 0, y: 0, z: ownGoalZ(world, self.team) },
    opponentGoal: { x: 0, y: 0, z: opponentGoalZ(world, self.team) },
  };
}

export function teamPressure(world: Readonly<BotWorldSnapshot>, team: TeamId): number {
  const players = teamPlayers(world, team).filter((player) => !player.goalkeeper);
  if (players.length === 0) return 0;
  return players.reduce((sum, player) => sum + buildBotPerception(world, player.id).pressure, 0) / players.length;
}
