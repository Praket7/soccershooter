import { describe, expect, it } from 'vitest';
import { TECHNIQUES } from './catalog';

describe('fictional football technique catalog', () => {
  it('contains the full dribble, pass/shot, and aerial starter families within physics bounds', () => {
    expect(TECHNIQUES.length).toBeGreaterThanOrEqual(12);
    expect(new Set(TECHNIQUES.map((item) => item.id)).size).toBe(TECHNIQUES.length);
    expect(new Set(TECHNIQUES.map((item) => item.family))).toEqual(new Set(['dribble', 'pass-shot', 'aerial']));
    expect(TECHNIQUES.every((item) => item.contact.maxImpulse <= 18 && item.eligibility.maximumBallDistance <= 0.76)).toBe(true);
  });

  it('provides four evolution chains that change execution mechanics', () => {
    const chains = new Map<string, Set<string>>();
    for (const item of TECHNIQUES) {
      if (!item.evolution) continue;
      const mechanics = chains.get(item.evolution.chain) ?? new Set<string>();
      mechanics.add(item.mechanic);
      chains.set(item.evolution.chain, mechanics);
    }
    expect(chains.size).toBeGreaterThanOrEqual(4);
    expect([...chains.values()].filter((mechanics) => mechanics.size > 1).length).toBeGreaterThanOrEqual(4);
  });
});
