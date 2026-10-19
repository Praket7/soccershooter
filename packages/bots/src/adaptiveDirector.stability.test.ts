import { describe, expect, test } from 'vitest';
import { applyAdaptiveBoundary, createAdaptiveDirector } from './adaptiveDirector';
import type { PlayerModelSnapshot } from './playerModel';

function metric(value: number) {
  return { value, confidence: 0.95 };
}

function model(score: number): PlayerModelSnapshot {
  return {
    passAccuracy: metric(score),
    shotConversion: metric(score),
    pressuredTurnoverRate: metric(1 - score),
    dribbleSuccess: metric(score),
    defensiveTiming: metric(score),
    reactionProxy: metric(score),
    favoredZones: [],
    techniqueDiversity: metric(score),
  };
}

describe('adaptive difficulty stability', () => {
  test('elite does not immediately fall back when performance hovers near the promotion threshold', () => {
    let state = createAdaptiveDirector('pve', 'standard');
    state = applyAdaptiveBoundary(state, { kind: 'encounter-start', token: 'start', playerModel: model(0.82) });
    expect(state.tier).toBe('elite');

    state = applyAdaptiveBoundary(state, { kind: 'restart', token: 'r1', playerModel: model(0.66) });
    expect(state.tier).toBe('elite');

    state = applyAdaptiveBoundary(state, { kind: 'restart', token: 'r2', playerModel: model(0.58) });
    expect(state.tier).toBe('standard');
  });

  test('standard needs clearer evidence before promoting or demoting', () => {
    let state = createAdaptiveDirector('pve', 'standard');
    state = applyAdaptiveBoundary(state, { kind: 'restart', token: 'r1', playerModel: model(0.69) });
    expect(state.tier).toBe('standard');
    state = applyAdaptiveBoundary(state, { kind: 'restart', token: 'r2', playerModel: model(0.74) });
    expect(state.tier).toBe('elite');
  });

  test('novice assistance is not removed after one borderline improvement', () => {
    let state = createAdaptiveDirector('pve', 'novice');
    state = applyAdaptiveBoundary(state, { kind: 'restart', token: 'r1', playerModel: model(0.45) });
    expect(state.tier).toBe('novice');
    state = applyAdaptiveBoundary(state, { kind: 'restart', token: 'r2', playerModel: model(0.52) });
    expect(state.tier).toBe('standard');
  });
});
