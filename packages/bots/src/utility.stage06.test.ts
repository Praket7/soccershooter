import { describe, expect, it } from 'vitest';
import type { BotWorldSnapshot } from './types';
import { chooseCarrierAction, chooseDefensiveAction, chooseDribbleTarget, chooseOffBallAction } from './utility';

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

  it('moves the support runner into a forward, passable lane when the defense is goal-side', () => {
    const snapshot = world({
      players: [
        { id: 'h-gk', team: 'home', goalkeeper: true, position: { x: 0, y: 0, z: -16.5 }, velocity: { x: 0, y: 0, z: 0 }, facingYaw: 0 },
        { id: 'h-1', team: 'home', goalkeeper: false, position: { x: 0, y: 0, z: 0 }, velocity: { x: 0, y: 0, z: 0 }, facingYaw: 0 },
        { id: 'h-2', team: 'home', goalkeeper: false, position: { x: 1, y: 0, z: -1 }, velocity: { x: 0, y: 0, z: 0 }, facingYaw: 0 },
        { id: 'a-gk', team: 'away', goalkeeper: true, position: { x: 0, y: 0, z: 16.5 }, velocity: { x: 0, y: 0, z: 0 }, facingYaw: Math.PI },
        { id: 'a-1', team: 'away', goalkeeper: false, position: { x: -2, y: 0, z: 8 }, velocity: { x: 0, y: 0, z: 0 }, facingYaw: Math.PI },
        { id: 'a-2', team: 'away', goalkeeper: false, position: { x: 3, y: 0, z: 10 }, velocity: { x: 0, y: 0, z: 0 }, facingYaw: Math.PI },
      ],
    });

    const action = chooseOffBallAction(snapshot, 'h-2', 'immediate-support', { coordinatedRunFrequency: 0.86 });

    expect(action.kind).toBe('support');
    expect(action.targetPosition.z).toBeGreaterThan(2.5);
    expect(Math.abs(action.targetPosition.x)).toBeGreaterThan(5.4);
  });

  it('keeps an open support run stable across a small defender movement', () => {
    const firstWorld = world();
    const first = chooseOffBallAction(firstWorld, 'h-2', 'immediate-support', { coordinatedRunFrequency: 0.86 });
    const nextWorld = world();
    nextWorld.players.find((player) => player.id === 'a-1')!.position.x += 0.35;
    const next = chooseOffBallAction(nextWorld, 'h-2', 'immediate-support', {
      coordinatedRunFrequency: 0.86,
      previousOffBallTarget: first.targetPosition,
    });

    expect(Math.hypot(next.targetPosition.x - first.targetPosition.x, next.targetPosition.z - first.targetPosition.z)).toBeLessThan(2.5);
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

  it('chooses the more open support side when a defender blocks the obvious outlet', () => {
    const snapshot = world({
      players: [
        { id: 'h-gk', team: 'home', goalkeeper: true, position: { x: 0, y: 0, z: -16.5 }, velocity: { x: 0, y: 0, z: 0 }, facingYaw: 0 },
        { id: 'h-1', team: 'home', goalkeeper: false, position: { x: 0, y: 0, z: 0 }, velocity: { x: 0, y: 0, z: 0 }, facingYaw: 0 },
        { id: 'h-2', team: 'home', goalkeeper: false, position: { x: 1, y: 0, z: -1 }, velocity: { x: 0, y: 0, z: 0 }, facingYaw: 0 },
        { id: 'a-gk', team: 'away', goalkeeper: true, position: { x: 0, y: 0, z: 16.5 }, velocity: { x: 0, y: 0, z: 0 }, facingYaw: Math.PI },
        { id: 'a-1', team: 'away', goalkeeper: false, position: { x: 3.8, y: 0, z: 1.4 }, velocity: { x: 0, y: 0, z: 0 }, facingYaw: Math.PI },
        { id: 'a-2', team: 'away', goalkeeper: false, position: { x: 7, y: 0, z: 8 }, velocity: { x: 0, y: 0, z: 0 }, facingYaw: Math.PI },
      ],
    });
    const action = chooseOffBallAction(snapshot, 'h-2', 'immediate-support', {
      personalityId: 'balanced',
      coordinatedRunFrequency: 0.64,
    });

    expect(action.targetPosition.x).toBeLessThan(0);
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

describe('adaptive carrier utility', () => {
  it('advances through open space instead of recycling a safe short pass', () => {
    const snapshot = world({
      players: [
        { id: 'h-gk', team: 'home', goalkeeper: true, position: { x: 0, y: 0, z: -16.5 }, velocity: { x: 0, y: 0, z: 0 }, facingYaw: 0 },
        { id: 'h-1', team: 'home', goalkeeper: false, position: { x: 0, y: 0, z: 0 }, velocity: { x: 0, y: 0, z: 0 }, facingYaw: 0 },
        { id: 'h-2', team: 'home', goalkeeper: false, position: { x: 1, y: 0, z: -1 }, velocity: { x: 0, y: 0, z: 0 }, facingYaw: 0 },
        { id: 'a-gk', team: 'away', goalkeeper: true, position: { x: 0, y: 0, z: 16.5 }, velocity: { x: 0, y: 0, z: 0 }, facingYaw: Math.PI },
        { id: 'a-1', team: 'away', goalkeeper: false, position: { x: 8, y: 0, z: 10 }, velocity: { x: 0, y: 0, z: 0 }, facingYaw: Math.PI },
        { id: 'a-2', team: 'away', goalkeeper: false, position: { x: -8, y: 0, z: 10 }, velocity: { x: 0, y: 0, z: 0 }, facingYaw: Math.PI },
      ],
    });

    expect(chooseCarrierAction(snapshot, 'h-1').kind).toBe('dribble');
  });

  it('plays a quick forward continuation when the receiver has a clear next outlet', () => {
    const snapshot = world({
      ball: { position: { x: 0, y: 0.11, z: -2 }, velocity: { x: 0, y: 0, z: 0 } },
      passReceiverId: 'h-1',
      players: [
        { id: 'h-gk', team: 'home', goalkeeper: true, position: { x: 0, y: 0, z: -16.5 }, velocity: { x: 0, y: 0, z: 0 }, facingYaw: 0 },
        { id: 'h-1', team: 'home', goalkeeper: false, position: { x: 0, y: 0, z: -2 }, velocity: { x: 0, y: 0, z: 0 }, facingYaw: 0 },
        { id: 'h-2', team: 'home', goalkeeper: false, position: { x: 2, y: 0, z: 5 }, velocity: { x: 0, y: 0, z: 0 }, facingYaw: 0 },
        { id: 'a-gk', team: 'away', goalkeeper: true, position: { x: 0, y: 0, z: 16.5 }, velocity: { x: 0, y: 0, z: 0 }, facingYaw: Math.PI },
        { id: 'a-1', team: 'away', goalkeeper: false, position: { x: 8, y: 0, z: 6 }, velocity: { x: 0, y: 0, z: 0 }, facingYaw: Math.PI },
        { id: 'a-2', team: 'away', goalkeeper: false, position: { x: -8, y: 0, z: 6 }, velocity: { x: 0, y: 0, z: 0 }, facingYaw: Math.PI },
      ],
    });

    const decision = chooseCarrierAction(snapshot, 'h-1', { playstyle: 'possession' });
    expect(decision).toMatchObject({ kind: 'pass', targetPlayerId: 'h-2' });
  });

  it('uses a safe give-and-go outlet under pressure instead of carrying into the defender', () => {
    const snapshot = world({
      ball: { position: { x: 0, y: 0.11, z: -2 }, velocity: { x: 0, y: 0, z: 0 } },
      passReceiverId: 'h-1',
      players: [
        { id: 'h-gk', team: 'home', goalkeeper: true, position: { x: 0, y: 0, z: -16.5 }, velocity: { x: 0, y: 0, z: 0 }, facingYaw: 0 },
        { id: 'h-1', team: 'home', goalkeeper: false, position: { x: 0, y: 0, z: -2 }, velocity: { x: 0, y: 0, z: 0 }, facingYaw: 0 },
        { id: 'h-2', team: 'home', goalkeeper: false, position: { x: 2, y: 0, z: -5 }, velocity: { x: 0, y: 0, z: 0 }, facingYaw: 0 },
        { id: 'a-gk', team: 'away', goalkeeper: true, position: { x: 0, y: 0, z: 16.5 }, velocity: { x: 0, y: 0, z: 0 }, facingYaw: Math.PI },
        { id: 'a-1', team: 'away', goalkeeper: false, position: { x: -2.5, y: 0, z: -2 }, velocity: { x: 0, y: 0, z: 0 }, facingYaw: Math.PI },
        { id: 'a-2', team: 'away', goalkeeper: false, position: { x: -8, y: 0, z: -8 }, velocity: { x: 0, y: 0, z: 0 }, facingYaw: Math.PI },
      ],
    });

    expect(chooseCarrierAction(snapshot, 'h-1')).toMatchObject({ kind: 'pass', targetPlayerId: 'h-2' });
  });

  it('takes a clear close-range shot instead of endlessly carrying toward goal', () => {
    const snapshot = world({
      ball: { position: { x: 0, y: 0.11, z: 13 }, velocity: { x: 0, y: 0, z: 0 } },
      players: [
        { id: 'h-gk', team: 'home', goalkeeper: true, position: { x: 0, y: 0, z: -16.5 }, velocity: { x: 0, y: 0, z: 0 }, facingYaw: 0 },
        { id: 'h-1', team: 'home', goalkeeper: false, position: { x: 0, y: 0, z: 13 }, velocity: { x: 0, y: 0, z: 0 }, facingYaw: 0 },
        { id: 'h-2', team: 'home', goalkeeper: false, position: { x: 7, y: 0, z: 8 }, velocity: { x: 0, y: 0, z: 0 }, facingYaw: 0 },
        { id: 'a-gk', team: 'away', goalkeeper: true, position: { x: 0, y: 0, z: 16.5 }, velocity: { x: 0, y: 0, z: 0 }, facingYaw: Math.PI },
        { id: 'a-1', team: 'away', goalkeeper: false, position: { x: -8, y: 0, z: 9 }, velocity: { x: 0, y: 0, z: 0 }, facingYaw: Math.PI },
        { id: 'a-2', team: 'away', goalkeeper: false, position: { x: 8, y: 0, z: 10 }, velocity: { x: 0, y: 0, z: 0 }, facingYaw: Math.PI },
      ],
    });
    const decision = chooseCarrierAction(snapshot, 'h-1');
    expect(decision.kind).toBe('shoot');
    expect(decision.score).toBeGreaterThanOrEqual(0.94);
  });

  it('finishes a better clear close chance when a safe pass score saturates', () => {
    const snapshot = world({
      ball: { position: { x: 0.3, y: 0.11, z: 14.4 }, velocity: { x: 0, y: 0, z: 0 } },
      players: [
        { id: 'h-gk', team: 'home', goalkeeper: true, position: { x: 0, y: 0, z: -16.5 }, velocity: { x: 0, y: 0, z: 0 }, facingYaw: 0 },
        { id: 'h-1', team: 'home', goalkeeper: false, position: { x: 0.3, y: 0, z: 14.4 }, velocity: { x: 0, y: 0, z: 0 }, facingYaw: 0 },
        { id: 'h-2', team: 'home', goalkeeper: false, position: { x: 4, y: 0, z: 13 }, velocity: { x: 0, y: 0, z: 0 }, facingYaw: 0 },
        { id: 'a-gk', team: 'away', goalkeeper: true, position: { x: 1.2, y: 0, z: 16.5 }, velocity: { x: 0, y: 0, z: 0 }, facingYaw: Math.PI },
        { id: 'a-1', team: 'away', goalkeeper: false, position: { x: -8, y: 0, z: 9 }, velocity: { x: 0, y: 0, z: 0 }, facingYaw: Math.PI },
        { id: 'a-2', team: 'away', goalkeeper: false, position: { x: 8, y: 0, z: 10 }, velocity: { x: 0, y: 0, z: 0 }, facingYaw: Math.PI },
      ],
    });

    expect(chooseCarrierAction(snapshot, 'h-1', { playstyle: 'possession' }).kind).toBe('shoot');
  });

  it('keeps the pass when the receiver has a clearly better immediate shot', () => {
    const snapshot = world({
      ball: { position: { x: 0.3, y: 0.11, z: 12 }, velocity: { x: 0, y: 0, z: 0 } },
      players: [
        { id: 'h-gk', team: 'home', goalkeeper: true, position: { x: 0, y: 0, z: -16.5 }, velocity: { x: 0, y: 0, z: 0 }, facingYaw: 0 },
        { id: 'h-1', team: 'home', goalkeeper: false, position: { x: 0.3, y: 0, z: 12 }, velocity: { x: 0, y: 0, z: 0 }, facingYaw: 0 },
        { id: 'h-2', team: 'home', goalkeeper: false, position: { x: 0, y: 0, z: 16 }, velocity: { x: 0, y: 0, z: 0 }, facingYaw: 0 },
        { id: 'a-gk', team: 'away', goalkeeper: true, position: { x: 5, y: 0, z: 16.5 }, velocity: { x: 0, y: 0, z: 0 }, facingYaw: Math.PI },
        { id: 'a-1', team: 'away', goalkeeper: false, position: { x: -8, y: 0, z: 8 }, velocity: { x: 0, y: 0, z: 0 }, facingYaw: Math.PI },
        { id: 'a-2', team: 'away', goalkeeper: false, position: { x: 8, y: 0, z: 9 }, velocity: { x: 0, y: 0, z: 0 }, facingYaw: Math.PI },
      ],
    });

    expect(chooseCarrierAction(snapshot, 'h-1', { playstyle: 'possession' })).toMatchObject({ kind: 'pass', targetPlayerId: 'h-2' });
  });

  it('takes a clear central look from the edge of the box instead of always carrying closer', () => {
    const snapshot = world({
      ball: { position: { x: 0, y: 0.11, z: 3.5 }, velocity: { x: 0, y: 0, z: 0 } },
      players: [
        { id: 'h-gk', team: 'home', goalkeeper: true, position: { x: 0, y: 0, z: -16.5 }, velocity: { x: 0, y: 0, z: 0 }, facingYaw: 0 },
        { id: 'h-1', team: 'home', goalkeeper: false, position: { x: 0, y: 0, z: 3.5 }, velocity: { x: 0, y: 0, z: 0 }, facingYaw: 0 },
        { id: 'h-2', team: 'home', goalkeeper: false, position: { x: 7, y: 0, z: 8 }, velocity: { x: 0, y: 0, z: 0 }, facingYaw: 0 },
        { id: 'a-gk', team: 'away', goalkeeper: true, position: { x: 0, y: 0, z: 16.5 }, velocity: { x: 0, y: 0, z: 0 }, facingYaw: Math.PI },
        { id: 'a-1', team: 'away', goalkeeper: false, position: { x: -8, y: 0, z: 9 }, velocity: { x: 0, y: 0, z: 0 }, facingYaw: Math.PI },
        { id: 'a-2', team: 'away', goalkeeper: false, position: { x: 8, y: 0, z: 10 }, velocity: { x: 0, y: 0, z: 0 }, facingYaw: Math.PI },
      ],
    });

    expect(chooseCarrierAction(snapshot, 'h-1').kind).toBe('shoot');
  });

  it('recognizes a defender in the central shot lane and chooses the open teammate instead', () => {
    const snapshot = world({
      ball: { position: { x: 0, y: 0.11, z: 12 }, velocity: { x: 0, y: 0, z: 0 } },
      players: [
        { id: 'h-gk', team: 'home', goalkeeper: true, position: { x: 0, y: 0, z: -16.5 }, velocity: { x: 0, y: 0, z: 0 }, facingYaw: 0 },
        { id: 'h-1', team: 'home', goalkeeper: false, position: { x: 0, y: 0, z: 12 }, velocity: { x: 0, y: 0, z: 0 }, facingYaw: 0 },
        { id: 'h-2', team: 'home', goalkeeper: false, position: { x: 5, y: 0, z: 12 }, velocity: { x: 0, y: 0, z: 0 }, facingYaw: 0 },
        { id: 'a-gk', team: 'away', goalkeeper: true, position: { x: 0, y: 0, z: 16.5 }, velocity: { x: 0, y: 0, z: 0 }, facingYaw: Math.PI },
        { id: 'a-1', team: 'away', goalkeeper: false, position: { x: 0, y: 0, z: 14 }, velocity: { x: 0, y: 0, z: 0 }, facingYaw: Math.PI },
        { id: 'a-2', team: 'away', goalkeeper: false, position: { x: 8, y: 0, z: 10 }, velocity: { x: 0, y: 0, z: 0 }, facingYaw: Math.PI },
      ],
    });

    const decision = chooseCarrierAction(snapshot, 'h-1');

    expect(decision.kind).toBe('pass');
    expect(decision.targetPlayerId).toBe('h-2');
  });

  it('carries around a blocked central lane instead of dribbling straight into defenders', () => {
    const snapshot = world({
      players: [
        { id: 'h-gk', team: 'home', goalkeeper: true, position: { x: 0, y: 0, z: -16.5 }, velocity: { x: 0, y: 0, z: 0 }, facingYaw: 0 },
        { id: 'h-1', team: 'home', goalkeeper: false, position: { x: 0, y: 0, z: 0 }, velocity: { x: 0, y: 0, z: 0 }, facingYaw: 0 },
        { id: 'h-2', team: 'home', goalkeeper: false, position: { x: 7, y: 0, z: -1 }, velocity: { x: 0, y: 0, z: 0 }, facingYaw: 0 },
        { id: 'a-gk', team: 'away', goalkeeper: true, position: { x: 0, y: 0, z: 16.5 }, velocity: { x: 0, y: 0, z: 0 }, facingYaw: Math.PI },
        { id: 'a-1', team: 'away', goalkeeper: false, position: { x: 0, y: 0, z: 4 }, velocity: { x: 0, y: 0, z: 0 }, facingYaw: Math.PI },
        { id: 'a-2', team: 'away', goalkeeper: false, position: { x: 1, y: 0, z: 8 }, velocity: { x: 0, y: 0, z: 0 }, facingYaw: Math.PI },
      ],
    });

    expect(Math.abs(chooseDribbleTarget(snapshot, 'h-1').x)).toBeGreaterThan(3);
  });

  it('cuts in from the wing when approaching goal instead of carrying into a dead-end angle', () => {
    const snapshot = world({
      ball: { position: { x: 9, y: 0.11, z: 7 }, velocity: { x: 0, y: 0, z: 0 } },
      players: [
        { id: 'h-gk', team: 'home', goalkeeper: true, position: { x: 0, y: 0, z: -16.5 }, velocity: { x: 0, y: 0, z: 0 }, facingYaw: 0 },
        { id: 'h-1', team: 'home', goalkeeper: false, position: { x: 9, y: 0, z: 7 }, velocity: { x: 0, y: 0, z: 0 }, facingYaw: 0 },
        { id: 'h-2', team: 'home', goalkeeper: false, position: { x: 5, y: 0, z: 5 }, velocity: { x: 0, y: 0, z: 0 }, facingYaw: 0 },
        { id: 'a-gk', team: 'away', goalkeeper: true, position: { x: 0, y: 0, z: 16.5 }, velocity: { x: 0, y: 0, z: 0 }, facingYaw: Math.PI },
        { id: 'a-1', team: 'away', goalkeeper: false, position: { x: 5, y: 0, z: 11 }, velocity: { x: 0, y: 0, z: 0 }, facingYaw: Math.PI },
        { id: 'a-2', team: 'away', goalkeeper: false, position: { x: -4, y: 0, z: 10 }, velocity: { x: 0, y: 0, z: 0 }, facingYaw: Math.PI },
      ],
    });
    expect(Math.abs(chooseDribbleTarget(snapshot, 'h-1').x)).toBeLessThan(5);
  });
});
