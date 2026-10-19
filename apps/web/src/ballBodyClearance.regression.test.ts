import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';
import { BALL_CONSTANTS } from '../../../packages/physics/src/ball/BallState';
import { buildControlTouch } from '../../../packages/sim/src/football/controlEnvelope';
import type { FootballActorSnapshot, FootballBallSnapshot } from '../../../packages/sim/src/football/types';
import { PLAYER_VISUAL_LAYOUT } from './presentation/PlayerVisualLayout';

function practiceBallVisualScale(): number {
  const source = readFileSync(new URL('./dev/FootballPractice.ts', import.meta.url), 'utf8');
  const match = source.match(/const VISUAL_SCALE = ([0-9.]+);/);
  if (!match) throw new Error('FootballPractice VISUAL_SCALE contract is missing');
  return Number(match[1]);
}

describe('Stage 05 rendered ball/body clearance', () => {
  test('precision close control cannot target the rendered ball inside the front boot volume', () => {
    const actor: FootballActorSnapshot = {
      position: { x: 0, y: 0, z: 0 },
      velocity: { x: 0, y: 0, z: 3.4 },
      facingYaw: 0,
      balance: 1,
      pressure: 0,
      sprinting: false,
      preferredFoot: 'right',
    };
    const ball: FootballBallSnapshot = {
      position: { x: 0, y: BALL_CONSTANTS.radius, z: 0.55 },
      velocity: { x: 0, y: 0, z: 3.1 },
      angularVelocity: { x: 3.1 / BALL_CONSTANTS.radius, y: 0, z: 0 },
      radius: BALL_CONSTANTS.radius,
      mass: BALL_CONSTANTS.mass,
      grounded: true,
    };
    const touch = buildControlTouch({
      actor,
      ball,
      desiredDirection: { x: 0, z: 1 },
      precision: true,
      sprint: false,
      pressure: 0,
      moveIntentMagnitude: 1,
    });

    expect(touch.eligible).toBe(true);
    const bootFront = PLAYER_VISUAL_LAYOUT.footForward + PLAYER_VISUAL_LAYOUT.footLength / 2;
    const renderedBallRadius = BALL_CONSTANTS.radius * practiceBallVisualScale();
    const clearance = touch.touchDistance - bootFront;

    expect(clearance).toBeGreaterThanOrEqual(renderedBallRadius - 1e-6);
  });
});
