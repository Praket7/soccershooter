import { describe, expect, it } from 'vitest';
import { buildTacticalBlackboard } from './blackboard';
import type { BotWorldSnapshot } from './types';

function baseWorld(): BotWorldSnapshot {
  return {
    tick: 300,
    timeSeconds: 10,
    field: { halfWidth: 12, halfLength: 18, goalHalfWidth: 3.66 },
    ball: { position: { x: -5, y: 0.11, z: 15 }, velocity: { x: 0, y: 0, z: 0 } },
    players: [
      { id: 'h-gk', team: 'home', goalkeeper: true, position: { x: 0, y: 0, z: -16.5 }, velocity: { x: 0, y: 0, z: 0 }, facingYaw: 0 },
      { id: 'h-1', team: 'home', goalkeeper: false, position: { x: -4, y: 0, z: 10 }, velocity: { x: 0, y: 0, z: 0 }, facingYaw: 0 },
      { id: 'h-2', team: 'home', goalkeeper: false, position: { x: 4, y: 0, z: 9 }, velocity: { x: 0, y: 0, z: 0 }, facingYaw: 0 },
      { id: 'a-gk', team: 'away', goalkeeper: true, position: { x: 0, y: 0, z: 16.5 }, velocity: { x: 0, y: 0, z: 0 }, facingYaw: Math.PI },
      { id: 'a-1', team: 'away', goalkeeper: false, position: { x: -2, y: 0, z: 12 }, velocity: { x: 0, y: 0, z: 0 }, facingYaw: Math.PI },
      { id: 'a-2', team: 'away', goalkeeper: false, position: { x: 3, y: 0, z: 11 }, velocity: { x: 0, y: 0, z: 0 }, facingYaw: Math.PI },
    ],
    possessionTeam: null,
    possessionPlayerId: null,
    matchState: {
      phase: 'restart',
      restart: 'corner',
      restartTeam: 'home',
      scoreHome: 1,
      scoreAway: 1,
      secondsRemaining: 94,
    },
  };
}

describe('Stage 06 tactical match context', () => {
  it('derives restart and score context into the tactical blackboard', () => {
    const board = buildTacticalBlackboard(baseWorld(), 'home');
    expect(board.matchPhase).toBe('restart');
    expect(board.restartKind).toBe('corner');
    expect(board.restartTeam).toBe('home');
    expect(board.scoreFor).toBe(1);
    expect(board.scoreAgainst).toBe(1);
    expect(board.secondsRemaining).toBe(94);
  });

  it('defaults omitted match context to ordinary live play without inventing a restart', () => {
    const snapshot = baseWorld();
    delete snapshot.matchState;
    const board = buildTacticalBlackboard(snapshot, 'away');
    expect(board.matchPhase).toBe('live');
    expect(board.restartKind).toBe('none');
    expect(board.restartTeam).toBeNull();
  });
});