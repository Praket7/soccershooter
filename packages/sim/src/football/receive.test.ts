import { describe, expect, test } from 'vitest';
import { createReceiveState, requestReceive, stepReceiveState, consumeReceive, resolveReceiveMode } from './receive';

describe('explicit receive intent', () => {
  test('early receive input arms a short deterministic buffer and expires', () => {
    let state = requestReceive(createReceiveState());
    expect(state.armedSeconds).toBeGreaterThan(0.2);
    expect(state.armedSeconds).toBeLessThanOrEqual(0.4);

    state = stepReceiveState(state, 0.1);
    expect(state.armedSeconds).toBeGreaterThan(0.1);
    state = stepReceiveState(state, 1);
    expect(state.armedSeconds).toBe(0);
  });

  test('movement selects controlled exit while no movement selects kill', () => {
    expect(resolveReceiveMode(0)).toBe('kill');
    expect(resolveReceiveMode(0.08)).toBe('kill');
    expect(resolveReceiveMode(0.4)).toBe('controlled-exit');
  });

  test('successful receive consumes the request rather than silently rearming', () => {
    const consumed = consumeReceive(requestReceive(createReceiveState()));
    expect(consumed.armedSeconds).toBe(0);
    expect(consumed.lastOutcome).toBe('consumed');
  });
});
