import { describe, expect, test } from 'vitest';
import { assignTeamRoles } from './roles';
import { createTeamBotRuntime, stepTeamBotRuntime } from './runtime';
import { phaseForTeam, type BotWorldSnapshot } from './types';

const inFlightPassWorld: BotWorldSnapshot = {
  tick: 30,
  timeSeconds: 1,
  field: { halfWidth: 12, halfLength: 18, goalHalfWidth: 3.66 },
  ball: { position: { x: 0, y: 0.11, z: 2 }, velocity: { x: 2, y: 0, z: 8 } },
  players: [
    { id: 'h-gk', team: 'home', goalkeeper: true, position: { x: 0, y: 0, z: -16.5 }, velocity: { x: 0, y: 0, z: 0 }, facingYaw: 0 },
    { id: 'h-1', team: 'home', goalkeeper: false, position: { x: -1, y: 0, z: 0 }, velocity: { x: 0, y: 0, z: 0 }, facingYaw: 0 },
    { id: 'h-2', team: 'home', goalkeeper: false, position: { x: 1, y: 0, z: 4 }, velocity: { x: 0, y: 0, z: 0 }, facingYaw: 0 },
    { id: 'a-gk', team: 'away', goalkeeper: true, position: { x: 0, y: 0, z: 16.5 }, velocity: { x: 0, y: 0, z: 0 }, facingYaw: Math.PI },
    { id: 'a-1', team: 'away', goalkeeper: false, position: { x: 2, y: 0, z: 6 }, velocity: { x: 0, y: 0, z: 0 }, facingYaw: Math.PI },
    { id: 'a-2', team: 'away', goalkeeper: false, position: { x: -4, y: 0, z: 2 }, velocity: { x: 0, y: 0, z: 0 }, facingYaw: Math.PI },
  ],
  possessionTeam: null,
  possessionPlayerId: null,
  passReceiverId: 'h-2',
};

describe('Stage 06 pass-flight team shape', () => {
  test('cover defender holds a laterally separated goal-side lane instead of joining the press', () => {
    const world = {
      ...inFlightPassWorld,
      ball: { position: { x: 0, y: 0.11, z: 0 }, velocity: { x: 0, y: 0, z: 0 } },
      possessionTeam: 'away' as const,
      possessionPlayerId: 'a-1',
      passReceiverId: null,
    };
    const roles = assignTeamRoles(world, 'home');
    const presser = roles.assignments.find((entry) => entry.role === 'presser')!;
    const cover = roles.assignments.find((entry) => entry.role === 'cover-defender')!;

    expect(Math.abs(cover.targetPosition.x - presser.targetPosition.x)).toBeGreaterThan(2.5);
    expect(cover.targetPosition.z).toBeLessThan(presser.targetPosition.z);
  });

  test('keeps the receiving team in attack while the ball is physically in flight', () => {
    expect(phaseForTeam(inFlightPassWorld, 'home')).toBe('attack');
    expect(phaseForTeam(inFlightPassWorld, 'away')).toBe('defend');

    const home = assignTeamRoles(inFlightPassWorld, 'home');
    expect(home.assignments.find((entry) => entry.playerId === 'h-2')?.role).toBe('receiver');
    expect(home.assignments.find((entry) => entry.playerId === 'h-1')?.role).toBe('immediate-support');

    const receiving = stepTeamBotRuntime(inFlightPassWorld, 'home', createTeamBotRuntime(), { tier: 'standard' });
    const receiverIntent = receiving.intents.find((intent) => intent.playerId === 'h-2');
    expect(receiverIntent?.role).toBe('receiver');
    expect(receiverIntent?.action).toBe('receive');
    expect(Math.abs(receiverIntent!.targetPosition.x - 0.9)).toBeLessThan(0.3);
    expect(Math.abs(receiverIntent!.targetPosition.z - 5.6)).toBeLessThan(0.3);

    const nextPass = { ...inFlightPassWorld, timeSeconds: 1.05, passReceiverId: 'h-1' };
    const reassigned = assignTeamRoles(nextPass, 'home', home);
    expect(reassigned.assignments.find((entry) => entry.playerId === 'h-1')?.role).toBe('receiver');
    expect(reassigned.assignments.find((entry) => entry.playerId === 'h-2')?.role).toBe('immediate-support');
  });
});
