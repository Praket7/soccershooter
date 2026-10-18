import { describe, expect, it } from 'vitest';
import {
  applyAdaptiveBoundary,
  createAdaptiveDirector,
  type AdaptiveBoundaryContext,
} from './adaptiveDirector';
import type { PlayerModelSnapshot } from './playerModel';

function metric(value: number, confidence = 0.9) {
  return { value, confidence };
}

function model(skill: 'low' | 'medium' | 'high', confidence = 0.9): PlayerModelSnapshot {
  const value = skill === 'low' ? 0.24 : skill === 'medium' ? 0.52 : 0.86;
  return {
    passAccuracy: metric(value, confidence),
    shotConversion: metric(value, confidence),
    pressuredTurnoverRate: metric(1 - value, confidence),
    dribbleSuccess: metric(value, confidence),
    defensiveTiming: metric(value, confidence),
    reactionProxy: metric(value, confidence),
    favoredZones: [],
    techniqueDiversity: metric(value, confidence),
  };
}

function boundary(kind: AdaptiveBoundaryContext['kind'], token: string, snapshot: PlayerModelSnapshot): AdaptiveBoundaryContext {
  return { kind, token, playerModel: snapshot };
}

describe('Stage 07 legal-boundary PvE adaptation', () => {
  it('never changes tier during a live possession', () => {
    const state = createAdaptiveDirector('pve', 'standard');
    const next = applyAdaptiveBoundary(state, boundary('live-possession', 'p1', model('high')));
    expect(next).toEqual(state);
  });

  it('can move one tier at an encounter start or restart when evidence is confident', () => {
    const initial = createAdaptiveDirector('pve', 'standard');
    const novice = applyAdaptiveBoundary(initial, boundary('encounter-start', 'encounter-1', model('low')));
    expect(novice.tier).toBe('novice');
    expect(novice.changeCount).toBe(1);
    const standard = applyAdaptiveBoundary(novice, boundary('restart', 'restart-1', model('high')));
    expect(standard.tier).toBe('standard');
    const elite = applyAdaptiveBoundary(standard, boundary('restart', 'restart-2', model('high')));
    expect(elite.tier).toBe('elite');
  });

  it('does not reapply adaptation twice for the same boundary token', () => {
    const state = createAdaptiveDirector('pve', 'standard');
    const first = applyAdaptiveBoundary(state, boundary('restart', 'r-1', model('high')));
    const duplicate = applyAdaptiveBoundary(first, boundary('restart', 'r-1', model('low')));
    expect(duplicate).toEqual(first);
  });

  it('ignores low-confidence player models instead of guessing skill', () => {
    const state = createAdaptiveDirector('pve', 'standard');
    const next = applyAdaptiveBoundary(state, boundary('restart', 'r-low-confidence', model('high', 0.15)));
    expect(next.tier).toBe('standard');
    expect(next.changeCount).toBe(0);
  });

  it('locks adaptive difficulty off in PvP regardless of player performance', () => {
    let state = createAdaptiveDirector('pvp', 'standard');
    state = applyAdaptiveBoundary(state, boundary('encounter-start', 'pvp-start', model('low')));
    state = applyAdaptiveBoundary(state, boundary('restart', 'pvp-r1', model('high')));
    expect(state.tier).toBe('standard');
    expect(state.changeCount).toBe(0);
    expect(state.adaptationEnabled).toBe(false);
  });
});
