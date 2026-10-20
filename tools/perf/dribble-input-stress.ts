import { BALL_CONSTANTS, createBallState, type BallState } from '../../packages/physics/src/ball/BallState';
import { MATCH_BALL_PROFILE } from '../../packages/physics/src/ball/aerodynamics';
import { BALL_SUBSTEP_DT, stepBall } from '../../packages/physics/src/ball/trajectory';
import { createPlayerState, type PlayerState } from '../../packages/sim/src/player/PlayerState';
import { constrainBodyTurnToBall } from '../../packages/sim/src/player/athleticMotion';
import { createFlatMovementWorld, DEFAULT_MOVEMENT_CONFIG, stepPlayerMovement } from '../../packages/sim/src/player/movement';
import { createPlannedDribbleState, stepPlannedDribble, type PlannedDribbleState } from '../../packages/sim/src/football/dribblePlanner';
import type { FootballActorSnapshot, FootballBallSnapshot } from '../../packages/sim/src/football/types';
import { resolveDribbleIntent } from '../../apps/web/src/input/FootballControl';

const DT = 1 / 60;
const WORLD = createFlatMovementWorld({ minX: -100, maxX: 100, minZ: -100, maxZ: 100 });

interface InputSegment {
  ticks: number;
  moveX: number;
  moveY: number;
  sprint: boolean;
}

interface InputScenario {
  scenario: string;
  segments: readonly InputSegment[];
}

export interface DribbleInputStressResult {
  scenario: string;
  ticks: number;
  contacts: number;
  maxSeparationMeters: number;
  maxBehindMeters: number;
  ticksBeyondOneMeterRate: number;
  looseBallTicks: number;
  looseBallRate: number;
  failureReasons: Record<string, number>;
  firstFailure: { tick: number; reason: string; separationMeters: number; playerSpeed: number; ballSpeed: number } | null;
  meanBallPlayerSpeedDeltaMetersPerSecond: number;
  peak: {
    tick: number;
    segment: number;
    moveX: number;
    moveY: number;
    sprint: boolean;
    playerSpeed: number;
    ballSpeed: number;
    ballAheadMeters: number;
  };
  trailPeak: {
    tick: number;
    separationMeters: number;
    playerSpeed: number;
    ballSpeed: number;
    ballAheadMeters: number;
    contactApplied: boolean;
    reason: string;
    segment: number;
    moveX: number;
    moveY: number;
    playerVelocityX: number;
    playerVelocityZ: number;
    ballOffsetX: number;
    ballOffsetZ: number;
  };
}

const SCENARIOS: readonly InputScenario[] = [
  { scenario: 'forward-to-reverse', segments: [{ ticks: 90, moveX: 0, moveY: 1, sprint: false }, { ticks: 60, moveX: 0, moveY: -1, sprint: false }] },
  { scenario: 'left-to-right', segments: [{ ticks: 60, moveX: -1, moveY: 0, sprint: false }, { ticks: 60, moveX: 1, moveY: 0, sprint: false }] },
  { scenario: 'forward-lateral-slalom', segments: [
    { ticks: 45, moveX: 0, moveY: 1, sprint: false },
    { ticks: 30, moveX: -1, moveY: 1, sprint: false },
    { ticks: 30, moveX: 1, moveY: 1, sprint: false },
    { ticks: 30, moveX: -1, moveY: 1, sprint: false },
    { ticks: 30, moveX: 1, moveY: 1, sprint: false },
  ] },
  { scenario: 'rapid-jog-zigzag', segments: [
    { ticks: 60, moveX: 0, moveY: 1, sprint: false },
    ...Array.from({ length: 4 }, () => [
      { ticks: 15, moveX: -1, moveY: 1, sprint: false },
      { ticks: 15, moveX: 1, moveY: 1, sprint: false },
    ]).flat(),
  ] },
  { scenario: 'straight-sprint', segments: [{ ticks: 90, moveX: 0, moveY: 1, sprint: true }] },
  { scenario: 'sprint-to-lateral-cut', segments: [{ ticks: 90, moveX: 0, moveY: 1, sprint: true }, { ticks: 45, moveX: -1, moveY: 0, sprint: true }] },
  { scenario: 'sprint-reversal', segments: [{ ticks: 90, moveX: 0, moveY: 1, sprint: true }, { ticks: 60, moveX: 0, moveY: -1, sprint: true }] },
  ...(['jog', 'sprint'] as const).map((pace) => ({
    scenario: `continuous-circle-${pace}`,
    segments: Array.from({ length: 48 }, (_, index) => {
      const angle = (index * Math.PI) / 24;
      return { ticks: 10, moveX: -Math.cos(angle), moveY: Math.sin(angle), sprint: pace === 'sprint' };
    }),
  })),
  ...(['jog', 'sprint'] as const).map((pace) => ({
    scenario: `tight-circle-${pace}`,
    // Small heading changes every 3 frames produce a fast, tight continuous turn.
    segments: Array.from({ length: 120 }, (_, index) => {
      const angle = (index * Math.PI) / 18;
      return { ticks: 3, moveX: -Math.cos(angle), moveY: Math.sin(angle), sprint: pace === 'sprint' };
    }),
  })),
];

function actorSnapshot(player: Readonly<PlayerState>): FootballActorSnapshot {
  const speed = Math.hypot(player.velocity.x, player.velocity.z);
  const movementBalance = player.locomotion === 'sharp-cut' ? 0.68 : player.grounded ? 1 : 0.58;
  const speedBalance = Math.max(0.72, Math.min(1, 1 - Math.max(0, speed - DEFAULT_MOVEMENT_CONFIG.jogSpeed) * 0.035));
  return {
    position: { ...player.position },
    velocity: { ...player.velocity },
    facingYaw: speed > 0.35 ? Math.atan2(player.velocity.x, player.velocity.z) : player.facingYaw,
    balance: movementBalance * speedBalance,
    pressure: 0,
    sprinting: player.locomotion === 'sprint',
    preferredFoot: 'right',
  };
}

function ballSnapshot(ball: Readonly<BallState>): FootballBallSnapshot {
  return {
    position: { ...ball.position },
    velocity: { ...ball.velocity },
    angularVelocity: { ...ball.angularVelocity },
    radius: BALL_CONSTANTS.radius,
    mass: BALL_CONSTANTS.mass,
    grounded: ball.grounded,
  };
}

function simulateScenario(scenario: InputScenario): DribbleInputStressResult {
  let player = createPlayerState({ position: { x: 0, y: 0, z: 0 }, facingYaw: 0, stamina: DEFAULT_MOVEMENT_CONFIG.staminaMax });
  let ball = createBallState({ position: { x: 0, y: BALL_CONSTANTS.radius, z: 0.68 }, grounded: true });
  let dribble: PlannedDribbleState = createPlannedDribbleState();
  let tick = 0;
  let contacts = 0;
  let maxSeparationMeters = Math.hypot(player.position.x - ball.position.x, player.position.z - ball.position.z);
  let maxBehindMeters = 0;
  let ticksBeyondOneMeter = 0;
  let looseBallTicks = 0;
  const failureReasons: Record<string, number> = {};
  let firstFailure: DribbleInputStressResult['firstFailure'] = null;
  let speedDeltaSum = 0;
  let speedDeltaSamples = 0;
  let peak = { tick: 0, segment: 0, moveX: 0, moveY: 0, sprint: false, playerSpeed: 0, ballSpeed: 0, ballAheadMeters: 0 };
  let trailPeak: DribbleInputStressResult['trailPeak'] = {
    tick: 0,
    separationMeters: 0,
    playerSpeed: 0,
    ballSpeed: 0,
    ballAheadMeters: 0,
    contactApplied: false,
    reason: 'none',
    segment: 0,
    moveX: 0,
    moveY: 0,
    playerVelocityX: 0,
    playerVelocityZ: 0,
    ballOffsetX: 0,
    ballOffsetZ: 0,
  };

  for (const [segmentIndex, segment] of scenario.segments.entries()) {
    for (let frame = 0; frame < segment.ticks; frame += 1, tick += 1) {
      const intent = { moveX: segment.moveX, moveY: segment.moveY, aimYaw: 0, sprint: segment.sprint, actionBits: 0 };
      player = stepPlayerMovement(player, intent, WORLD, DT, DEFAULT_MOVEMENT_CONFIG);
      const movement = resolveDribbleIntent(intent, {
        x: Math.sin(player.facingYaw),
        z: Math.cos(player.facingYaw),
      });
      const planned = stepPlannedDribble({
        tick,
        state: dribble,
        actor: actorSnapshot(player),
        motion: player.athleticMotion,
        ball: ballSnapshot(ball),
        desiredDirection: movement.direction,
        precision: false,
        sprint: segment.sprint,
        pressure: 0,
        moveIntentMagnitude: movement.magnitude,
        receiveMode: null,
      });
      dribble = planned.state;
      if (!planned.contactApplied && !['awaiting-contact', 'contact-planned', 'idle-no-touch'].includes(planned.reason)) {
        failureReasons[planned.reason] = (failureReasons[planned.reason] ?? 0) + 1;
      }
      if (planned.contactApplied) {
        contacts += 1;
        ball = { ...ball, velocity: { ...planned.ball.velocity }, angularVelocity: { ...planned.ball.angularVelocity } };
      }
      if (dribble.looseBall) looseBallTicks += 1;
      ball = stepBall(ball, BALL_SUBSTEP_DT, MATCH_BALL_PROFILE, null);
      ball = stepBall(ball, BALL_SUBSTEP_DT, MATCH_BALL_PROFILE, null);

      if (!dribble.looseBall
        && Math.hypot(player.position.x - ball.position.x, player.position.z - ball.position.z) <= 1.5) {
        player.athleticMotion = constrainBodyTurnToBall(
          player.athleticMotion,
          player.position,
          ball.position,
          DT,
        );
      }

      const separation = Math.hypot(player.position.x - ball.position.x, player.position.z - ball.position.z);
      const speedForHeading = Math.hypot(player.velocity.x, player.velocity.z);
      const travelYaw = speedForHeading > 0.1
        ? Math.atan2(player.velocity.x, player.velocity.z)
        : player.athleticMotion.bodyYaw;
      const bodyTravelDelta = Math.atan2(
        Math.sin(player.athleticMotion.bodyYaw - travelYaw),
        Math.cos(player.athleticMotion.bodyYaw - travelYaw),
      );
      // Match the rendered athlete: during a planted turn the body stays with
      // its physical heading until the travel vector catches up.
      const headingYaw = Math.abs(bodyTravelDelta) > 0.35 ? player.athleticMotion.bodyYaw : travelYaw;
      const heading = { x: Math.sin(headingYaw), z: Math.cos(headingYaw) };
      const behind = -((ball.position.x - player.position.x) * heading.x
        + (ball.position.z - player.position.z) * heading.z);
      maxBehindMeters = Math.max(maxBehindMeters, behind);
      if (behind > trailPeak.ballAheadMeters * -1) {
        trailPeak = {
          tick,
          separationMeters: Number(separation.toFixed(4)),
          playerSpeed: Number(speedForHeading.toFixed(4)),
          ballSpeed: Number(Math.hypot(ball.velocity.x, ball.velocity.z).toFixed(4)),
          ballAheadMeters: Number((-behind).toFixed(4)),
          contactApplied: planned.contactApplied,
          reason: planned.reason,
          segment: segmentIndex,
          moveX: Number(segment.moveX.toFixed(4)),
          moveY: Number(segment.moveY.toFixed(4)),
          playerVelocityX: Number(player.velocity.x.toFixed(4)),
          playerVelocityZ: Number(player.velocity.z.toFixed(4)),
          ballOffsetX: Number((ball.position.x - player.position.x).toFixed(4)),
          ballOffsetZ: Number((ball.position.z - player.position.z).toFixed(4)),
        };
      }
      if (separation > 1) ticksBeyondOneMeter += 1;
      const playerSpeed = Math.hypot(player.velocity.x, player.velocity.z);
      if (dribble.looseBall && !firstFailure) firstFailure = {
        tick,
        reason: planned.reason,
        separationMeters: Number(separation.toFixed(4)),
        playerSpeed: Number(playerSpeed.toFixed(4)),
        ballSpeed: Number(Math.hypot(ball.velocity.x, ball.velocity.z).toFixed(4)),
      };
      if (separation > maxSeparationMeters) {
        maxSeparationMeters = separation;
        peak = {
          tick,
          segment: segmentIndex,
          moveX: segment.moveX,
          moveY: segment.moveY,
          sprint: segment.sprint,
          playerSpeed: Number(playerSpeed.toFixed(4)),
          ballSpeed: Number(Math.hypot(ball.velocity.x, ball.velocity.z).toFixed(4)),
          ballAheadMeters: Number(((ball.position.x - player.position.x) * movement.direction.x
            + (ball.position.z - player.position.z) * movement.direction.z).toFixed(4)),
        };
      }
      if (dribble.lastContactTick >= 0 && playerSpeed >= 1.5) {
        speedDeltaSum += Math.abs(playerSpeed - Math.hypot(ball.velocity.x, ball.velocity.z));
        speedDeltaSamples += 1;
      }
    }
  }

  const ticks = scenario.segments.reduce((sum, segment) => sum + segment.ticks, 0);
  return {
    scenario: scenario.scenario,
    ticks,
    contacts,
    maxSeparationMeters: Number(maxSeparationMeters.toFixed(4)),
    maxBehindMeters: Number(maxBehindMeters.toFixed(4)),
    ticksBeyondOneMeterRate: Number((ticksBeyondOneMeter / ticks).toFixed(4)),
    looseBallTicks,
    looseBallRate: Number((looseBallTicks / ticks).toFixed(4)),
    failureReasons,
    firstFailure,
    meanBallPlayerSpeedDeltaMetersPerSecond: speedDeltaSamples
      ? Number((speedDeltaSum / speedDeltaSamples).toFixed(4))
      : 0,
    peak,
    trailPeak,
  };
}

export function runDribbleInputStress(): { seed: number; tickRateHz: 60; scenarios: readonly DribbleInputStressResult[] } {
  return {
    seed: 0x51a7,
    tickRateHz: 60,
    scenarios: SCENARIOS.map(simulateScenario),
  };
}

if (process.argv[1]?.endsWith('dribble-input-stress.ts')) {
  process.stdout.write(`${JSON.stringify(runDribbleInputStress(), null, 2)}\n`);
}
