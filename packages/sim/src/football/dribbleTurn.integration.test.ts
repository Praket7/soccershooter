import { describe, expect, test } from 'vitest';
import { BALL_CONSTANTS, createBallState, type BallState } from '../../../physics/src/ball/BallState';
import { MATCH_BALL_PROFILE } from '../../../physics/src/ball/aerodynamics';
import { BALL_SUBSTEP_DT, stepBall } from '../../../physics/src/ball/trajectory';
import { createPlayerState, type PlayerState } from '../player/PlayerState';
import { createFlatMovementWorld, DEFAULT_MOVEMENT_CONFIG, stepPlayerMovement } from '../player/movement';
import { createPlannedDribbleState, stepPlannedDribble, type PlannedDribbleState } from './runtime';
import type { FootballActorSnapshot, FootballBallSnapshot, FootballHorizontalDirection } from './types';

const DT = 1 / 60;
const WORLD = createFlatMovementWorld({ minX: -120, maxX: 120, minZ: -120, maxZ: 120 });

function actor(player: Readonly<PlayerState>, pressure = 0, balance = 1): FootballActorSnapshot {
  const speed = Math.hypot(player.velocity.x, player.velocity.z);
  return {
    position: { ...player.position },
    velocity: { ...player.velocity },
    facingYaw: speed > 0.3 ? Math.atan2(player.velocity.x, player.velocity.z) : player.facingYaw,
    balance,
    pressure,
    sprinting: player.locomotion === 'sprint',
    preferredFoot: 'right',
  };
}

function snapshot(ball: Readonly<BallState>): FootballBallSnapshot {
  return {
    position: { ...ball.position },
    velocity: { ...ball.velocity },
    angularVelocity: { ...ball.angularVelocity },
    radius: BALL_CONSTANTS.radius,
    mass: BALL_CONSTANTS.mass,
    grounded: ball.grounded,
  };
}

function separation(player: Readonly<PlayerState>, ball: Readonly<BallState>): number {
  return Math.hypot(player.position.x - ball.position.x, player.position.z - ball.position.z);
}

function desiredDirection(moveX: number, moveY: number): FootballHorizontalDirection {
  const x = -moveX;
  const z = moveY;
  const length = Math.hypot(x, z);
  return length > 1e-9 ? { x: x / length, z: z / length } : { x: 0, z: 1 };
}

interface CarryMetrics {
  contacts: number;
  contactTicks: number[];
  maxSeparation: number;
  steadyMaxForwardGap: number;
  maxExitSpeed: number;
}

function runStraightCarry(mode: 'precision' | 'sprint', ticks = 180): CarryMetrics {
  let player = createPlayerState({ position: { x: 0, y: 0, z: 0 }, facingYaw: 0 });
  let ball = createBallState({ position: { x: 0, y: BALL_CONSTANTS.radius, z: 0.68 }, grounded: true });
  let planner = createPlannedDribbleState();
  const contactTicks: number[] = [];
  let maxSeparation = separation(player, ball);
  let steadyMaxForwardGap = Number.NEGATIVE_INFINITY;
  let maxExitSpeed = 0;

  for (let tick = 0; tick < ticks; tick += 1) {
    const sprint = mode === 'sprint';
    const precision = mode === 'precision';
    player = stepPlayerMovement(player, {
      moveX: 0,
      moveY: 1,
      aimYaw: 0,
      sprint,
      actionBits: 0,
    }, WORLD, DT, DEFAULT_MOVEMENT_CONFIG);

    const result = stepPlannedDribble({
      tick,
      state: planner,
      actor: actor(player),
      motion: player.athleticMotion,
      ball: snapshot(ball),
      desiredDirection: { x: 0, z: 1 },
      precision,
      sprint,
      pressure: 0,
      moveIntentMagnitude: 1,
      receiveMode: null,
    });
    planner = result.state;

    if (result.contactApplied) {
      ball = {
        ...ball,
        velocity: { ...result.ball.velocity },
        angularVelocity: { ...result.ball.angularVelocity },
      };
      contactTicks.push(tick);
      maxExitSpeed = Math.max(maxExitSpeed, Math.hypot(ball.velocity.x, ball.velocity.z));
    }

    ball = stepBall(ball, BALL_SUBSTEP_DT, MATCH_BALL_PROFILE, null);
    ball = stepBall(ball, BALL_SUBSTEP_DT, MATCH_BALL_PROFILE, null);
    const currentSeparation = separation(player, ball);
    maxSeparation = Math.max(maxSeparation, currentSeparation);
    if (tick >= 60) steadyMaxForwardGap = Math.max(steadyMaxForwardGap, ball.position.z - player.position.z);
  }

  return { contacts: contactTicks.length, contactTicks, maxSeparation, steadyMaxForwardGap, maxExitSpeed };
}

function applyPlannerBall(ball: Readonly<BallState>, result: ReturnType<typeof stepPlannedDribble>): BallState {
  if (!result.contactApplied) return ball as BallState;
  return {
    ...ball,
    velocity: { ...result.ball.velocity },
    angularVelocity: { ...result.ball.angularVelocity },
  };
}

describe('Stage 05R sprint dribbling and effort-turn integration', () => {
  test('sprint creates fewer longer contacts than precision over the same elapsed time', () => {
    const precision = runStraightCarry('precision');
    const sprint = runStraightCarry('sprint');

    expect(sprint.contacts).toBeGreaterThanOrEqual(4);
    expect(sprint.contacts).toBeLessThan(precision.contacts);
    expect(sprint.maxExitSpeed).toBeGreaterThan(precision.maxExitSpeed + 1.4);
    // Straight sprint should deliberately knock the free ball farther *ahead*.
    // Absolute separation is not the right comparison because close control
    // can sit slightly behind the carrier while still remaining physically near.
    expect(sprint.steadyMaxForwardGap).toBeGreaterThan(precision.steadyMaxForwardGap + 0.08);
    expect(sprint.maxSeparation).toBeLessThan(2.2);
  });

  test('a high-speed 90 degree cut visibly brakes before an effort contact and re-acceleration', () => {
    let player = createPlayerState({ position: { x: 0, y: 0, z: 0 }, facingYaw: 0 });
    let ball = createBallState({ position: { x: 0, y: BALL_CONSTANTS.radius, z: 0.68 }, grounded: true });
    let planner = createPlannedDribbleState();

    for (let tick = 0; tick < 72; tick += 1) {
      player = stepPlayerMovement(player, { moveX: 0, moveY: 1, aimYaw: 0, sprint: true, actionBits: 0 }, WORLD, DT);
      const result = stepPlannedDribble({
        tick,
        state: planner,
        actor: actor(player),
        motion: player.athleticMotion,
        ball: snapshot(ball),
        desiredDirection: { x: 0, z: 1 },
        precision: false,
        sprint: true,
        pressure: 0,
        moveIntentMagnitude: 1,
        receiveMode: null,
      });
      planner = result.state;
      ball = applyPlannerBall(ball, result);
      ball = stepBall(stepBall(ball, BALL_SUBSTEP_DT, MATCH_BALL_PROFILE, null), BALL_SUBSTEP_DT, MATCH_BALL_PROFILE, null);
    }

    const entrySpeed = Math.hypot(player.velocity.x, player.velocity.z);
    let minSpeed = entrySpeed;
    let sawPlant = false;
    let sawEffortPlan = false;
    let sawContact = false;

    for (let offset = 0; offset < 72; offset += 1) {
      const tick = 72 + offset;
      player = stepPlayerMovement(player, { moveX: -1, moveY: 0, aimYaw: 0, sprint: false, actionBits: 0 }, WORLD, DT);
      const result = stepPlannedDribble({
        tick,
        state: planner,
        actor: actor(player),
        motion: player.athleticMotion,
        ball: snapshot(ball),
        desiredDirection: { x: 1, z: 0 },
        precision: false,
        sprint: false,
        pressure: 0,
        moveIntentMagnitude: 1,
        receiveMode: null,
      });
      planner = result.state;
      sawPlant ||= player.athleticMotion.gait === 'plant';
      sawEffortPlan ||= Boolean(planner.activePlan?.reason.includes('effort'));
      sawContact ||= result.contactApplied;
      minSpeed = Math.min(minSpeed, Math.hypot(player.velocity.x, player.velocity.z));
      ball = applyPlannerBall(ball, result);
      ball = stepBall(stepBall(ball, BALL_SUBSTEP_DT, MATCH_BALL_PROFILE, null), BALL_SUBSTEP_DT, MATCH_BALL_PROFILE, null);
    }

    const exitSpeed = Math.hypot(player.velocity.x, player.velocity.z);
    expect(entrySpeed).toBeGreaterThan(7);
    expect(sawPlant).toBe(true);
    expect(sawEffortPlan).toBe(true);
    expect(sawContact).toBe(true);
    expect(minSpeed).toBeLessThan(entrySpeed * 0.72);
    // Sprint was released for the cut, so authoritative jog speed is capped at
    // 5.2 m/s. Require visible re-acceleration without demanding an impossible
    // speed above that configured movement ceiling.
    expect(exitSpeed).toBeGreaterThan(minSpeed + 0.6);
    expect(exitSpeed).toBeGreaterThan(5.0);
  });

  test('a full-speed 180 degree reversal contains a plant then recovery beat before normal propulsion returns', () => {
    let player = createPlayerState({ position: { x: 0, y: 0, z: 0 }, facingYaw: 0 });
    for (let tick = 0; tick < 70; tick += 1) {
      player = stepPlayerMovement(player, { moveX: 0, moveY: 1, aimYaw: 0, sprint: true, actionBits: 0 }, WORLD, DT);
    }
    const entrySpeed = Math.hypot(player.velocity.x, player.velocity.z);
    const gaitSequence: string[] = [];
    let minSpeed = entrySpeed;

    for (let tick = 0; tick < 90; tick += 1) {
      player = stepPlayerMovement(player, { moveX: 0, moveY: -1, aimYaw: 0, sprint: false, actionBits: 0 }, WORLD, DT);
      if (gaitSequence[gaitSequence.length - 1] !== player.athleticMotion.gait) gaitSequence.push(player.athleticMotion.gait);
      minSpeed = Math.min(minSpeed, Math.hypot(player.velocity.x, player.velocity.z));
    }

    const plantIndex = gaitSequence.indexOf('plant');
    const recoverIndex = gaitSequence.indexOf('recover');
    expect(entrySpeed).toBeGreaterThan(7);
    expect(plantIndex).toBeGreaterThanOrEqual(0);
    expect(recoverIndex).toBeGreaterThan(plantIndex);
    expect(minSpeed).toBeLessThan(2.2);
    expect(player.athleticMotion.propulsionDemand).toBeGreaterThan(0.7);
  });

  test('sprint contact preparation may branch before commitment but late reversal cannot instant-snap the ball', () => {
    let player = createPlayerState({ position: { x: 0, y: 0, z: 0 }, facingYaw: 0 });
    let ball = createBallState({ position: { x: 0, y: BALL_CONSTANTS.radius, z: 0.68 }, grounded: true });
    let planner: PlannedDribbleState = createPlannedDribbleState();
    let tick = 0;

    // Reach stable sprint and consume the first contact so the next plan has a
    // real preparation interval instead of the short initial pickup beat.
    let consumedFirst = false;
    while (tick < 120 && !consumedFirst) {
      player = stepPlayerMovement(player, { moveX: 0, moveY: 1, aimYaw: 0, sprint: true, actionBits: 0 }, WORLD, DT);
      const result = stepPlannedDribble({
        tick,
        state: planner,
        actor: actor(player),
        motion: player.athleticMotion,
        ball: snapshot(ball),
        desiredDirection: { x: 0, z: 1 },
        precision: false,
        sprint: true,
        pressure: 0,
        moveIntentMagnitude: 1,
        receiveMode: null,
      });
      planner = result.state;
      consumedFirst = result.contactApplied;
      ball = applyPlannerBall(ball, result);
      ball = stepBall(stepBall(ball, BALL_SUBSTEP_DT, MATCH_BALL_PROFILE, null), BALL_SUBSTEP_DT, MATCH_BALL_PROFILE, null);
      tick += 1;
    }
    expect(consumedFirst).toBe(true);

    while (tick < 180 && (!planner.activePlan || tick >= planner.activePlan.prepareTick)) {
      player = stepPlayerMovement(player, { moveX: 0, moveY: 1, aimYaw: 0, sprint: true, actionBits: 0 }, WORLD, DT);
      const result = stepPlannedDribble({
        tick,
        state: planner,
        actor: actor(player),
        motion: player.athleticMotion,
        ball: snapshot(ball),
        desiredDirection: { x: 0, z: 1 },
        precision: false,
        sprint: true,
        pressure: 0,
        moveIntentMagnitude: 1,
        receiveMode: null,
      });
      planner = result.state;
      ball = applyPlannerBall(ball, result);
      ball = stepBall(stepBall(ball, BALL_SUBSTEP_DT, MATCH_BALL_PROFILE, null), BALL_SUBSTEP_DT, MATCH_BALL_PROFILE, null);
      tick += 1;
    }

    expect(planner.activePlan).not.toBeNull();
    const originalTick = planner.activePlan!.contactTick;
    const originalVelocity = { ...planner.activePlan!.targetBallVelocity };

    player = stepPlayerMovement(player, { moveX: -0.5, moveY: 0.866, aimYaw: 0, sprint: true, actionBits: 0 }, WORLD, DT);
    let branch = stepPlannedDribble({
      tick,
      state: planner,
      actor: actor(player),
      motion: player.athleticMotion,
      ball: snapshot(ball),
      desiredDirection: desiredDirection(-0.5, 0.866),
      precision: false,
      sprint: true,
      pressure: 0,
      moveIntentMagnitude: 1,
      receiveMode: null,
    });
    planner = branch.state;
    expect(planner.activePlan?.contactTick).toBe(originalTick);
    expect(planner.activePlan?.targetBallVelocity.x).toBeGreaterThan(originalVelocity.x + 0.25);
    tick += 1;

    while (planner.activePlan && tick < planner.activePlan.prepareTick) {
      player = stepPlayerMovement(player, { moveX: -0.5, moveY: 0.866, aimYaw: 0, sprint: true, actionBits: 0 }, WORLD, DT);
      branch = stepPlannedDribble({
        tick,
        state: planner,
        actor: actor(player),
        motion: player.athleticMotion,
        ball: snapshot(ball),
        desiredDirection: desiredDirection(-0.5, 0.866),
        precision: false,
        sprint: true,
        pressure: 0,
        moveIntentMagnitude: 1,
        receiveMode: null,
      });
      planner = branch.state;
      ball = applyPlannerBall(ball, branch);
      ball = stepBall(stepBall(ball, BALL_SUBSTEP_DT, MATCH_BALL_PROFILE, null), BALL_SUBSTEP_DT, MATCH_BALL_PROFILE, null);
      tick += 1;
    }

    const committedVelocity = planner.activePlan ? { ...planner.activePlan.targetBallVelocity } : null;
    expect(committedVelocity).not.toBeNull();

    let applied = false;
    while (planner.activePlan && tick <= originalTick + 2) {
      player = stepPlayerMovement(player, { moveX: 0, moveY: -1, aimYaw: 0, sprint: false, actionBits: 0 }, WORLD, DT);
      const before = { ...ball.position };
      const late = stepPlannedDribble({
        tick,
        state: planner,
        actor: actor(player),
        motion: player.athleticMotion,
        ball: snapshot(ball),
        desiredDirection: { x: 0, z: -1 },
        precision: false,
        sprint: false,
        pressure: 0,
        moveIntentMagnitude: 1,
        receiveMode: null,
      });
      planner = late.state;
      expect(late.ball.position).toEqual(before);
      if (late.contactApplied) {
        applied = true;
        expect(late.ball.velocity.z).toBeGreaterThan(-0.5);
        ball = applyPlannerBall(ball, late);
      }
      ball = stepBall(stepBall(ball, BALL_SUBSTEP_DT, MATCH_BALL_PROFILE, null), BALL_SUBSTEP_DT, MATCH_BALL_PROFILE, null);
      tick += 1;
    }

    expect(applied).toBe(true);
  });
});
