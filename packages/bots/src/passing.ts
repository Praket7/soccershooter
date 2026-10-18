import { estimatePlayerTimeToPoint, nominalPassSpeed } from './intercepts';
import {
  attackingDirection,
  clamp01,
  dotHorizontal,
  facingDirection,
  fieldClamp,
  findPlayer,
  horizontalDistance,
  opponentsOf,
  opponentGoalZ,
  teamPlayers,
  type BotPlayerSnapshot,
  type BotWorldSnapshot,
  type TeamId,
  type Vec3,
} from './types';

export interface PassLaneEvaluation {
  openness: number;
  interceptionMarginSeconds: number;
  mostDangerousDefenderId: string | null;
  target: Vec3;
}

export interface PlannedPass {
  fromPlayerId: string;
  toPlayerId: string;
  target: Vec3;
  score: number;
}

function targetForReceiver(
  world: Readonly<BotWorldSnapshot>,
  passer: Readonly<BotPlayerSnapshot>,
  receiver: Readonly<BotPlayerSnapshot>,
): Vec3 {
  const distance = horizontalDistance(passer.position, receiver.position);
  const travel = distance / nominalPassSpeed(distance);
  return fieldClamp(world, {
    x: receiver.position.x + receiver.velocity.x * travel * 0.65,
    y: 0,
    z: receiver.position.z + receiver.velocity.z * travel * 0.65,
  }, 0.8);
}

function segmentPoint(a: Readonly<Vec3>, b: Readonly<Vec3>, t: number): Vec3 {
  return { x: a.x + (b.x - a.x) * t, y: 0, z: a.z + (b.z - a.z) * t };
}

export function evaluatePassLane(
  world: Readonly<BotWorldSnapshot>,
  passerId: string,
  receiverId: string,
): PassLaneEvaluation {
  const passer = findPlayer(world, passerId);
  const receiver = findPlayer(world, receiverId);
  if (passer.team !== receiver.team || passer.id === receiver.id) {
    return { openness: 0, interceptionMarginSeconds: -10, mostDangerousDefenderId: null, target: { ...receiver.position } };
  }
  const target = targetForReceiver(world, passer, receiver);
  const totalDistance = horizontalDistance(passer.position, target);
  const ballSpeed = nominalPassSpeed(totalDistance);
  let minimumMargin = Number.POSITIVE_INFINITY;
  let mostDangerousDefenderId: string | null = null;
  const defenders = opponentsOf(world, passer.team).filter((player) => !player.goalkeeper || totalDistance > 7);
  for (let sample = 2; sample <= 11; sample += 1) {
    const t = sample / 12;
    const point = segmentPoint(passer.position, target, t);
    const ballTime = (totalDistance * t) / ballSpeed;
    for (const defender of defenders) {
      const defenderTime = estimatePlayerTimeToPoint(defender, point);
      const margin = defenderTime - ballTime;
      if (margin < minimumMargin || (margin === minimumMargin && defender.id < (mostDangerousDefenderId ?? '\uffff'))) {
        minimumMargin = margin;
        mostDangerousDefenderId = defender.id;
      }
    }
  }
  if (!Number.isFinite(minimumMargin)) minimumMargin = 2;
  // Roughly -0.1 s or worse is effectively closed; ~0.55 s of defender
  // disadvantage is a very open lane. Continuous scoring avoids binary jitter.
  const openness = clamp01((minimumMargin + 0.10) / 0.65);
  return { openness, interceptionMarginSeconds: minimumMargin, mostDangerousDefenderId, target };
}

export function receiverOrientationScore(
  passer: Readonly<BotPlayerSnapshot>,
  receiver: Readonly<BotPlayerSnapshot>,
): number {
  const incoming = { x: passer.position.x - receiver.position.x, z: passer.position.z - receiver.position.z };
  const facing = facingDirection(receiver.facingYaw);
  const dot = dotHorizontal(facing, incoming);
  // A receiver does not need to stare at the passer, but being completely
  // closed to the incoming ball should reduce tactical desirability.
  return clamp01((dot + 0.45) / 1.25);
}

export function supportAngleScore(
  carrier: Readonly<BotPlayerSnapshot>,
  receiver: Readonly<BotPlayerSnapshot>,
  opponentGoal: Readonly<Vec3>,
): number {
  const toGoal = { x: opponentGoal.x - carrier.position.x, z: opponentGoal.z - carrier.position.z };
  const toReceiver = { x: receiver.position.x - carrier.position.x, z: receiver.position.z - carrier.position.z };
  const cosine = dotHorizontal(toGoal, toReceiver);
  const angle = Math.acos(cosine) * 180 / Math.PI;
  const ideal = 48;
  return clamp01(1 - Math.abs(angle - ideal) / 70);
}

export function expectedThreatAtPoint(
  world: Readonly<BotWorldSnapshot>,
  team: TeamId,
  point: Readonly<Vec3>,
): number {
  const direction = attackingDirection(team);
  const progress = (point.z * direction + world.field.halfLength) / (world.field.halfLength * 2);
  const centrality = 1 - Math.min(1, Math.abs(point.x) / Math.max(1, world.field.halfWidth));
  const goalDistance = Math.hypot(point.x, opponentGoalZ(world, team) - point.z);
  const closeGoal = clamp01(1 - goalDistance / (world.field.halfLength * 1.1));
  return clamp01(progress * 0.48 + centrality * 0.18 + closeGoal * 0.34);
}

export function scorePassOption(
  world: Readonly<BotWorldSnapshot>,
  passerId: string,
  receiverId: string,
): number {
  const passer = findPlayer(world, passerId);
  const receiver = findPlayer(world, receiverId);
  const lane = evaluatePassLane(world, passerId, receiverId);
  const orientation = receiverOrientationScore(passer, receiver);
  const supportAngle = supportAngleScore(passer, receiver, { x: 0, y: 0, z: opponentGoalZ(world, passer.team) });
  const currentThreat = expectedThreatAtPoint(world, passer.team, passer.position);
  const targetThreat = expectedThreatAtPoint(world, passer.team, lane.target);
  const threatGain = clamp01(0.5 + (targetThreat - currentThreat));
  const distance = horizontalDistance(passer.position, lane.target);
  const distanceFit = clamp01(1 - Math.abs(distance - 8.5) / 15);
  return clamp01(
    lane.openness * 0.48
    + orientation * 0.12
    + supportAngle * 0.13
    + threatGain * 0.19
    + distanceFit * 0.08,
  );
}

function cloneWorld(world: Readonly<BotWorldSnapshot>): BotWorldSnapshot {
  return {
    ...world,
    field: { ...world.field },
    ball: { position: { ...world.ball.position }, velocity: { ...world.ball.velocity } },
    players: world.players.map((player) => ({
      ...player,
      position: { ...player.position },
      velocity: { ...player.velocity },
    })),
  };
}

export function planPassChain(
  world: Readonly<BotWorldSnapshot>,
  team: TeamId,
  maxPasses: number,
): PlannedPass[] {
  const count = Math.max(0, Math.min(8, Math.floor(maxPasses)));
  if (count === 0) return [];
  const virtual = cloneWorld(world);
  let carrierId = virtual.possessionTeam === team ? virtual.possessionPlayerId : null;
  if (!carrierId) {
    const candidates = teamPlayers(virtual, team).filter((player) => !player.goalkeeper);
    carrierId = candidates.sort((a, b) => horizontalDistance(a.position, virtual.ball.position) - horizontalDistance(b.position, virtual.ball.position))[0]?.id ?? null;
  }
  if (!carrierId) return [];
  const passes: PlannedPass[] = [];
  const usedEdges = new Set<string>();
  const direction = attackingDirection(team);
  for (let step = 0; step < count; step += 1) {
    const carrier = findPlayer(virtual, carrierId);
    const options = teamPlayers(virtual, team)
      .filter((candidate) => candidate.id !== carrierId && !candidate.goalkeeper)
      .map((candidate) => {
        const edge = `${carrierId}->${candidate.id}`;
        const tactical = scorePassOption(virtual, carrierId!, candidate.id);
        const progress = clamp01(0.5 + direction * (candidate.position.z - carrier.position.z) / (virtual.field.halfLength * 1.1));
        const repeatPenalty = usedEdges.has(edge) ? 0.5 : 1;
        return { candidate, edge, score: clamp01((tactical * 0.78 + progress * 0.22) * repeatPenalty) };
      })
      .sort((a, b) => b.score - a.score || (a.candidate.id < b.candidate.id ? -1 : 1));
    const chosen = options[0];
    if (!chosen || chosen.score < 0.28) break;
    const lane = evaluatePassLane(virtual, carrierId, chosen.candidate.id);
    passes.push({ fromPlayerId: carrierId, toPlayerId: chosen.candidate.id, target: { ...lane.target }, score: chosen.score });
    usedEdges.add(chosen.edge);
    const receiver = findPlayer(virtual, chosen.candidate.id);
    receiver.position = { ...lane.target };
    virtual.ball.position = { ...lane.target };
    virtual.possessionPlayerId = receiver.id;
    // Anticipatory off-ball movement: after each completed pass, non-carriers
    // advance into new support windows instead of freezing at the original snapshot.
    for (const teammate of teamPlayers(virtual, team)) {
      if (teammate.goalkeeper || teammate.id === receiver.id) continue;
      teammate.position = fieldClamp(virtual, {
        ...teammate.position,
        z: teammate.position.z + direction * 4.8,
      }, 0.9);
    }
    carrierId = receiver.id;
  }
  return passes;
}
