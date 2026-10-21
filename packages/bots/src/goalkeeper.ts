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

const REGULATION_GOAL_HEIGHT = 2.44;
const TACTICAL_GRAVITY = 9.81;

export function goalkeeperHomePosition(
  world: Readonly<BotWorldSnapshot>,
  goalkeeperId: string,
): Vec3 {
  const goalkeeper = findPlayer(world, goalkeeperId);
  const direction = attackingDirection(goalkeeper.team);
  const goalZ = ownGoalZ(world, goalkeeper.team);
  const distanceFromGoal = horizontalDistance(world.ball.position, { x: 0, y: 0, z: goalZ });
  const depthFromLine = clamp(1.05 + distanceFromGoal * 0.035, 1.05, 2.25);
  const targetZ = goalZ + direction * depthFromLine;

  // Stay on the center line between the ball and the middle of goal. This
  // covers the shooting angle geometrically instead of overreacting laterally
  // to the ball's raw X coordinate.
  const ballDepth = Math.max(0.75, direction * (world.ball.position.z - goalZ));
  const projectedX = world.ball.position.x * depthFromLine / ballDepth;
  return fieldClamp(world, {
    x: clamp(projectedX, -world.field.goalHalfWidth + 0.32, world.field.goalHalfWidth - 0.32),
    y: 0,
    z: targetZ,
  }, 0.3);
}

function projectedGoalCrossing(
  world: Readonly<BotWorldSnapshot>,
  teamDirection: 1 | -1,
): { eta: number; x: number; y: number } | null {
  const goalZ = -teamDirection * world.field.halfLength;
  const vz = world.ball.velocity.z;
  if (Math.abs(vz) < 0.4 || vz * teamDirection >= 0) return null;
  const eta = (goalZ - world.ball.position.z) / vz;
  if (eta <= 0 || eta > 2.2) return null;

  const airborne = world.ball.position.y > 0.3 || Math.abs(world.ball.velocity.y) > 0.75;
  const projectedY = airborne
    ? world.ball.position.y + world.ball.velocity.y * eta - 0.5 * TACTICAL_GRAVITY * eta * eta
    : world.ball.position.y;
  const goalHeight = world.field.goalHeight ?? REGULATION_GOAL_HEIGHT;
  if (projectedY < -0.15 || projectedY > goalHeight + 0.15) return null;

  return {
    eta,
    x: world.ball.position.x + world.ball.velocity.x * eta,
    y: projectedY,
  };
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
  const claimDepth = clamp(requestedDepth, 1.0, 5.2);
  return fieldClamp(world, {
    x: clamp(interceptPoint.x, -world.field.goalHalfWidth - 1.1, world.field.goalHalfWidth + 1.1),
    y: 0,
    z: goalZ + direction * claimDepth,
  }, 0.35);
}

function ballIsLooseEnoughToClaim(world: Readonly<BotWorldSnapshot>, goalkeeperId: string): boolean {
  const goalkeeper = findPlayer(world, goalkeeperId);
  if (world.possessionTeam === null || world.possessionPlayerId === null) return true;
  if (world.possessionTeam === goalkeeper.team) return false;

  const carrier = findPlayer(world, world.possessionPlayerId);
  const controlDistance = horizontalDistance(carrier.position, world.ball.position);
  const ballSpeed = Math.hypot(world.ball.velocity.x, world.ball.velocity.z);
  // Possession labels can lag a heavy touch. Only treat a nominally possessed
  // ball as claimable when it has genuinely escaped the carrier's control area.
  return controlDistance > 1.4 || (controlDistance > 0.9 && ballSpeed > 4.5);
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
      .map((player) => ({
        player,
        // Keep goalkeeper distribution short and controlled. A keeper should
        // not choose a speculative through-ball while teammates are available
        // nearby to receive a safe outlet.
        score: scorePassOption(world, goalkeeperId, player.id) - horizontalDistance(goalkeeper.position, player.position) * 0.035,
      }))
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
  const closeDanger = horizontalDistance(world.ball.position, { x: 0, y: 0, z: ownGoalZ(world, goalkeeper.team) }) < 8.0;
  const nearbyLooseBall = horizontalDistance(goalkeeper.position, world.ball.position) <= 3.8;
  if (closeDanger && ballIsLooseEnoughToClaim(world, goalkeeperId)
    && (nearbyLooseBall || (intercept.reachable && intercept.timeSeconds <= 1.05))) {
    return { kind: 'claim', targetPosition: boundedClaimTarget(world, goalkeeperId, intercept.point), distributionTargetId: null };
  }
  return { kind: 'position', targetPosition: home, distributionTargetId: null };
}
