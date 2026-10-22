import { describe, expect, it } from 'vitest';
import type { BotWorldSnapshot } from './types';

const baseWorld = (): BotWorldSnapshot => ({
  tick: 120,
  timeSeconds: 4,
  field: { halfWidth: 12, halfLength: 18, goalHalfWidth: 3.66 },
  ball: { position: { x: 0, y: 0.11, z: 0 }, velocity: { x: 0, y: 0, z: 0 } },
  players: [
    { id: 'h-gk', team: 'home', goalkeeper: true, position: { x: 0, y: 0, z: -16.5 }, velocity: { x: 0, y: 0, z: 0 }, facingYaw: 0 },
    { id: 'h-1', team: 'home', goalkeeper: false, position: { x: -2, y: 0, z: -1 }, velocity: { x: 0, y: 0, z: 0 }, facingYaw: 0 },
    { id: 'h-2', team: 'home', goalkeeper: false, position: { x: 3, y: 0, z: 1 }, velocity: { x: 0, y: 0, z: 0 }, facingYaw: 0 },
    { id: 'a-gk', team: 'away', goalkeeper: true, position: { x: 0, y: 0, z: 16.5 }, velocity: { x: 0, y: 0, z: 0 }, facingYaw: Math.PI },
    { id: 'a-1', team: 'away', goalkeeper: false, position: { x: 0, y: 0, z: 5 }, velocity: { x: 0, y: 0, z: 0 }, facingYaw: Math.PI },
    { id: 'a-2', team: 'away', goalkeeper: false, position: { x: -4, y: 0, z: 7 }, velocity: { x: 0, y: 0, z: 0 }, facingYaw: Math.PI },
  ],
  possessionTeam: 'home',
  possessionPlayerId: 'h-1',
});

async function loadRuntime() {
  const module = await import('./runtime').catch(() => null);
  expect(module, 'Stage 06 team runtime must exist').not.toBeNull();
  return module as NonNullable<typeof module>;
}

describe('Stage 06 tactical runtime cadence', () => {
  it('reevaluates tactics at 10 Hz while continuous steering remains bounded', async () => {
    const { createTeamBotRuntime, stepTeamBotRuntime } = await loadRuntime();
    const initial = createTeamBotRuntime();
    const first = stepTeamBotRuntime(baseWorld(), 'home', initial);
    expect(first.reevaluated).toBe(true);
    expect(first.intents.length).toBe(3);
    expect(first.intents.every((intent: { moveX: number; moveY: number }) => Math.hypot(intent.moveX, intent.moveY) <= 1.000001)).toBe(true);

    const world50ms = { ...baseWorld(), timeSeconds: 4.05, tick: 122 };
    const second = stepTeamBotRuntime(world50ms, 'home', first.state);
    expect(second.reevaluated).toBe(false);
    expect(second.intents).toHaveLength(first.intents.length);

    const world110ms = { ...baseWorld(), timeSeconds: 4.11, tick: 123 };
    const third = stepTeamBotRuntime(world110ms, 'home', second.state);
    expect(third.reevaluated).toBe(true);
  });

  it('critical possession changes trigger an immediate tactical reevaluation', async () => {
    const { createTeamBotRuntime, stepTeamBotRuntime } = await loadRuntime();
    const first = stepTeamBotRuntime(baseWorld(), 'home', createTeamBotRuntime());
    const turnover: BotWorldSnapshot = {
      ...baseWorld(),
      timeSeconds: 4.035,
      tick: 121,
      possessionTeam: 'away',
      possessionPlayerId: 'a-1',
      ball: { position: { x: 0, y: 0.11, z: 4.8 }, velocity: { x: 0, y: 0, z: -1.5 } },
    };
    const result = stepTeamBotRuntime(turnover, 'home', first.state);
    expect(result.reevaluated).toBe(true);
    expect(result.state.roles.phase).toBe('defend');
    expect(result.intents.some((intent: { role: string }) => intent.role === 'presser')).toBe(true);
  });

  it('immediately gives the carrier role to a teammate who gains possession', async () => {
    const { createTeamBotRuntime, stepTeamBotRuntime } = await loadRuntime();
    const loose: BotWorldSnapshot = {
      ...baseWorld(),
      timeSeconds: 4,
      possessionTeam: null,
      possessionPlayerId: null,
    };
    const first = stepTeamBotRuntime(loose, 'home', createTeamBotRuntime(), { tier: 'standard', seed: 1 });
    const gain: BotWorldSnapshot = {
      ...loose,
      timeSeconds: 4.01,
      possessionTeam: 'home',
      possessionPlayerId: 'h-1',
    };

    const result = stepTeamBotRuntime(gain, 'home', first.state, { tier: 'standard', seed: 1 });

    expect(result.reevaluated).toBe(true);
    expect(result.intents.find((intent) => intent.playerId === 'h-1')?.role).toBe('ball-carrier');
  });

  it('aims at the receiver but stays with the ball until a legal pass contact is available', async () => {
    const { createTeamBotRuntime, stepTeamBotRuntime } = await loadRuntime();
    const pressured: BotWorldSnapshot = {
      tick: 200,
      timeSeconds: 7,
      field: { halfWidth: 12, halfLength: 18, goalHalfWidth: 3.66 },
      ball: { position: { x: 0.8, y: 0.11, z: 0 }, velocity: { x: 0, y: 0, z: 0 } },
      players: [
        { id: 'h-gk', team: 'home', goalkeeper: true, position: { x: 0, y: 0, z: -16.5 }, velocity: { x: 0, y: 0, z: 0 }, facingYaw: 0 },
        { id: 'h-1', team: 'home', goalkeeper: false, position: { x: 0, y: 0, z: 0 }, velocity: { x: 0, y: 0, z: 0 }, facingYaw: 0 },
        { id: 'h-2', team: 'home', goalkeeper: false, position: { x: 5, y: 0, z: 5 }, velocity: { x: 0, y: 0, z: 0 }, facingYaw: 0 },
        { id: 'a-gk', team: 'away', goalkeeper: true, position: { x: 0, y: 0, z: 16.5 }, velocity: { x: 0, y: 0, z: 0 }, facingYaw: Math.PI },
        { id: 'a-1', team: 'away', goalkeeper: false, position: { x: 0.5, y: 0, z: 0.8 }, velocity: { x: 0, y: 0, z: 0 }, facingYaw: Math.PI },
        { id: 'a-2', team: 'away', goalkeeper: false, position: { x: -0.8, y: 0, z: 1.2 }, velocity: { x: 0, y: 0, z: 0 }, facingYaw: Math.PI },
      ],
      possessionTeam: 'home',
      possessionPlayerId: 'h-1',
    };
    const result = stepTeamBotRuntime(pressured, 'home', createTeamBotRuntime());
    const carrier = result.intents.find((intent: { playerId: string }) => intent.playerId === 'h-1');
    expect(carrier).toBeDefined();
    expect(carrier!.action).toBe('pass');
    expect(carrier!.targetPlayerId).toBe('h-2');
    expect(carrier!.targetPosition.x).toBeCloseTo(0.8, 6);
    expect(carrier!.targetPosition.z).toBeCloseTo(0.45, 6);
    expect(Math.hypot(carrier!.moveX, carrier!.moveY)).toBeGreaterThan(0.15);
    expect(carrier!.aimYaw).toBeCloseTo(Math.PI / 4, 3);
  });

  it('keeps the carrier inside ball-contact range while setting up a shot', async () => {
    const { createTeamBotRuntime, stepTeamBotRuntime } = await loadRuntime();
    const closeLook: BotWorldSnapshot = {
      ...baseWorld(),
      ball: { position: { x: 0, y: 0.11, z: 13 }, velocity: { x: 0, y: 0, z: 0 } },
      players: baseWorld().players.map((player) => player.id === 'h-1'
        ? { ...player, position: { x: 0, y: 0, z: 13 } }
        : player.id === 'a-1' || player.id === 'a-2'
          ? { ...player, position: { x: 10, y: 0, z: player.position.z } }
        : player),
    };
    const result = stepTeamBotRuntime(closeLook, 'home', createTeamBotRuntime());
    const carrier = result.intents.find((intent: { playerId: string }) => intent.playerId === 'h-1');
    expect(carrier?.action).toBe('shoot');
    expect(carrier?.targetPosition.x).toBeCloseTo(closeLook.ball.position.x, 6);
    expect(carrier?.targetPosition.z).toBeCloseTo(closeLook.ball.position.z + 0.45, 6);
  });

  it('lets a goalkeeper sprint across the goal mouth for a distant on-target shot', async () => {
    const { createTeamBotRuntime, stepTeamBotRuntime } = await loadRuntime();
    const incomingShot: BotWorldSnapshot = {
      ...baseWorld(),
      ball: { position: { x: 1, y: 0.11, z: 7 }, velocity: { x: 3.5, y: 0, z: 18 } },
      possessionTeam: 'home',
      possessionPlayerId: 'h-1',
    };

    const result = stepTeamBotRuntime(incomingShot, 'away', createTeamBotRuntime(), { tier: 'elite', seed: 0x6a7e });
    const keeper = result.intents.find((intent) => intent.playerId === 'a-gk');

    expect(keeper?.action).toBe('dive');
    expect(Math.hypot(keeper!.targetPosition.x - incomingShot.players.find((player) => player.id === 'a-gk')!.position.x,
      keeper!.targetPosition.z - incomingShot.players.find((player) => player.id === 'a-gk')!.position.z)).toBeGreaterThan(2.8);
    expect(keeper?.sprint).toBe(true);
  });
});
