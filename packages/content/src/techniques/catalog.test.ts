import { describe, expect, it } from 'vitest';
import { TECHNIQUES, TECHNIQUE_BY_ID } from './catalog';

describe('fictional football technique catalog', () => {
  it('contains the full dribble, pass/shot, and aerial starter families within physics bounds', () => {
    expect(TECHNIQUES.length).toBeGreaterThanOrEqual(12);
    expect(new Set(TECHNIQUES.map((item) => item.id)).size).toBe(TECHNIQUES.length);
    expect(new Set(TECHNIQUES.map((item) => item.family))).toEqual(new Set(['dribble', 'pass-shot', 'aerial']));
    expect(TECHNIQUES.every((item) => item.contact.maxImpulse <= 18
      && item.eligibility.maximumBallDistance <= (item.id === 'stepover' ? 1.22 : item.id === 'elastico' ? 1.12 : 0.76))).toBe(true);
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

  it('gives football-distinct named techniques materially different contact profiles', () => {
    const rainbow = TECHNIQUE_BY_ID.get('rainbow')!;
    const bodyFeint = TECHNIQUE_BY_ID.get('body-feint')!;
    const lofted = TECHNIQUE_BY_ID.get('lofted-through')!;
    const power = TECHNIQUE_BY_ID.get('power-strike')!;
    const finesse = TECHNIQUE_BY_ID.get('finesse-curl')!;
    const knuckle = TECHNIQUE_BY_ID.get('knuckle-strike')!;
    const rainbowContact = rainbow.contact as unknown as Record<string, unknown>;
    const loftedContact = lofted.contact as unknown as Record<string, unknown>;
    const finesseContact = finesse.contact as unknown as Record<string, unknown>;
    const knuckleContact = knuckle.contact as unknown as Record<string, unknown>;
    expect(Number(rainbowContact.launchElevationDegrees)).toBeGreaterThan(25);
    expect(rainbow.contact.impulseScale).toBeGreaterThan(bodyFeint.contact.impulseScale);
    expect(Number(loftedContact.launchElevationDegrees)).toBeGreaterThan(18);
    expect(power.contact.impulseScale).toBeGreaterThan(finesse.contact.impulseScale);
    expect(finesseContact.spinAxis).toBe('side');
    expect(knuckleContact.spinAxis).toBe('none');
    expect(knuckle.contact.spinScale).toBeLessThan(finesse.contact.spinScale * 0.2);
  });
});
