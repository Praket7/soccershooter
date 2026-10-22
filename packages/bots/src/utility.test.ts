import { describe, expect, it } from 'vitest';
import { chooseCarrierAction, chooseDefensiveAction, chooseOffBallAction } from './utility';
import type { BotWorldSnapshot, TeamId } from './types';

function looseBallWorld(): BotWorldSnapshot {
  return {
    tick: 0,
    timeSeconds: 0,
    field: { halfWidth: 12, halfLength: 18, goalHalfWidth: 3.66 },
    ball: { position: { x: 0, y: 0.11, z: 0 }, velocity: { x: 0, y: 0, z: 8 } },
    players: [
      { id: 'h-gk', team: 'home', goalkeeper: true, position: { x: 0, y: 0, z: -16.7 }, velocity: { x: 0, y: 0, z: 0 }, facingYaw: 0 },
      { id: 'h-1', team: 'home', goalkeeper: false, position: { x: -4, y: 0, z: 1 }, velocity: { x: 0, y: 0, z: 0 }, facingYaw: 0 },
      { id: 'h-2', team: 'home', goalkeeper: false, position: { x: 4, y: 0, z: 2 }, velocity: { x: 0, y: 0, z: 0 }, facingYaw: 0 },
      { id: 'a-gk', team: 'away', goalkeeper: true, position: { x: 0, y: 0, z: 16.7 }, velocity: { x: 0, y: 0, z: 0 }, facingYaw: Math.PI },
      { id: 'a-1', team: 'away', goalkeeper: false, position: { x: 0, y: 0, z: 0.5 }, velocity: { x: 0, y: 0, z: 0 }, facingYaw: Math.PI },
      { id: 'a-2', team: 'away', goalkeeper: false, position: { x: 6, y: 0, z: 2 }, velocity: { x: 0, y: 0, z: 0 }, facingYaw: Math.PI },
    ],
    possessionTeam: null,
    possessionPlayerId: null,
  };
}

describe('adaptive defensive anticipation', () => {
  it('steers a defender toward the predicted interception point of a fast loose ball', () => {
    const decision = chooseDefensiveAction(looseBallWorld(), 'a-1', {
      predictionHorizonSeconds: 0.45,
      defensiveAnticipation: 0.6,
    });

    expect(decision.targetPosition.z).toBeGreaterThan(3);
  });

  it('sends the nearest player to recover a loose ball beyond the normal press radius', () => {
    const world = looseBallWorld();
    world.ball.position = { x: 0, y: 0.11, z: 0 };
    world.ball.velocity = { x: 0, y: 0, z: 0 };
    world.players.find((player) => player.id === 'h-1')!.position = { x: 0, y: 0, z: -5 };
    world.players.find((player) => player.id === 'h-2')!.position = { x: 6, y: 0, z: -6 };

    const decision = chooseDefensiveAction(world, 'h-1', {
      predictionHorizonSeconds: 0.35,
      defensiveAnticipation: 0.6,
    });

    expect(decision.kind).toBe('press');
    expect(decision.targetPosition).toEqual({ x: 0, y: 0, z: 0 });
  });
});

describe('off-ball support movement', () => {
  it('chooses the open support lane instead of running into a teammate', () => {
    const world = looseBallWorld();
    world.field = { halfWidth: 12, halfLength: 18, goalHalfWidth: 3.66 };
    world.ball.position = { x: 0, y: 0.11, z: 0 };
    world.possessionTeam = 'home';
    world.possessionPlayerId = 'h-1';
    world.players.find((player) => player.id === 'h-1')!.position = { x: 0, y: 0, z: 0 };
    const support = world.players.find((player) => player.id === 'h-2')!;
    support.position = { x: 4.2, y: 0, z: 1.7 };
    world.players.push({ id: 'h-3', team: 'home', goalkeeper: false, position: { x: 4.2, y: 0, z: 1.7 }, velocity: { x: 0, y: 0, z: 0 }, facingYaw: 0 });

    const decision = chooseOffBallAction(world, 'h-2', 'immediate-support', { coordinatedRunFrequency: 0.7 });

    expect(decision.targetPosition.x).toBeLessThan(0);
  });
});

describe('direct playstyle decision making', () => {
  it('keeps a clean progressive pass in the action set instead of forcing a dribble', () => {
    const world = looseBallWorld();
    world.ball.position = { x: 0, y: 0.11, z: 1 };
    world.possessionTeam = 'home';
    world.possessionPlayerId = 'h-1';
    world.players.find((player) => player.id === 'h-1')!.position = { x: 0, y: 0, z: 1 };
    world.players.find((player) => player.id === 'h-2')!.position = { x: 4, y: 0, z: 7 };
    world.players.find((player) => player.id === 'a-1')!.position = { x: -9, y: 0, z: 7 };
    world.players.find((player) => player.id === 'a-2')!.position = { x: 9, y: 0, z: 9 };

    const decision = chooseCarrierAction(world, 'h-1', { playstyle: 'direct', passRiskTolerance: 0.5 });

    expect(decision.kind).toBe('pass');
    expect(decision.targetPlayerId).toBe('h-2');
  });
});
