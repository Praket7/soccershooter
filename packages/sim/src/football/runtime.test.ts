import { describe, expect, test } from 'vitest';
import { PlayerActionBits } from '../player/PlayerState';
import {
  consumeReceiveIntent,
  createFootballRuntimeState,
  markControlTouch,
  markKick,
  stepFootballRuntime,
} from './runtime';

describe('Stage 05 football runtime cadence', () => {
  test('shot charge accumulates while held and emits one bounded release charge', () => {
    let state = createFootballRuntimeState();
    for (let index = 0; index < 30; index += 1) {
      const result = stepFootballRuntime(state, PlayerActionBits.ShootHeld, 1 / 60);
      state = result.state;
      expect(result.releasedShotCharge).toBeNull();
    }
    const release = stepFootballRuntime(state, PlayerActionBits.ShootReleased, 1 / 60);
    expect(release.releasedShotCharge).not.toBeNull();
    expect(release.releasedShotCharge!).toBeGreaterThan(0.45);
    expect(release.releasedShotCharge!).toBeLessThan(0.75);
    expect(release.state.shotChargeSeconds).toBe(0);
  });

  test('a very short focus click never becomes a minimum-power accidental shot', () => {
    let state = createFootballRuntimeState();
    for (let index = 0; index < 2; index += 1) {
      state = stepFootballRuntime(state, PlayerActionBits.ShootHeld, 1 / 60).state;
    }
    expect(state.shotChargeSeconds).toBeLessThan(0.05);
    const release = stepFootballRuntime(state, PlayerActionBits.ShootReleased, 1 / 60);
    expect(release.releasedShotCharge).toBeNull();
    expect(release.state.shotChargeSeconds).toBe(0);
  });

  test('explicit receive request is buffered and can be consumed after legal contact', () => {
    let state = createFootballRuntimeState();
    state = stepFootballRuntime(state, PlayerActionBits.Receive, 1 / 60).state;
    expect(state.receive.armedSeconds).toBeGreaterThan(0.2);
    state = stepFootballRuntime(state, 0, 0.1).state;
    expect(state.receive.armedSeconds).toBeGreaterThan(0);
    state = consumeReceiveIntent(state);
    expect(state.receive.armedSeconds).toBe(0);
    expect(state.receive.lastOutcome).toBe('consumed');
  });

  test('losing the held-shot state without a release cancels stale charge instead of banking it', () => {
    let state = createFootballRuntimeState();
    for (let index = 0; index < 24; index += 1) {
      state = stepFootballRuntime(state, PlayerActionBits.ShootHeld, 1 / 60).state;
    }
    expect(state.shotChargeSeconds).toBeGreaterThan(0.35);
    expect(state.shotWasHeld).toBe(true);

    const cancelled = stepFootballRuntime(state, 0, 1 / 60);
    expect(cancelled.releasedShotCharge).toBeNull();
    expect(cancelled.state.shotChargeSeconds).toBe(0);
    expect(cancelled.state.shotWasHeld).toBe(false);
  });

  test('touch and kick cooldowns prevent 60 Hz magnetic re-contact spam', () => {
    let state = markControlTouch(createFootballRuntimeState(), false);
    expect(state.controlTouchCooldown).toBeGreaterThan(0.1);
    let result = stepFootballRuntime(state, 0, 0.05);
    expect(result.state.controlTouchCooldown).toBeGreaterThan(0);
    result = stepFootballRuntime(result.state, 0, 0.2);
    expect(result.state.controlTouchCooldown).toBe(0);

    state = markKick(result.state);
    expect(state.kickCooldown).toBeGreaterThan(0.1);
  });

  test('sharp-turn effort contact gets the next legal touch sooner than normal or sprint carry', () => {
    const effort = markControlTouch(createFootballRuntimeState(), false, 'effort-turn');
    const normal = markControlTouch(createFootballRuntimeState(), false, 'normal');
    const sprint = markControlTouch(createFootballRuntimeState(), true, 'sprint');
    expect(effort.controlTouchCooldown).toBeLessThan(normal.controlTouchCooldown);
    expect(normal.controlTouchCooldown).toBeLessThan(sprint.controlTouchCooldown);
    expect(effort.controlTouchCooldown).toBeLessThanOrEqual(0.09);
  });

  test('dribble cadence matches the owner-calibrated recovery envelope', () => {
    const sprint = markControlTouch(createFootballRuntimeState(), true);
    const controlled = markControlTouch(createFootballRuntimeState(), false);
    expect(sprint.controlTouchCooldown).toBeCloseTo(0.14, 8);
    expect(controlled.controlTouchCooldown).toBeCloseTo(0.12, 8);
    expect(sprint.controlTouchCooldown).toBeGreaterThan(controlled.controlTouchCooldown);
  });

  test('runtime stepping is exactly repeatable for the same bit trace', () => {
    const trace = [
      PlayerActionBits.ShootHeld,
      PlayerActionBits.ShootHeld | PlayerActionBits.Precision,
      PlayerActionBits.ShootHeld,
      PlayerActionBits.ShootReleased,
      PlayerActionBits.Pass,
      0,
    ];
    const run = () => {
      let state = createFootballRuntimeState();
      const releases: Array<number | null> = [];
      for (const bits of trace) {
        const result = stepFootballRuntime(state, bits, 1 / 60);
        state = result.state;
        releases.push(result.releasedShotCharge);
      }
      return JSON.stringify({ state, releases });
    };
    expect(run()).toBe(run());
  });
});
