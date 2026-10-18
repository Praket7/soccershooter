import { describe, expect, it } from 'vitest';
import {
  createPlayerModel,
  playerModelSnapshot,
  recordPlayerObservation,
  type PlayerObservation,
} from './playerModel';

function sample(overrides: Partial<PlayerObservation> = {}): PlayerObservation {
  return {
    timeSeconds: 0,
    pass: { completed: true },
    shot: { scored: false },
    pressuredTurnover: false,
    dribble: { succeeded: true },
    defensiveTiming: 0.8,
    reactionSeconds: 0.18,
    zone: 'attacking-center',
    technique: 'finesse',
    ...overrides,
  };
}

describe('Stage 07 rolling gameplay-only player model', () => {
  it('starts unconfident and exposes only the planned gameplay estimates', () => {
    const snapshot = playerModelSnapshot(createPlayerModel());
    expect(snapshot.passAccuracy.confidence).toBe(0);
    expect(snapshot.shotConversion.confidence).toBe(0);
    expect(snapshot.pressuredTurnoverRate.confidence).toBe(0);
    expect(snapshot.dribbleSuccess.confidence).toBe(0);
    expect(snapshot.defensiveTiming.confidence).toBe(0);
    expect(snapshot.reactionProxy.confidence).toBe(0);
    expect(snapshot.favoredZones).toEqual([]);
    expect(snapshot.techniqueDiversity).toEqual({ value: 0, confidence: 0 });
    expect(Object.keys(snapshot).sort()).toEqual([
      'defensiveTiming',
      'dribbleSuccess',
      'favoredZones',
      'passAccuracy',
      'pressuredTurnoverRate',
      'reactionProxy',
      'shotConversion',
      'techniqueDiversity',
    ]);
  });

  it('learns rolling gameplay estimates and confidence without storing identity-sensitive data', () => {
    let model = createPlayerModel();
    for (let index = 0; index < 12; index += 1) {
      model = recordPlayerObservation(model, sample({
        timeSeconds: index * 4,
        shot: { scored: index % 3 === 0 },
        pressuredTurnover: index % 4 === 0,
        zone: index < 8 ? 'attacking-center' : 'middle-right',
        technique: index % 2 === 0 ? 'finesse' : 'driven',
      }));
    }
    const snapshot = playerModelSnapshot(model);
    expect(snapshot.passAccuracy.value).toBeGreaterThan(0.95);
    expect(snapshot.shotConversion.value).toBeGreaterThan(0.2);
    expect(snapshot.shotConversion.value).toBeLessThan(0.5);
    expect(snapshot.pressuredTurnoverRate.value).toBeGreaterThan(0.15);
    expect(snapshot.dribbleSuccess.value).toBeGreaterThan(0.95);
    expect(snapshot.defensiveTiming.value).toBeCloseTo(0.8, 5);
    expect(snapshot.reactionProxy.value).toBeGreaterThan(0.6);
    expect(snapshot.passAccuracy.confidence).toBeGreaterThan(0.6);
    expect(snapshot.favoredZones[0]?.zone).toBe('attacking-center');
    expect(snapshot.techniqueDiversity.value).toBeGreaterThan(0.45);
    expect(JSON.stringify(model)).not.toMatch(/email|userId|accountId|deviceId|biometric|name|ipAddress/i);
  });

  it('decays stale evidence so old performance gradually loses confidence', () => {
    let model = createPlayerModel();
    for (let index = 0; index < 10; index += 1) {
      model = recordPlayerObservation(model, sample({ timeSeconds: index }));
    }
    const before = playerModelSnapshot(model).passAccuracy.confidence;
    model = recordPlayerObservation(model, { timeSeconds: 600, zone: 'middle-center' });
    const after = playerModelSnapshot(model).passAccuracy.confidence;
    expect(before).toBeGreaterThan(0.6);
    expect(after).toBeLessThan(before * 0.4);
  });

  it('is deterministic for the same ordered observation stream', () => {
    const observations = Array.from({ length: 20 }, (_, index) => sample({
      timeSeconds: index * 2.5,
      pass: { completed: index % 5 !== 0 },
      shot: { scored: index % 6 === 0 },
      pressuredTurnover: index % 7 === 0,
      dribble: { succeeded: index % 4 !== 0 },
      defensiveTiming: (index % 10) / 10,
      reactionSeconds: 0.12 + (index % 4) * 0.03,
      zone: index % 2 === 0 ? 'attacking-left' : 'middle-center',
      technique: index % 3 === 0 ? 'chip' : 'normal',
    }));
    const run = () => observations.reduce(recordPlayerObservation, createPlayerModel());
    expect(run()).toEqual(run());
    expect(playerModelSnapshot(run())).toEqual(playerModelSnapshot(run()));
  });
});
