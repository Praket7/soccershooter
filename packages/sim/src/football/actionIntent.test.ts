import { describe, expect, test } from 'vitest';
import { PlayerActionBits } from '../player/PlayerState';
import { decodeFootballActionIntent } from './actionIntent';

describe('explicit football action decoding', () => {
  test('dedicated pass inputs decode without RMB or technique ambiguity', () => {
    expect(decodeFootballActionIntent(PlayerActionBits.Pass).passType).toBe('ground');
    expect(decodeFootballActionIntent(PlayerActionBits.ThroughPass).passType).toBe('through');
    expect(decodeFootballActionIntent(PlayerActionBits.LoftedPass).passType).toBe('lofted');
    expect(decodeFootballActionIntent(PlayerActionBits.Pass | PlayerActionBits.DrivenModifier).passType).toBe('driven');
    expect(decodeFootballActionIntent(PlayerActionBits.ThroughPass | PlayerActionBits.DrivenModifier).passType).toBe('chipped-through');
  });

  test('shot modifiers are simple and deterministic', () => {
    expect(decodeFootballActionIntent(PlayerActionBits.ShootHeld).shotStyle).toBe('normal');
    expect(decodeFootballActionIntent(PlayerActionBits.ShootHeld | PlayerActionBits.DrivenModifier).shotStyle).toBe('finesse');
    expect(decodeFootballActionIntent(PlayerActionBits.ShootHeld | PlayerActionBits.ChipModifier).shotStyle).toBe('chip');
  });

  test('receive is an explicit intent independent of precision dribble', () => {
    expect(decodeFootballActionIntent(PlayerActionBits.Receive).receiveRequested).toBe(true);
    expect(decodeFootballActionIntent(PlayerActionBits.Precision).receiveRequested).toBe(false);
  });
});
