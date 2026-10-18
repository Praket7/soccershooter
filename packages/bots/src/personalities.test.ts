import { describe, expect, it } from 'vitest';
import {
  BOT_PERSONALITY_IDS,
  botPersonalityProfile,
  personalityWeight,
} from './personalities';

describe('Stage 07 data-driven bot personalities', () => {
  it('defines the seven planned personalities through one data schema', () => {
    expect(BOT_PERSONALITY_IDS).toEqual([
      'balanced',
      'playmaker',
      'winger',
      'poacher',
      'anchor',
      'aggressive-presser',
      'calm-keeper',
    ]);
    for (const id of BOT_PERSONALITY_IDS) {
      const profile = botPersonalityProfile(id);
      expect(profile.id).toBe(id);
      expect(Object.keys(profile).sort()).toEqual(['carrier', 'defense', 'goalkeeper', 'id', 'offBall']);
      expect(JSON.stringify(profile)).not.toMatch(/speed|stamina|collider|physics|reach/i);
    }
  });

  it('keeps utility multipliers bounded so personality changes preference rather than rules', () => {
    for (const id of BOT_PERSONALITY_IDS) {
      const profile = botPersonalityProfile(id);
      const values = [
        ...Object.values(profile.carrier),
        ...Object.values(profile.offBall),
        ...Object.values(profile.defense),
        ...Object.values(profile.goalkeeper),
      ];
      expect(values.every((value) => value >= 0.65 && value <= 1.4)).toBe(true);
    }
  });

  it('makes archetypes tactically distinct in the intended direction', () => {
    expect(personalityWeight('playmaker', 'carrier', 'pass')).toBeGreaterThan(personalityWeight('playmaker', 'carrier', 'shoot'));
    expect(personalityWeight('winger', 'offBall', 'width')).toBeGreaterThan(personalityWeight('winger', 'offBall', 'recycle'));
    expect(personalityWeight('poacher', 'carrier', 'shoot')).toBeGreaterThan(personalityWeight('poacher', 'carrier', 'protect'));
    expect(personalityWeight('anchor', 'defense', 'cover')).toBeGreaterThan(personalityWeight('anchor', 'defense', 'press'));
    expect(personalityWeight('aggressive-presser', 'defense', 'press')).toBeGreaterThan(personalityWeight('aggressive-presser', 'defense', 'cover'));
    expect(personalityWeight('calm-keeper', 'goalkeeper', 'position')).toBeGreaterThan(personalityWeight('calm-keeper', 'goalkeeper', 'dive'));
  });

  it('uses balanced as a neutral utility profile', () => {
    const balanced = botPersonalityProfile('balanced');
    const values = [
      ...Object.values(balanced.carrier),
      ...Object.values(balanced.offBall),
      ...Object.values(balanced.defense),
      ...Object.values(balanced.goalkeeper),
    ];
    expect(values.every((value) => value === 1)).toBe(true);
  });
});
