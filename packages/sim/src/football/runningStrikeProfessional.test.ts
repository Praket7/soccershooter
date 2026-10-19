import { describe, expect, test } from 'vitest';
import { createStrikeContactPlan, stepStrikeContact } from './strikePlanner';
import type { FootballBallSnapshot } from './types';

const BALL: FootballBallSnapshot = {
  position: { x: 0.05, y: 0.11, z: 0.68 },
  velocity: { x: 0, y: 0, z: 6.1 },
  angularVelocity: { x: 20, y: 0, z: 0 },
  radius: 0.11,
  mass: 0.436,
  grounded: true,
};

describe('professional running strike planning', () => {
  test('a moving shot chooses a near legal contact beat before a knock-on escapes reach', () => {
    const request = {
      kind: 'shot' as const,
      sourceId: 'moving-shot',
      tick: 100,
      gaitPhase: 0.20,
      strideSeconds: 0.42,
      actorPosition: { x: 0, y: 0, z: 0 },
      actorVelocity: { x: 0, y: 0, z: 5.2 },
      ball: BALL,
      targetBallVelocity: { x: 0, y: 3.4, z: 24 },
      preferredFoot: 'right' as const,
      balance: 1,
    };

    const plan = createStrikeContactPlan(request);
    expect(plan).not.toBeNull();
    const delayTicks = plan!.contactTick - request.tick;
    expect(delayTicks).toBeGreaterThanOrEqual(2);
    expect(delayTicks).toBeLessThanOrEqual(8);

    const seconds = delayTicks / 60;
    const actorAtContact = {
      x: request.actorPosition.x + request.actorVelocity.x * seconds,
      y: 0,
      z: request.actorPosition.z + request.actorVelocity.z * seconds,
    };
    const ballAtContact: FootballBallSnapshot = {
      ...BALL,
      position: {
        x: BALL.position.x + BALL.velocity.x * seconds,
        y: BALL.position.y,
        z: BALL.position.z + BALL.velocity.z * seconds,
      },
    };

    expect(stepStrikeContact(plan!, plan!.contactTick, actorAtContact, ballAtContact).status).toBe('contact');
  });
});
