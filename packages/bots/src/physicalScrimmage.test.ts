import { describe, expect, test } from 'vitest';
import {
  createPhysicalScrimmage,
  chooseShotTargetX,
  getPhysicalDifficultySnapshot,
  stepPhysicalScrimmage,
} from './physicalScrimmage';

describe('physical 3v3 bot scrimmage', () => {
  test('aims at the open side of goal when the goalkeeper shifts across the line', () => {
    const shooter = { x: 0, y: 0, z: 10 };
    const keeper = (x: number) => [{ goalkeeper: true, position: { x, y: 0, z: 16.5 }, velocity: { x: 0, y: 0, z: 0 } }];

    const keeperRight = chooseShotTargetX(shooter, 18, 3.66, keeper(2.5));
    const keeperLeft = chooseShotTargetX(shooter, 18, 3.66, keeper(-2.5));

    expect(keeperRight).toBeLessThan(-0.5);
    expect(keeperLeft).toBeGreaterThan(0.5);
  });

  test('places a central shot beyond the keeper dive span while keeping post clearance', () => {
    const target = chooseShotTargetX(
      { x: 0, y: 0, z: 14 },
      18,
      3.66,
      [{ goalkeeper: true, position: { x: 0, y: 0, z: 16.5 }, velocity: { x: 0, y: 0, z: 0 } }],
    );

    expect(Math.abs(target)).toBeGreaterThan(3.2);
    expect(Math.abs(target)).toBeLessThan(3.55 - 0.11);
  });

  test('the ball is free state and is never copied onto a carrier every tick', () => {
    let state = createPhysicalScrimmage(0x507a11);
    const initial = { ...state.ball.position };
    for (let index = 0; index < 30; index += 1) state = stepPhysicalScrimmage(state, 1 / 30, 'standard');
    const carrier = state.possessionPlayerId
      ? state.players.find((player) => player.id === state.possessionPlayerId)
      : null;
    if (carrier) {
      const distance = Math.hypot(
        state.ball.position.x - carrier.position.x,
        state.ball.position.z - carrier.position.z,
      );
      expect(distance).toBeGreaterThan(0.08);
    }
    expect(state.ball.position).not.toEqual(initial);
    expect(state.contactCount).toBeGreaterThan(0);
  });

  test('physical play naturally produces loose-ball windows and contact-driven possession changes', () => {
    let state = createPhysicalScrimmage(0x507a12);
    let sawLoose = state.possessionPlayerId === null;
    let sawPossessionChange = false;
    let previous = state.possessionPlayerId;
    for (let index = 0; index < 900; index += 1) {
      state = stepPhysicalScrimmage(state, 1 / 30, 'elite');
      sawLoose ||= state.possessionPlayerId === null;
      if (state.possessionPlayerId !== previous) sawPossessionChange = true;
      previous = state.possessionPlayerId;
    }
    expect(sawLoose).toBe(true);
    expect(sawPossessionChange).toBe(true);
    expect(state.looseBallTicks).toBeGreaterThan(0);
  });

  test('loose-ball possession requires the ball to be in the player front semicircle', () => {
    const behind = createPhysicalScrimmage(0x507a15);
    const backwardPlayer = behind.players.find((player) => player.id === 'h-1')!;
    backwardPlayer.position = { x: 0, y: 0, z: 1.35 };
    backwardPlayer.velocity = { x: 0, y: 0, z: 0 };
    behind.ball.position = { x: 0, y: 0.11, z: 0 };
    behind.ball.velocity = { x: 0, y: 0, z: 0 };
    behind.possessionTeam = null;
    behind.possessionPlayerId = null;

    const stillFacingAway = stepPhysicalScrimmage(behind, 1 / 60, 'elite', {}, {
      playerId: 'h-1', moveX: 0, moveY: 0, aimYaw: 0, sprint: false, action: 'carry',
    });
    expect(stillFacingAway.possessionPlayerId).not.toBe('h-1');

    const inFront = createPhysicalScrimmage(0x507a16);
    const forwardPlayer = inFront.players.find((player) => player.id === 'h-1')!;
    forwardPlayer.position = { x: 0, y: 0, z: -1.35 };
    forwardPlayer.velocity = { x: 0, y: 0, z: 0 };
    inFront.ball.position = { x: 0, y: 0.11, z: 0 };
    inFront.ball.velocity = { x: 0, y: 0, z: 0 };
    inFront.possessionTeam = null;
    inFront.possessionPlayerId = null;
    const facingBall = stepPhysicalScrimmage(inFront, 1 / 60, 'elite', {}, {
      playerId: 'h-1', moveX: 0, moveY: 0, aimYaw: 0, sprint: false, action: 'carry',
    });
    expect(facingBall.possessionPlayerId).toBe('h-1');
  });

  test('both sides progress into attacking range and bot carriers take shots', () => {
    let state = createPhysicalScrimmage(0x507a11);
    let deepestCarrierProgress = Number.NEGATIVE_INFINITY;
    let shots = 0;
    for (let index = 0; index < 1800; index += 1) {
      state = stepPhysicalScrimmage(state, 1 / 30, 'elite');
      if (state.possessionPlayerId) {
        const carrier = state.players.find((player) => player.id === state.possessionPlayerId)!;
        const progress = carrier.team === 'home' ? carrier.position.z : -carrier.position.z;
        deepestCarrierProgress = Math.max(deepestCarrierProgress, progress);
      }
      shots += state.recentContacts.filter((contact) => contact.tick === state.tick && contact.kind === 'shot').length;
    }
    expect(deepestCarrierProgress).toBeGreaterThan(5);
    expect(shots).toBeGreaterThan(0);
  });

  test('elite scrimmage sustains control long enough to build attacks and shoot repeatedly', () => {
    let state = createPhysicalScrimmage(0x507a11);
    let shots = 0;
    for (let index = 0; index < 3600; index += 1) {
      state = stepPhysicalScrimmage(state, 1 / 30, 'elite');
      shots += state.recentContacts.filter((contact) => contact.tick === state.tick && contact.kind === 'shot').length;
    }

    expect(state.looseBallTicks / 3600).toBeLessThan(0.6);
    expect(shots).toBeGreaterThanOrEqual(2);
  });

  test('a shot crossing the goal plane scores and restarts play instead of flying away forever', () => {
    const state = createPhysicalScrimmage(0x507a12);
    state.ball.position = { x: 0, y: 0.11, z: 17.8 };
    state.ball.velocity = { x: 0, y: 0, z: 24 };
    state.possessionPlayerId = null;
    state.possessionTeam = null;

    const next = stepPhysicalScrimmage(state, 1 / 30, 'elite');

    expect(next.score.home).toBe(1);
    expect(next.ball.position.z).toBeCloseTo(0, 1);
    expect(next.ball.velocity.z).toBeCloseTo(0, 3);
    expect(next.possessionTeam).toBe('away');
    expect(next.lastEvent).toBe('goal:home');
    const fieldPlayers = next.players.filter((player) => !player.goalkeeper);
    expect(new Set(fieldPlayers.map((player) => `${player.position.x},${player.position.z}`)).size).toBe(4);
    expect(Math.hypot(
      next.players.find((player) => player.id === 'a-1')!.position.x - next.players.find((player) => player.id === 'a-2')!.position.x,
      next.players.find((player) => player.id === 'a-1')!.position.z - next.players.find((player) => player.id === 'a-2')!.position.z,
    )).toBeGreaterThan(6.5);
  });

  test('an out-of-play restart places its taker at a playable distance from the restarted ball', () => {
    const state = createPhysicalScrimmage(0x507a1a);
    state.ball.position = { x: 12.3, y: 0.11, z: 0 };
    state.ball.velocity = { x: 0, y: 0, z: 0 };
    state.possessionTeam = null;
    state.possessionPlayerId = null;
    state.recentContacts = [{ tick: 0, playerId: 'h-1', kind: 'pass', diagnostic: 'last-touch' }];

    const restarted = stepPhysicalScrimmage(state, 1 / 60, 'elite');
    const taker = restarted.players.find((player) => player.id === restarted.possessionPlayerId)!;

    expect(restarted.lastEvent).toBe('restart:out-of-play');
    expect(Math.hypot(taker.position.x - restarted.ball.position.x, taker.position.z - restarted.ball.position.z)).toBeLessThan(0.6);
  });

  test('a goalkeeper can physically save an on-target shot before it crosses the line', () => {
    const state = createPhysicalScrimmage(0x507a19);
    state.ball.position = { x: 0, y: 0.11, z: 16.6 };
    state.ball.velocity = { x: 0, y: 0, z: 24 };
    state.possessionPlayerId = null;
    state.possessionTeam = null;
    state.recentContacts = [{ tick: state.tick, playerId: 'h-1', kind: 'shot', diagnostic: 'test-shot' }];

    const next = stepPhysicalScrimmage(state, 1 / 30, 'elite');

    expect(next.score.home).toBe(0);
    expect(next.lastEvent).toMatch(/^save:a-gk/);
    expect(next.possessionTeam).toBe('away');
  });

  test('a goalkeeper reads and reaches a fast shot toward the edge of the goal', () => {
    let state = createPhysicalScrimmage(0x507a21);
    state.ball.position = { x: 2.2, y: 0.11, z: 10 };
    state.ball.velocity = { x: 0, y: 0, z: 24 };
    state.possessionPlayerId = null;
    state.possessionTeam = null;
    state.recentContacts = [{ tick: state.tick, playerId: 'h-1', kind: 'shot', diagnostic: 'edge-shot' }];
    let saved = false;
    for (let tick = 0; tick < 60; tick += 1) {
      state = stepPhysicalScrimmage(state, 1 / 60, 'elite');
      if (state.lastEvent.startsWith('save:a-gk:')) { saved = true; break; }
      if (state.score.home > 0) break;
    }

    expect(saved, `event=${state.lastEvent}`).toBe(true);
  });

  test('a goalkeeper tracks a long-range shot for its full flight instead of forgetting the shot after half a second', () => {
    let state = createPhysicalScrimmage(0x507a20);
    state.ball.position = { x: 0, y: 0.11, z: 0 };
    state.ball.velocity = { x: 0, y: 0, z: 24 };
    state.possessionPlayerId = null;
    state.possessionTeam = null;
    state.recentContacts = [{ tick: state.tick, playerId: 'h-1', kind: 'shot', diagnostic: 'long-range-test-shot' }];
    let saved = false;
    for (let tick = 0; tick < 90; tick += 1) {
      state = stepPhysicalScrimmage(state, 1 / 60, 'elite');
      if (state.lastEvent.startsWith('save:a-gk:')) {
        saved = true;
        break;
      }
      if (state.score.home > 0) break;
    }

    expect(saved).toBe(true);
    expect(state.score.home).toBe(0);
  });

  test('difficulty changes cognition only and never physical constants', () => {
    expect(getPhysicalDifficultySnapshot('novice')).toEqual(getPhysicalDifficultySnapshot('standard'));
    expect(getPhysicalDifficultySnapshot('standard')).toEqual(getPhysicalDifficultySnapshot('elite'));
  });

  test('a supplied human input steers its player instead of the generated bot intent', () => {
    const initial = createPhysicalScrimmage(0x507a14);
    const controlled = initial.players.find((player) => player.id === 'h-1')!;
    const next = stepPhysicalScrimmage(initial, 1 / 30, 'standard', {}, {
      playerId: 'h-1',
      moveX: 1,
      moveY: 0,
      aimYaw: Math.PI / 2,
      sprint: false,
      action: 'carry',
    });
    const moved = next.players.find((player) => player.id === 'h-1')!;

    expect(moved.position.x).toBeGreaterThan(controlled.position.x);
    expect(moved.facingYaw).toBeGreaterThan(controlled.facingYaw);
  });

  test('a human-controlled carrier can take a real shot contact', () => {
    const initial = createPhysicalScrimmage(0x507a15);
    const next = stepPhysicalScrimmage(initial, 1 / 30, 'standard', {}, {
      playerId: 'h-1',
      moveX: 0,
      moveY: 0,
      aimYaw: 0,
      sprint: false,
      action: 'shoot',
    });

    expect(next.contactCount).toBeGreaterThan(initial.contactCount);
    expect(next.recentContacts.some((contact) => contact.playerId === 'h-1' && contact.kind === 'shot')).toBe(true);
  });

  test('a human-controlled carrier can pass to a home teammate', () => {
    const initial = createPhysicalScrimmage(0x507a16);
    const next = stepPhysicalScrimmage(initial, 1 / 30, 'standard', {}, {
      playerId: 'h-1',
      moveX: 0,
      moveY: 0,
      aimYaw: 0,
      sprint: false,
      action: 'pass',
      targetPlayerId: 'h-2',
    });

    expect(next.recentContacts.some((contact) => contact.playerId === 'h-1' && contact.kind === 'pass')).toBe(true);
  });

  test('a human-controlled defender can attempt a legal standing challenge', () => {
    const initial = createPhysicalScrimmage(0x507a17);
    const awayCarrier = initial.players.find((player) => player.id === 'a-1')!;
    awayCarrier.position = { x: initial.ball.position.x, y: 0, z: initial.ball.position.z + 0.55 };
    initial.possessionTeam = 'away';
    initial.possessionPlayerId = 'a-1';
    const next = stepPhysicalScrimmage(initial, 1 / 30, 'standard', {}, {
      playerId: 'h-1',
      moveX: 0,
      moveY: 0,
      aimYaw: 0,
      sprint: false,
      action: 'challenge',
    });

    expect(next.recentContacts.some((contact) => contact.playerId === 'h-1' && contact.kind === 'standing-challenge')).toBe(true);
  });

  test('same seed and steps reproduce the exact physical trace checksum', () => {
    let left = createPhysicalScrimmage(0x507a13);
    let right = createPhysicalScrimmage(0x507a13);
    for (let index = 0; index < 300; index += 1) {
      left = stepPhysicalScrimmage(left, 1 / 30, 'standard');
      right = stepPhysicalScrimmage(right, 1 / 30, 'standard');
    }
    expect(right.checksum).toBe(left.checksum);
    expect(right.ball).toEqual(left.ball);
    expect(right.players).toEqual(left.players);
  });
});
