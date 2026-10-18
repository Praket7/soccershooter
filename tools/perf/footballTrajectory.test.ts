import { describe, expect, test } from 'vitest';
import { createBallState } from '../../packages/physics/src/ball/BallState';
import { simulateBall } from '../../packages/physics/src/ball/trajectory';
import { buildShot } from '../../packages/sim/src/football/shooting';
import { applyBallContact, type FootballActorSnapshot, type FootballBallSnapshot } from '../../packages/sim/src/football/types';

const actor = (facingYaw = 0): FootballActorSnapshot => ({
  position: { x: 0, y: 0, z: -0.68 },
  velocity: { x: 0, y: 0, z: 2.5 },
  facingYaw,
  balance: 1,
  pressure: 0,
  sprinting: false,
  preferredFoot: 'right',
});

const ball: FootballBallSnapshot = {
  position: { x: 0, y: 0.11, z: 0 },
  velocity: { x: 0, y: 0, z: 0 },
  angularVelocity: { x: 0, y: 0, z: 0 },
  radius: 0.11,
  mass: 0.436,
  grounded: true,
};

function trajectory(style: 'normal' | 'finesse' | 'chip' | 'outside-foot', foot: 'left' | 'right' = 'right') {
  const solution = buildShot({
    style,
    shooter: actor(),
    ball,
    aim: { x: 0, z: 1 },
    charge: 0.78,
    spinInput: 0.85,
    pressure: 0,
    balance: 1,
    contactFoot: foot,
  });
  if (!solution.command) throw new Error(`${style} did not create contact`);
  const contacted = applyBallContact(ball, solution.command);
  const initial = createBallState({
    position: ball.position,
    velocity: contacted.velocity,
    angularVelocity: contacted.angularVelocity,
    knuckleSeed: 0x5a17f00d,
  });
  return simulateBall(initial, { seconds: 1.15 });
}

function last(trace: ReturnType<typeof trajectory>) {
  const sample = trace.samples.at(-1);
  if (!sample) throw new Error('trajectory has no samples');
  return sample.state;
}

describe('Stage 05 contacts integrated with Stage 04 ball physics', () => {
  test('normal contact remains intentionally close to the aim plane', () => {
    const end = last(trajectory('normal'));
    expect(Math.abs(end.position.x)).toBeLessThan(0.28);
    expect(end.position.z).toBeGreaterThan(12);
  });

  test('finesse produces materially more lateral curve than a normal strike', () => {
    const normal = last(trajectory('normal'));
    const finesse = last(trajectory('finesse'));
    expect(Math.abs(finesse.position.x)).toBeGreaterThan(Math.abs(normal.position.x) + 0.45);
  });

  test('chip produces a materially higher apex than the normal strike', () => {
    const normal = trajectory('normal');
    const chip = trajectory('chip');
    expect(chip.apex.y).toBeGreaterThan(normal.apex.y + 1.1);
  });

  test('outside-foot contact curves in opposite lateral directions for left and right foot', () => {
    const right = last(trajectory('outside-foot', 'right'));
    const left = last(trajectory('outside-foot', 'left'));
    expect(Math.abs(right.position.x)).toBeGreaterThan(0.35);
    expect(Math.abs(left.position.x)).toBeGreaterThan(0.35);
    expect(Math.sign(right.position.x)).toBe(-Math.sign(left.position.x));
  });
});
