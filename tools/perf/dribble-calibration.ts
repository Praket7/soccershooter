import { BALL_CONSTANTS, createBallState, type BallState } from '../../packages/physics/src/ball/BallState';
import { MATCH_BALL_PROFILE } from '../../packages/physics/src/ball/aerodynamics';
import { BALL_SUBSTEP_DT, stepBall } from '../../packages/physics/src/ball/trajectory';
import { createPlayerState, type PlayerState } from '../../packages/sim/src/player/PlayerState';
import { createFlatMovementWorld, DEFAULT_MOVEMENT_CONFIG, stepPlayerMovement } from '../../packages/sim/src/player/movement';
import { createPlannedDribbleState, stepPlannedDribble, type PlannedDribbleState } from '../../packages/sim/src/football/dribblePlanner';
import type { FootballActorSnapshot, FootballBallSnapshot, FootballFoot } from '../../packages/sim/src/football/types';

const DT = 1 / 60;
const WORLD = createFlatMovementWorld({ minX: -100, maxX: 100, minZ: -100, maxZ: 100 });
const SCENARIOS = [
  { id: 'straight-jog', precision: false, sprint: false, turnAt: -1, turnDegrees: 0, pressure: 0, preferredFoot: 'right' as const, ballOffsetX: 0, initialBallSpeed: 0 },
  { id: 'close-control-slalom', precision: true, sprint: false, turnAt: 36, turnDegrees: 60, pressure: 0, preferredFoot: 'right' as const, ballOffsetX: 0, initialBallSpeed: 0 },
  { id: '30-degree-jog-cut', precision: false, sprint: false, turnAt: 48, turnDegrees: 30, pressure: 0, preferredFoot: 'right' as const, ballOffsetX: 0, initialBallSpeed: 0 },
  { id: '90-degree-jog-cut', precision: false, sprint: false, turnAt: 48, turnDegrees: 90, pressure: 0, preferredFoot: 'right' as const, ballOffsetX: 0, initialBallSpeed: 0 },
  { id: '120-degree-jog-cut', precision: false, sprint: false, turnAt: 48, turnDegrees: 120, pressure: 0, preferredFoot: 'right' as const, ballOffsetX: 0, initialBallSpeed: 0 },
  { id: '180-degree-jog-reversal', precision: false, sprint: false, turnAt: 48, turnDegrees: 180, pressure: 0, preferredFoot: 'right' as const, ballOffsetX: 0, initialBallSpeed: 0 },
  { id: 'sprint-knock-on-cut', precision: false, sprint: true, turnAt: 60, turnDegrees: 90, pressure: 0, preferredFoot: 'right' as const, ballOffsetX: 0, initialBallSpeed: 0 },
  { id: '30-degree-sprint-cut', precision: false, sprint: true, turnAt: 60, turnDegrees: 30, pressure: 0, preferredFoot: 'right' as const, ballOffsetX: 0, initialBallSpeed: 0 },
  { id: '60-degree-sprint-cut', precision: false, sprint: true, turnAt: 60, turnDegrees: 60, pressure: 0, preferredFoot: 'right' as const, ballOffsetX: 0, initialBallSpeed: 0 },
  { id: '120-degree-sprint-cut', precision: false, sprint: true, turnAt: 60, turnDegrees: 120, pressure: 0, preferredFoot: 'right' as const, ballOffsetX: 0, initialBallSpeed: 0 },
  { id: '180-degree-sprint-reversal', precision: false, sprint: true, turnAt: 60, turnDegrees: 180, pressure: 0, preferredFoot: 'right' as const, ballOffsetX: 0, initialBallSpeed: 0 },
  { id: 'pressure-from-left', precision: false, sprint: false, turnAt: -1, turnDegrees: 0, pressure: 0.55, preferredFoot: 'right' as const, ballOffsetX: -0.25, initialBallSpeed: 0 },
  { id: 'pressure-from-right', precision: false, sprint: false, turnAt: -1, turnDegrees: 0, pressure: 0.55, preferredFoot: 'right' as const, ballOffsetX: 0.25, initialBallSpeed: 0 },
  { id: 'weak-foot-contact', precision: false, sprint: false, turnAt: -1, turnDegrees: 0, pressure: 0.1, preferredFoot: 'left' as const, ballOffsetX: 0.2, initialBallSpeed: 0 },
  { id: 'loose-ball-recovery', precision: false, sprint: false, turnAt: -1, turnDegrees: 0, pressure: 0, preferredFoot: 'right' as const, ballOffsetX: 0.95, initialBallSpeed: 0.8 },
  { id: 'trap-to-controlled-exit', precision: true, sprint: false, turnAt: -1, turnDegrees: 0, pressure: 0, preferredFoot: 'right' as const, ballOffsetX: 0, initialBallSpeed: -1.6 },
] as const;

type Scenario = typeof SCENARIOS[number];

interface CalibrationMetrics {
  contacts: number;
  contactCadencePerSecond: number;
  footUsage: Record<'left' | 'right', number>;
  contactTimingErrorTicks: number[];
  ballDistanceAtContactMeters: number[];
  exitSpeedRetention: number[];
  brakingTicks: number;
  brakingDistanceMeters: number;
  plantDurationTicks: number;
  lostControlRate: number;
  inputToMotionResponseLatencyTicks: number | null;
}

interface ScenarioReport { scenario: string; metrics: CalibrationMetrics; }
type CalibrationDistributionName =
  | 'touchCadencePerSecond' | 'contactTimingErrorTicks' | 'ballDistanceAtContactMeters' | 'exitSpeedRetention'
  | 'brakingTicks' | 'brakingDistanceMeters' | 'plantDurationTicks' | 'lostControlRate'
  | 'inputToMotionResponseLatencyTicks' | 'leftFootUsage' | 'rightFootUsage';
type CalibrationDistribution = ReturnType<typeof summarize>;

function actorSnapshot(player: Readonly<PlayerState>, pressure: number, preferredFoot: FootballFoot): FootballActorSnapshot {
  const speed = Math.hypot(player.velocity.x, player.velocity.z);
  const movementBalance = player.locomotion === 'sharp-cut' ? 0.68 : player.grounded ? 1 : 0.58;
  const speedBalance = Math.max(0.72, Math.min(1, 1 - Math.max(0, speed - DEFAULT_MOVEMENT_CONFIG.jogSpeed) * 0.035));
  return {
    position: { ...player.position }, velocity: { ...player.velocity },
    facingYaw: speed > 0.35 ? Math.atan2(player.velocity.x, player.velocity.z) : player.facingYaw,
    balance: movementBalance * speedBalance, pressure, sprinting: player.locomotion === 'sprint', preferredFoot,
  };
}

function ballSnapshot(ball: Readonly<BallState>): FootballBallSnapshot {
  return {
    position: { ...ball.position }, velocity: { ...ball.velocity }, angularVelocity: { ...ball.angularVelocity },
    radius: BALL_CONSTANTS.radius, mass: BALL_CONSTANTS.mass, grounded: ball.grounded,
  };
}

function quantile(values: readonly number[], fraction: number): number | null {
  if (values.length === 0) return null;
  const ordered = [...values].sort((left, right) => left - right);
  return Number(ordered[Math.min(ordered.length - 1, Math.floor((ordered.length - 1) * fraction))]!.toFixed(4));
}

function summarize(values: readonly number[]): { count: number; p10: number | null; p50: number | null; p90: number | null; max: number | null } {
  return { count: values.length, p10: quantile(values, 0.1), p50: quantile(values, 0.5), p90: quantile(values, 0.9), max: values.length ? Number(Math.max(...values).toFixed(4)) : null };
}

function runScenario(scenario: Scenario, ticks = 180): CalibrationMetrics {
  let player = createPlayerState({ position: { x: 0, y: 0, z: 0 }, facingYaw: 0, stamina: DEFAULT_MOVEMENT_CONFIG.staminaMax });
  let ball = createBallState({ position: { x: scenario.ballOffsetX, y: BALL_CONSTANTS.radius, z: 0.68 }, velocity: { x: 0, y: 0, z: scenario.initialBallSpeed }, grounded: true });
  let dribble: PlannedDribbleState = createPlannedDribbleState();
  const contactTicks: number[] = [];
  const contactTimingErrorTicks: number[] = [];
  const ballDistanceAtContactMeters: number[] = [];
  const exitSpeedRetention: number[] = [];
  const footUsage = { left: 0, right: 0 };
  let plantDurationTicks = 0;
  let lostControlTicks = 0;
  let brakingTicks = 0;
  let brakingDistanceMeters = 0;
  let inputToMotionResponseLatencyTicks: number | null = null;
  let preTurnSpeed = 0;
  let preTurnPosition = { x: 0, z: 0 };
  let lastPosition = { x: 0, z: 0 };
  let turnStarted = false;
  let responseTargetYaw = 0;
  let sprint = scenario.sprint;

  for (let tick = 0; tick < ticks; tick += 1) {
    const turning = scenario.turnAt >= 0 && tick >= scenario.turnAt;
    if (scenario.turnAt >= 0 && tick === scenario.turnAt) {
      turnStarted = true;
      preTurnSpeed = Math.hypot(player.velocity.x, player.velocity.z);
      preTurnPosition = { x: player.position.x, z: player.position.z };
      responseTargetYaw = scenario.turnDegrees * Math.PI / 180;
      sprint = false;
    }
    const aimYaw = turning ? responseTargetYaw : 0;
    player = stepPlayerMovement(player, { moveX: 0, moveY: 1, aimYaw, sprint, actionBits: 0 }, WORLD, DT, DEFAULT_MOVEMENT_CONFIG);
    if (player.athleticMotion.gait === 'plant') {
      plantDurationTicks += 1;
      if (turnStarted && inputToMotionResponseLatencyTicks === null) brakingTicks += 1;
    }
    if (turnStarted && inputToMotionResponseLatencyTicks === null) {
      const speed = Math.hypot(player.velocity.x, player.velocity.z);
      brakingDistanceMeters += Math.hypot(player.position.x - lastPosition.x, player.position.z - lastPosition.z);
      if (speed > 0.4) {
        const yaw = Math.atan2(player.velocity.x, player.velocity.z);
        const delta = Math.atan2(Math.sin(yaw - responseTargetYaw), Math.cos(yaw - responseTargetYaw));
        if (Math.abs(delta) <= Math.PI / 12) inputToMotionResponseLatencyTicks = tick - scenario.turnAt;
      }
    }

    const beforeSpeed = Math.hypot(ball.velocity.x, ball.velocity.z);
    const beforeDistance = Math.hypot(player.position.x - ball.position.x, player.position.z - ball.position.z);
    const expectedContactTick = dribble.activePlan?.contactTick;
    const planned = stepPlannedDribble({
      tick, state: dribble, actor: actorSnapshot(player, scenario.pressure, scenario.preferredFoot), motion: player.athleticMotion,
      ball: ballSnapshot(ball), desiredDirection: { x: Math.sin(aimYaw), z: Math.cos(aimYaw) },
      precision: scenario.precision, sprint, pressure: scenario.pressure, moveIntentMagnitude: 1,
      receiveMode: scenario.id === 'trap-to-controlled-exit' && dribble.lastContactTick < 0 ? 'controlled-exit' : null,
    });
    dribble = planned.state;
    if (planned.contactApplied) {
      contactTicks.push(tick);
      if (dribble.lastContactFoot) footUsage[dribble.lastContactFoot] += 1;
      if (expectedContactTick !== undefined) contactTimingErrorTicks.push(tick - expectedContactTick);
      ballDistanceAtContactMeters.push(beforeDistance);
      const afterSpeed = Math.hypot(planned.ball.velocity.x, planned.ball.velocity.z);
      if (beforeSpeed > 0.2) exitSpeedRetention.push(afterSpeed / beforeSpeed);
      ball = { ...ball, velocity: { ...planned.ball.velocity }, angularVelocity: { ...planned.ball.angularVelocity } };
    } else if (dribble.looseBall) {
      lostControlTicks += 1;
    }
    ball = stepBall(ball, BALL_SUBSTEP_DT, MATCH_BALL_PROFILE, null);
    ball = stepBall(ball, BALL_SUBSTEP_DT, MATCH_BALL_PROFILE, null);
    lastPosition = { x: player.position.x, z: player.position.z };
  }
  const gaps = contactTicks.slice(1).map((tick, index) => tick - contactTicks[index]!);
  const lostControlRate = lostControlTicks / ticks;
  if (!Number.isFinite(preTurnSpeed) || !Number.isFinite(preTurnPosition.x) || !Number.isFinite(preTurnPosition.z)) throw new Error('non-finite calibration state');
  return {
    contacts: contactTicks.length,
    contactCadencePerSecond: gaps.length ? 60 / (gaps.reduce((sum, gap) => sum + gap, 0) / gaps.length) : 0,
    footUsage,
    contactTimingErrorTicks,
    ballDistanceAtContactMeters,
    exitSpeedRetention,
    brakingTicks,
    brakingDistanceMeters,
    plantDurationTicks,
    lostControlRate,
    inputToMotionResponseLatencyTicks,
  };
}

export function runDribbleCalibration(): { version: 1; seed: number; tickRateHz: 60; scenarios: readonly ScenarioReport[]; distributions: Record<CalibrationDistributionName, CalibrationDistribution> } {
  const scenarios = SCENARIOS.map((scenario) => ({ scenario: scenario.id, metrics: runScenario(scenario) }));
  const distributions: Record<CalibrationDistributionName, CalibrationDistribution> = {
    touchCadencePerSecond: summarize(scenarios.map(({ metrics }) => metrics.contactCadencePerSecond)),
    contactTimingErrorTicks: summarize(scenarios.flatMap(({ metrics }) => metrics.contactTimingErrorTicks)),
    ballDistanceAtContactMeters: summarize(scenarios.flatMap(({ metrics }) => metrics.ballDistanceAtContactMeters)),
    exitSpeedRetention: summarize(scenarios.flatMap(({ metrics }) => metrics.exitSpeedRetention)),
    brakingTicks: summarize(scenarios.map(({ metrics }) => metrics.brakingTicks)),
    brakingDistanceMeters: summarize(scenarios.map(({ metrics }) => metrics.brakingDistanceMeters)),
    plantDurationTicks: summarize(scenarios.map(({ metrics }) => metrics.plantDurationTicks)),
    lostControlRate: summarize(scenarios.map(({ metrics }) => metrics.lostControlRate)),
    inputToMotionResponseLatencyTicks: summarize(scenarios.flatMap(({ metrics }) =>
      metrics.inputToMotionResponseLatencyTicks === null ? [] : [metrics.inputToMotionResponseLatencyTicks])),
    leftFootUsage: summarize(scenarios.map(({ metrics }) => metrics.footUsage.left)),
    rightFootUsage: summarize(scenarios.map(({ metrics }) => metrics.footUsage.right)),
  };
  return { version: 1, seed: 0x05a8c1, tickRateHz: 60, scenarios, distributions };
}

if (process.argv[1]?.endsWith('dribble-calibration.ts')) {
  process.stdout.write(`${JSON.stringify(runDribbleCalibration(), null, 2)}\n`);
}
