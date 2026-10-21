import { describe, expect, it } from 'vitest';
import { createTeamBotRuntime, selectShotTechnique, stepTeamBotRuntime } from './runtime';
import type { BotWorldSnapshot } from './types';

function world(): BotWorldSnapshot {
  return {
    tick: 0,
    timeSeconds: 0,
    field: { halfWidth: 12, halfLength: 18, goalHalfWidth: 3.66 },
    ball: { position: { x: -2, y: 0.11, z: 0 }, velocity: { x: 0, y: 0, z: 0 } },
    players: [
      { id: 'h-gk', team: 'home', goalkeeper: true, position: { x: 0, y: 0, z: -16.7 }, velocity: { x: 0, y: 0, z: 0 }, facingYaw: 0 },
      { id: 'h-1', team: 'home', goalkeeper: false, position: { x: -2, y: 0, z: 0 }, velocity: { x: 0, y: 0, z: 0 }, facingYaw: 0 },
      { id: 'h-2', team: 'home', goalkeeper: false, position: { x: 4, y: 0, z: 5 }, velocity: { x: 0, y: 0, z: 0 }, facingYaw: 0 },
      { id: 'a-gk', team: 'away', goalkeeper: true, position: { x: 0, y: 0, z: 16.7 }, velocity: { x: 0, y: 0, z: 0 }, facingYaw: Math.PI },
      { id: 'a-1', team: 'away', goalkeeper: false, position: { x: -1.2, y: 0, z: 1 }, velocity: { x: 0, y: 0, z: 0 }, facingYaw: Math.PI },
      { id: 'a-2', team: 'away', goalkeeper: false, position: { x: 3.5, y: 0, z: 6 }, velocity: { x: 0, y: 0, z: 0 }, facingYaw: Math.PI },
    ],
    possessionTeam: 'home',
    possessionPlayerId: 'h-1',
  };
}

const config = {
  seed: 0x7007,
  tier: 'standard' as const,
  personalitiesByPlayerId: { 'h-1': 'playmaker' as const, 'h-2': 'winger' as const, 'h-gk': 'calm-keeper' as const },
};

describe('Stage 07 adaptive runtime integration', () => {
  it('is exactly repeatable for the same seed, world, tier, and personalities', () => {
    const input = world();
    const first = stepTeamBotRuntime(input, 'home', createTeamBotRuntime(), config);
    const second = stepTeamBotRuntime(input, 'home', createTeamBotRuntime(), config);
    expect(second).toEqual(first);
  });

  it('never mutates the authoritative world while applying cognition noise', () => {
    const input = world();
    const before = JSON.stringify(input);
    stepTeamBotRuntime(input, 'home', createTeamBotRuntime(), { ...config, tier: 'novice' });
    expect(JSON.stringify(input)).toBe(before);
  });

  it('makes elite react to a turnover sooner than novice without changing physical limits', () => {
    const initial = world();
    const novice0 = stepTeamBotRuntime(initial, 'home', createTeamBotRuntime(), { ...config, tier: 'novice' });
    const elite0 = stepTeamBotRuntime(initial, 'home', createTeamBotRuntime(), { ...config, tier: 'elite' });

    const turnover = world();
    turnover.timeSeconds = 0.06;
    turnover.tick = 2;
    turnover.possessionTeam = 'away';
    turnover.possessionPlayerId = 'a-1';
    turnover.ball.position = { ...turnover.players.find((player) => player.id === 'a-1')!.position, y: 0.11 };

    const novice1 = stepTeamBotRuntime(turnover, 'home', novice0.state, { ...config, tier: 'novice' });
    const elite1 = stepTeamBotRuntime(turnover, 'home', elite0.state, { ...config, tier: 'elite' });
    expect(novice1.reevaluated).toBe(false);
    expect(elite1.reevaluated).toBe(true);
    for (const result of [novice1, elite1]) {
      expect(result.intents.every((intent) => Math.hypot(intent.moveX, intent.moveY) <= 1 + 1e-9)).toBe(true);
    }
  });

  it('uses personality configuration in real decisions rather than storing inert labels', () => {
    const input = world();
    input.players.find((player) => player.id === 'h-1')!.position = { x: 0, y: 0, z: 10.5 };
    input.ball.position = { x: 0, y: 0.11, z: 10.5 };
    input.players.find((player) => player.id === 'h-2')!.position = { x: 5, y: 0, z: 12 };
    input.players.find((player) => player.id === 'a-1')!.position = { x: 2.7, y: 0, z: 8.5 };
    const playmaker = stepTeamBotRuntime(input, 'home', createTeamBotRuntime(), {
      seed: 1,
      tier: 'standard',
      personalitiesByPlayerId: { 'h-1': 'playmaker' },
    });
    const poacher = stepTeamBotRuntime(input, 'home', createTeamBotRuntime(), {
      seed: 1,
      tier: 'standard',
      personalitiesByPlayerId: { 'h-1': 'poacher' },
    });
    const playmakerCarrier = playmaker.intents.find((intent) => intent.playerId === 'h-1')!;
    const poacherCarrier = poacher.intents.find((intent) => intent.playerId === 'h-1')!;
    expect(playmakerCarrier.utilityScore).not.toBe(poacherCarrier.utilityScore);
  });

  it('team playstyles produce distinct attacking shape and intent in the same seeded world', () => {
    const input = world();
    const outputs = (['possession', 'counter', 'high-press', 'direct'] as const).map((playstyle) =>
      stepTeamBotRuntime(input, 'home', createTeamBotRuntime(), { ...config, playstyle }).intents,
    );
    const signatures = outputs.map((intents) => intents.map((intent) => `${intent.playerId}:${intent.action}:${intent.targetPosition.x.toFixed(1)},${intent.targetPosition.z.toFixed(1)}`).join('|'));
    expect(new Set(signatures).size).toBe(4);
  });

  it('keeps possession support ahead of the ball as an available forward passing outlet', () => {
    const input = world();
    const support = stepTeamBotRuntime(input, 'home', createTeamBotRuntime(), { ...config, playstyle: 'possession' })
      .intents.find((intent) => intent.playerId === 'h-2')!;

    expect(support.role).toBe('immediate-support');
    expect(support.targetPosition.z).toBeGreaterThan(input.ball.position.z);
  });

  it('chooses a shot technique from angle, range, and keeper position instead of defaulting to finesse', () => {
    const input = world();
    const repertoire = ['normal-shot', 'driven-shot', 'finesse-shot', 'chip-shot'];
    input.players.find((player) => player.id === 'h-1')!.position = { x: 0, y: 0, z: 13 };
    expect(selectShotTechnique(input, 'h-1', repertoire)).toBe('normal-shot');
    const shotIntent = stepTeamBotRuntime(input, 'home', createTeamBotRuntime(), { ...config, tier: 'elite' }).intents.find((intent) => intent.playerId === 'h-1')!;
    expect(shotIntent.action).toBe('shoot');
    expect(shotIntent.aimYaw).toBeCloseTo(0, 1);
    input.players.find((player) => player.id === 'h-1')!.position = { x: 6, y: 0, z: 10 };
    expect(selectShotTechnique(input, 'h-1', repertoire)).toBe('finesse-shot');
    input.players.find((player) => player.id === 'h-1')!.position = { x: 0, y: 0, z: 0 };
    expect(selectShotTechnique(input, 'h-1', repertoire)).toBe('driven-shot');
    input.players.find((player) => player.id === 'h-1')!.position = { x: 0, y: 0, z: 13 };
    input.players.find((player) => player.id === 'a-gk')!.position.z = 10;
    expect(selectShotTechnique(input, 'h-1', repertoire)).toBe('chip-shot');
  });
});
