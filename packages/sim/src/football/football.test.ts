import { describe, expect, test } from 'vitest';
import {
  applyBallContact,
  type FootballActorSnapshot,
  type FootballBallSnapshot,
} from './types';
import { buildControlTouch, shouldBreakControl } from './controlEnvelope';
import { solvePass } from './passing';
import { buildShot } from './shooting';
import {
  createDefenderActionState,
  evaluateInterception,
  resolveChallenge,
  stepDefenderActionState,
} from './defending';
import { evaluateAerialContact } from './aerial';

const actor = (overrides: Partial<FootballActorSnapshot> = {}): FootballActorSnapshot => ({
  position: { x: 0, y: 0, z: 0 },
  velocity: { x: 0, y: 0, z: 4 },
  facingYaw: 0,
  balance: 1,
  pressure: 0,
  sprinting: false,
  preferredFoot: 'right',
  ...overrides,
});

const ball = (overrides: Partial<FootballBallSnapshot> = {}): FootballBallSnapshot => ({
  position: { x: 0.22, y: 0.11, z: 0.72 },
  velocity: { x: 0, y: 0, z: 2 },
  angularVelocity: { x: 0, y: 0, z: 0 },
  radius: 0.11,
  mass: 0.436,
  grounded: true,
  ...overrides,
});

describe('Stage 05 control envelope', () => {
  test('control creates an impulse command and never teleports the ball', () => {
    const source = ball();
    const touch = buildControlTouch({
      actor: actor(),
      ball: source,
      desiredDirection: { x: 0, z: 1 },
      precision: true,
      sprint: false,
      pressure: 0,
    });

    expect(touch.eligible).toBe(true);
    expect(touch.command).toBeDefined();
    const next = applyBallContact(source, touch.command!);
    expect(next.position).toEqual(source.position);
    expect(next.velocity).not.toEqual(source.velocity);
  });

  test('sprint dribbling deliberately produces a longer and harder touch than controlled dribbling', () => {
    const controlled = buildControlTouch({
      actor: actor({ velocity: { x: 0, y: 0, z: 4 } }),
      ball: ball(),
      desiredDirection: { x: 0, z: 1 },
      precision: true,
      sprint: false,
      pressure: 0,
    });
    const sprint = buildControlTouch({
      actor: actor({ velocity: { x: 0, y: 0, z: 7.5 }, sprinting: true }),
      ball: ball(),
      desiredDirection: { x: 0, z: 1 },
      precision: false,
      sprint: true,
      pressure: 0,
    });

    expect(sprint.touchDistance).toBeGreaterThan(controlled.touchDistance);
    expect(sprint.targetBallSpeed).toBeGreaterThan(controlled.targetBallSpeed);
  });

  test('pressure and poor body angle reduce control quality instead of granting magnetic correction', () => {
    const clean = buildControlTouch({
      actor: actor(),
      ball: ball(),
      desiredDirection: { x: 0, z: 1 },
      precision: true,
      sprint: false,
      pressure: 0,
    });
    const pressuredBadAngle = buildControlTouch({
      actor: actor({ facingYaw: Math.PI * 0.72 }),
      ball: ball(),
      desiredDirection: { x: 0, z: 1 },
      precision: false,
      sprint: false,
      pressure: 0.9,
    });

    expect(pressuredBadAngle.quality).toBeLessThan(clean.quality);
    if (pressuredBadAngle.command && clean.command) {
      expect(pressuredBadAngle.command.maxImpulse).toBeLessThan(clean.command.maxImpulse);
    }
  });

  test('control breaks under sufficient opponent impulse or an uncontrollably fast ball', () => {
    expect(shouldBreakControl({ opponentImpulse: 25, ballSpeed: 4, controlQuality: 0.8 })).toBe(true);
    expect(shouldBreakControl({ opponentImpulse: 1, ballSpeed: 31, controlQuality: 0.8 })).toBe(true);
    expect(shouldBreakControl({ opponentImpulse: 1, ballSpeed: 4, controlQuality: 0.8 })).toBe(false);
  });
});

describe('Stage 05 passing', () => {
  test('through-pass lead predicts receiver motion into open space', () => {
    const solution = solvePass({
      type: 'through',
      passer: actor(),
      ball: ball(),
      receiver: {
        position: { x: 2, y: 0, z: 9 },
        velocity: { x: 2.2, y: 0, z: 3.6 },
      },
      userAim: { x: 0.12, z: 0.99 },
      assist: 0.65,
      pressure: 0.2,
      allowBehindBodyTechnique: false,
    });

    expect(solution.legal).toBe(true);
    expect(solution.targetPoint.x).toBeGreaterThan(2);
    expect(solution.targetPoint.z).toBeGreaterThan(9);
  });

  test('assist cannot authorize an impossible behind-the-back pass', () => {
    const solution = solvePass({
      type: 'ground',
      passer: actor({ facingYaw: 0 }),
      ball: ball({ position: { x: 0, y: 0.11, z: 0.4 } }),
      receiver: {
        position: { x: 0, y: 0, z: -9 },
        velocity: { x: 0, y: 0, z: 0 },
      },
      userAim: { x: 0, z: -1 },
      assist: 1,
      pressure: 0,
      allowBehindBodyTechnique: false,
    });

    expect(solution.legal).toBe(false);
    expect(solution.reason).toBe('behind-body');
  });

  test('ground, driven, lofted, and through passes remain mechanically distinct', () => {
    const base = {
      passer: actor(),
      ball: ball(),
      receiver: { position: { x: 1, y: 0, z: 14 }, velocity: { x: 0.5, y: 0, z: 2 } },
      userAim: { x: 0.05, z: 1 },
      assist: 0.4,
      pressure: 0,
      allowBehindBodyTechnique: false,
    } as const;
    const ground = solvePass({ ...base, type: 'ground' });
    const driven = solvePass({ ...base, type: 'driven' });
    const lofted = solvePass({ ...base, type: 'lofted' });
    const through = solvePass({ ...base, type: 'through' });

    expect(driven.launchSpeed).toBeGreaterThan(ground.launchSpeed);
    expect(lofted.launchVelocity.y).toBeGreaterThan(ground.launchVelocity.y + 2);
    expect(through.targetPoint.z).toBeGreaterThan(ground.targetPoint.z);
  });
});

describe('Stage 05 shooting', () => {
  test('legal shot impulse is bounded even at full charge', () => {
    const shot = buildShot({
      style: 'driven',
      shooter: actor({ velocity: { x: 0, y: 0, z: 7 } }),
      ball: ball(),
      aim: { x: 0, z: 1 },
      charge: 1,
      spinInput: 1,
      pressure: 0,
      balance: 1,
      contactFoot: 'right',
    });

    expect(shot.legal).toBe(true);
    expect(shot.launchSpeed).toBeLessThanOrEqual(36);
    expect(shot.command).toBeDefined();
    expect(shot.command!.maxImpulse).toBeLessThanOrEqual(16);
  });

  test('body alignment and contact foot materially change the resulting contact', () => {
    const alignedRight = buildShot({
      style: 'outside-foot',
      shooter: actor({ facingYaw: 0 }),
      ball: ball(),
      aim: { x: 0.15, z: 0.99 },
      charge: 0.75,
      spinInput: 0.8,
      pressure: 0.1,
      balance: 1,
      contactFoot: 'right',
    });
    const misalignedLeft = buildShot({
      style: 'outside-foot',
      shooter: actor({ facingYaw: Math.PI * 0.45 }),
      ball: ball(),
      aim: { x: 0.15, z: 0.99 },
      charge: 0.75,
      spinInput: 0.8,
      pressure: 0.1,
      balance: 1,
      contactFoot: 'left',
    });

    expect(alignedRight.launchSpeed).toBeGreaterThan(misalignedLeft.launchSpeed);
    expect(Math.sign(alignedRight.command!.angularVelocityDelta.y)).toBe(-Math.sign(misalignedLeft.command!.angularVelocityDelta.y));
  });

  test('straight, finesse, chip, and knuckle produce intentionally different launch signatures', () => {
    const base = {
      shooter: actor(),
      ball: ball(),
      aim: { x: 0, z: 1 },
      charge: 0.7,
      spinInput: 0.75,
      pressure: 0,
      balance: 1,
      contactFoot: 'right' as const,
    };
    const normal = buildShot({ ...base, style: 'normal' });
    const finesse = buildShot({ ...base, style: 'finesse' });
    const chip = buildShot({ ...base, style: 'chip' });
    const knuckle = buildShot({ ...base, style: 'knuckle' });

    expect(Math.abs(finesse.command!.angularVelocityDelta.y)).toBeGreaterThan(Math.abs(normal.command!.angularVelocityDelta.y) + 15);
    expect(chip.launchVelocity.y).toBeGreaterThan(normal.launchVelocity.y + 2);
    expect(Math.hypot(
      knuckle.command!.angularVelocityDelta.x,
      knuckle.command!.angularVelocityDelta.y,
      knuckle.command!.angularVelocityDelta.z,
    )).toBeLessThan(3);
  });
});

describe('Stage 05 defending and interception', () => {
  test('committed tackle spam loses value because recovery blocks repeated challenges', () => {
    let state = createDefenderActionState();
    const first = resolveChallenge({
      kind: 'committed',
      state,
      defender: actor(),
      ball: ball({ position: { x: 0.2, y: 0.11, z: 1.1 } }),
      opponentPosition: { x: 0.1, y: 0, z: 1.25 },
    });
    state = first.nextState;
    const spam = resolveChallenge({
      kind: 'committed',
      state,
      defender: actor(),
      ball: ball({ position: { x: 0.2, y: 0.11, z: 1.1 } }),
      opponentPosition: { x: 0.1, y: 0, z: 1.25 },
    });

    expect(first.accepted).toBe(true);
    expect(state.recoverySeconds).toBeGreaterThan(0.4);
    expect(spam.accepted).toBe(false);
    expect(spam.reason).toBe('recovering');

    state = stepDefenderActionState(state, 2);
    expect(state.recoverySeconds).toBe(0);
  });

  test('a mistimed committed challenge carries more recovery cost than a standing challenge', () => {
    const farBall = ball({ position: { x: 3, y: 0.11, z: 4 } });
    const standing = resolveChallenge({
      kind: 'standing', state: createDefenderActionState(), defender: actor(), ball: farBall,
      opponentPosition: { x: 3, y: 0, z: 4 },
    });
    const committed = resolveChallenge({
      kind: 'committed', state: createDefenderActionState(), defender: actor(), ball: farBall,
      opponentPosition: { x: 3, y: 0, z: 4 },
    });

    expect(committed.nextState.recoverySeconds).toBeGreaterThan(standing.nextState.recoverySeconds);
  });

  test('interception window predicts an approaching ball crossing reachable space', () => {
    const interception = evaluateInterception({
      defender: actor({ position: { x: 0, y: 0, z: 4 }, velocity: { x: 0, y: 0, z: 0 } }),
      ball: ball({ position: { x: -3, y: 0.11, z: 4.2 }, velocity: { x: 9, y: 0, z: 0 } }),
      horizonSeconds: 0.6,
    });

    expect(interception.eligible).toBe(true);
    expect(interception.timeToWindow).toBeGreaterThan(0);
    expect(interception.timeToWindow).toBeLessThan(0.6);
  });
});

describe('Stage 05 aerial core', () => {
  test('header and volley eligibility use distinct readable ball-height windows', () => {
    const header = evaluateAerialContact({
      kind: 'header',
      actor: actor(),
      ball: ball({ position: { x: 0.1, y: 1.72, z: 0.55 }, velocity: { x: 0, y: -1, z: 4 } }),
      jumpRequested: true,
    });
    const sameAsVolley = evaluateAerialContact({
      kind: 'volley',
      actor: actor(),
      ball: ball({ position: { x: 0.1, y: 1.72, z: 0.55 }, velocity: { x: 0, y: -1, z: 4 } }),
      jumpRequested: false,
    });
    const volley = evaluateAerialContact({
      kind: 'volley',
      actor: actor(),
      ball: ball({ position: { x: 0.1, y: 0.82, z: 0.62 }, velocity: { x: 0, y: -0.4, z: 3 } }),
      jumpRequested: false,
    });

    expect(header.eligible).toBe(true);
    expect(sameAsVolley.eligible).toBe(false);
    expect(volley.eligible).toBe(true);
  });
});

describe('Stage 05 determinism', () => {
  test('identical football action traces are bit-for-bit repeatable', () => {
    const run = () => {
      const touch = buildControlTouch({
        actor: actor(), ball: ball(), desiredDirection: { x: 0.18, z: 0.98 },
        precision: false, sprint: false, pressure: 0.25,
      });
      const pass = solvePass({
        type: 'driven', passer: actor(), ball: ball(),
        receiver: { position: { x: 4, y: 0, z: 16 }, velocity: { x: 1.2, y: 0, z: 2.8 } },
        userAim: { x: 0.2, z: 0.98 }, assist: 0.45, pressure: 0.2,
        allowBehindBodyTechnique: false,
      });
      const shot = buildShot({
        style: 'finesse', shooter: actor(), ball: ball(), aim: { x: -0.12, z: 0.99 },
        charge: 0.68, spinInput: 0.7, pressure: 0.15, balance: 0.9, contactFoot: 'right',
      });
      const tackle = resolveChallenge({
        kind: 'standing', state: createDefenderActionState(), defender: actor(),
        ball: ball(), opponentPosition: { x: 0.1, y: 0, z: 0.9 },
      });
      return JSON.stringify({ touch, pass, shot, tackle });
    };

    expect(run()).toBe(run());
  });
});
