import { describe, expect, test } from 'vitest';
import { runFootballFuzz } from './football-fuzz';

describe('football and contact-plan fuzz gate', () => {
  test('same seed produces byte-stable legal, impossible, and duplicate-contact traces', () => {
    const options = { cases: 128, seed: 5904133 };
    const first = runFootballFuzz(options);
    const second = runFootballFuzz(options);
    expect(first).toEqual(second);
    expect(first.contactPlanStates).toBe(512);
    expect(first.failures).toBe(0);
  });
});
