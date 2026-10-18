import { predictBallIntercept } from './intercepts';
import { scorePassOption } from './passing';
import {
  attackingDirection,
  clamp,
  fieldClamp,
  findPlayer,
  horizontalDistance,
  ownGoalZ,
  teamPlayers,
  type BotWorldSnapshot,
  type Vec3,
} from './types';

export interface GoalkeeperDecision {
  kind: 'position' | 'claim' | 'dive' | 'parry' | 'distribute';
  targetPosition: Vec3;
  distributionTargetId: string | null;
}

export function goalkeeperHomePosition(
  world: Readonly<BotWorldSnapshot>,
  goalkeeperId: string,
): Vec3 {
  const goalkeeper = findPlayer(world, goalkeeperId);
  const direction = attackingDirection(goalkeeper.team);
  const goalZ = ownGoalZ(world, goalkeeper.team);
  const depthFromLine = clamp(
    1.05 + horizontalDistance(world.ball.position, { x: 0, y: 0, z: goalZ }) * 0.035,
    1.05,
    2.25,
  );
  const targetZ = goalZ + direction * depthFromLine;
  const ballDepth = Math.max(2.5, Math.abs(world.ball.position.z - goalZ));
  const projectedX = world.ball.position.x * Math.min(0.44, depthFromLine / ballDepth + 0.22);
  return fieldClamp(world, {
    x: clamp(projectedX, -world.field.goalHalfWidth + 0.32, world.field.goalHalfWidth - 0.32),
    y: 0,
    z: targetZ,
  }, 0.3);
}

function projectedGoalCrossing(
  world: Readonly<BotWorldSnapshot>,
  teamDirection: 1 | -1,
): { eta: number; x: number } | null {
  const goalZ = -teamDirection * world.field.halfLength;
  const vz = world.ball.velocity.z;
  if (Math.abs(vz) < 0.4 || vz * teamDirection >= 0) return null;
  const eta = (goalZ - world.ball.position.z) / vz;
  if (eta <= 0 || eta > 2.2) return null;
  return { eta, x: world.ball.position.x + world.ball.velocity.x * eta };
}

function boundedClaimTarget(
  world: Readonly<BotWorldSnapshot>,
  goalkeeperId: string,
  interceptPoint: Readonly<Vec3>,
): Vec3 {
  const goalkeeper = findPlayer(world, goalkeeperId);
  const direction = attackingDirection(goalkeeper.team);
  const goalZ = ownGoalZ(world, goalkeeper.team);
  const requestedDepth = direction * (interceptPoint.z - goalZ);
  const claimDepth = clamp(requestedDepth, 1.0, 3.35);
  return fieldClamp(world, {
    x: clamp(interceptPoint.x, -world.field.goalHalfWidth - 1.1, world.field.goalHalfWidth + 1.1),
    y: 0,
    z: goalZ + direction * claimDepth,
  }, 0.35);
}

export function computeGoalkeeperDecision(
  world: Readonly<BotWorldSnapshot>,
  goalkeeperId: string,
): GoalkeeperDecision {
  const goalkeeper = findPlayer(world, goalkeeperId);
  if (!goalkeeper.goalkeeper) throw new TypeError(`${goalkeeperId} is not marked as a goalkeeper`);
  const home = goalkeeperHomePosition(world, goalkeeperId);
  if (world.possessionTeam === goalkeeper.team && world.possessionPlayerId === goalkeeperId) {
    const targets = teamPlayers(world, goalkeeper.team)
      .filter((player) => player.id !== goalkeeperId && !player.goalkeeper)
      .map((player) => ({ player, score: scorePassOption(world, goalkeeperId, player.id) }))
      .sort((a, b) => b.score - a.score || (a.player.id < b.player.id ? -1 : 1));
    return { kind: 'distribute', targetPosition: home, distributionTargetId: targets[0]?.player.id ?? null };
  }
  const crossing = projectedGoalCrossing(world, attackingDirection(goalkeeper.team));
  if (crossing && Math.abs(crossing.x) <= world.field.goalHalfWidth + 0.55) {
    const target = fieldClamp(world, {
      x: clamp(crossing.x, -world.field.goalHalfWidth + 0.18, world.field.goalHalfWidth - 0.18),
      y: 0,
      z: home.z,
    }, 0.25);
    const need = horizontalDistance(goalkeeper.position, target);
    return { kind: crossing.eta < 0.48 || need > 1.45 ? 'dive' : 'parry', targetPosition: target, distributionTargetId: null };
  }
  const intercept = predictBallIntercept(goalkeeper, world.ball, 1.25);
  const closeDanger = horizontalDistance(world.ball.position, { x: 0, y: 0, z: ownGoalZ(world, goalkeeper.team) }) < 6.2;
  if (closeDanger && intercept.reachable && intercept.timeSeconds <= 0.95) {
    return { kind: 'claim', targetPosition: boundedClaimTarget(world, goalkeeperId, intercept.point), distributionTargetId: null };
  }
  return { kind: 'position', targetPosition: home, distributionTargetId: null };
}
