import { describe, expect, it } from 'vitest';
import type { BotWorldSnapshot } from './types';
import { chooseDefensiveAction, chooseOffBallAction } from './utility';

function world(overrides: Partial<BotWorldSnapshot> = {}): BotWorldSnapshot {
  return {
    tick: 90,
    timeSeconds: 3,
    field: { halfWidth: 12, halfLength: 18, goalHalfWidth: 3.66 },
    ball: { position: { x: 0, y: 0.11, z: 0 }, velocity: { x: 0, y: 0, z: 0 } },
    players: [
      { id: 'h-gk', team: 'home', goalkeeper: true, position: { x: 0, y: 0, z: -16.5 }, velocity: { x: 0, y: 0, z: 0 }, facingYaw: 0 },
      { id: 'h-1', team: 'home', goalkeeper: false, position: { x: 0, y: 0, z: 0 }, velocity: { x: 0, y: 0, z: 0 }, facingYaw: 0 },
      { id: 'h-2', team: 'home', goalkeeper: false, position: { x: 1, y: 0, z: -1 }, velocity: { x: 0, y: 0, z: 0 }, facingYaw: 0 },
      { id: 'a-gk', team: 'away', goalkeeper: true, position: { x: 0, y: 0, z: 16.5 }, velocity: { x: 0, y: 0, z: 0 }, facingYaw: Math.PI },
      { id: 'a-1', team: 'away', goalkeeper: false, position: { x: -0.5, y: 0, z: 2 }, velocity: { x: 0, y: 0, z: 0 }, facingYaw: Math.PI },
      { id: 'a-2', team: 'away', goalkeeper: false, position: { x: 3, y: 0, z: 5 }, velocity: { x: 0, y: 0, z: 0 }, facingYaw: Math.PI },
    ],
    possessionTeam: 'home',
    possessionPlayerId: 'h-1',
    ...overrides,
  };
}

describe('Stage 06 off-ball utility', () => {
  it('immediate support deliberately leaves the carrier lane', () => {
    const action = chooseOffBallAction(world(), 'h-2', 'immediate-support');
    expect(action.kind).toBe('support');
    expect(Math.abs(action.targetPosition.x)).toBeGreaterThanOrEqual(3.2);
    expect(Math.hypot(action.targetPosition.x, action.targetPosition.z)).toBeGreaterThanOrEqual(3.5);
    expect(action.score).toBeGreaterThan(0.5);
  });

  it('width support preserves a real wide outlet instead of collapsing centrally', () => {
    const action = chooseOffBallAction(world(), 'h-2', 'width-support');
    expect(action.kind).toBe('width');
    expect(Math.abs(action.targetPosition.x)).toBeGreaterThanOrEqual(6);
    expect(action.score).toBeGreaterThan(0.45);
  });

  it('far-side attacker recognizes a back-post run in the final third', () => {
    const snapshot = world({
      ball: { position: { x: -6, y: 0.11, z: 10 }, velocity: { x: 0, y: 0, z: 0 } },
      players: [
        { id: 'h-gk', team: 'home', goalkeeper: true, position: { x: 0, y: 0, z: -16.5 }, velocity: { x: 0, y: 0, z: 0 }, facingYaw: 0 },
        { id: 'h-1', team: 'home', goalkeeper: false, position: { x: -6, y: 0, z: 10 }, velocity: { x: 0, y: 0, z: 0 }, facingYaw: 0 },
        { id: 'h-2', team: 'home', goalkeeper: false, position: { x: 2.5, y: 0, z: 8.5 }, velocity: { x: 0, y: 0, z: 0 }, facingYaw: 0 },
        { id: 'a-gk', team: 'away', goalkeeper: true, position: { x: 0, y: 0, z: 16.5 }, velocity: { x: 0, y: 0, z: 0 }, facingYaw: Math.PI },
        { id: 'a-1', team: 'away', goalkeeper: false, position: { x: -5, y: 0, z: 11 }, velocity: { x: 0, y: 0, z: 0 }, facingYaw: Math.PI },
        { id: 'a-2', team: 'away', goalkeeper: false, position: { x: -1, y: 0, z: 13 }, velocity: { x: 0, y: 0, z: 0 }, facingYaw: Math.PI },
      ],
    });
    const action = chooseOffBallAction(snapshot, 'h-2', 'width-support');
    expect(action.kind).toBe('back-post-run');
    expect(action.targetPosition.x).toBeGreaterThan(3);
    expect(action.targetPosition.z).toBeGreaterThan(12);
  });
});

describe('Stage 06 defensive utility', () => {
  it('cover defender blocks a dangerous shooting lane instead of blindly joining the press', () => {
    const snapshot = world({
      possessionTeam: 'away',
      possessionPlayerId: 'a-1',
      ball: { position: { x: 0.5, y: 0.11, z: -9.5 }, velocity: { x: 0, y: 0, z: 0 } },
      players: [
        { id: 'h-gk', team: 'home', goalkeeper: true, position: { x: 0, y: 0, z: -16.5 }, velocity: { x: 0, y: 0, z: 0 }, facingYaw: 0 },
        { id: 'h-1', team: 'home', goalkeeper: false, position: { x: 0.3, y: 0, z: -8.7 }, velocity: { x: 0, y: 0, z: 0 }, facingYaw: Math.PI },
        { id: 'h-2', team: 'home', goalkeeper: false, position: { x: 3.5, y: 0, z: -12 }, velocity: { x: 0, y: 0, z: 0 }, facingYaw: Math.PI },
        { id: 'a-gk', team: 'away', goalkeeper: true, position: { x: 0, y: 0, z: 16.5 }, velocity: { x: 0, y: 0, z: 0 }, facingYaw: Math.PI },
        { id: 'a-1', team: 'away', goalkeeper: false, position: { x: 0.5, y: 0, z: -9.5 }, velocity: { x: 0, y: 0, z: 0 }, facingYaw: Math.PI },
        { id: 'a-2', team: 'away', goalkeeper: false, position: { x: -4, y: 0, z: -8 }, velocity: { x: 0, y: 0, z: 0 }, facingYaw: Math.PI },
      ],
    });
    const action = chooseDefensiveAction(snapshot, 'h-2');
    expect(['block-shot', 'block-lane']).toContain(action.kind);
    expect(action.targetPosition.z).toBeLessThan(snapshot.ball.position.z);
    expect(action.score).toBeGreaterThan(0.55);
  });
});
