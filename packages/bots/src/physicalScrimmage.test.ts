import { describe, expect, test } from 'vitest';
import {
  createPhysicalScrimmage,
  getPhysicalDifficultySnapshot,
  stepPhysicalScrimmage,
} from './physicalScrimmage';

describe('physical 3v3 bot scrimmage', () => {
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

  test('difficulty changes cognition only and never physical constants', () => {
    expect(getPhysicalDifficultySnapshot('novice')).toEqual(getPhysicalDifficultySnapshot('standard'));
    expect(getPhysicalDifficultySnapshot('standard')).toEqual(getPhysicalDifficultySnapshot('elite'));
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
