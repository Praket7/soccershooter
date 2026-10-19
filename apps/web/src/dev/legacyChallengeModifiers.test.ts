import { describe, expect, it } from 'vitest';
import { resolveLiveLegacyModifiers } from './legacyChallengeModifiers';

describe('live Legacy modifiers', () => {
  it('maps the seeded modifier and intensity to bounded gameplay parameters', () => {
    const highPress = resolveLiveLegacyModifiers({ seed: 1, level: 2, modifier: 'high-press', modifierIntensity: 1.08, perfectClearObjective: 'win-without-conceding' });
    expect(highPress.pressure).toBeCloseTo(0.324);
    expect(highPress.pitchScale).toBe(1);

    const smallPitch = resolveLiveLegacyModifiers({ seed: 1, level: 2, modifier: 'small-pitch', modifierIntensity: 1.08, perfectClearObjective: 'win-without-conceding' });
    expect(smallPitch.pitchScale).toBeCloseTo(0.9352);

    const quickRecovery = resolveLiveLegacyModifiers({ seed: 1, level: 2, modifier: 'quick-recovery', modifierIntensity: 1.08, perfectClearObjective: 'win-without-conceding' });
    expect(quickRecovery.recoveryRate).toBeCloseTo(1.324);

    const aerialPressure = resolveLiveLegacyModifiers({ seed: 1, level: 2, modifier: 'aerial-pressure', modifierIntensity: 1.08, perfectClearObjective: 'win-with-no-conceded-header' });
    expect(aerialPressure.keeperMaxHeight).toBeCloseTo(2.3096);
  });

  it('returns neutral gameplay parameters outside a Legacy challenge', () => {
    expect(resolveLiveLegacyModifiers(null)).toEqual({
      pressure: 0,
      pitchScale: 1,
      recoveryRate: 1,
      keeperMaxHeight: 2.18,
    });
  });
});
