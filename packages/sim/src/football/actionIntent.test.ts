import { describe, expect, test } from 'vitest';
import { PlayerActionBits } from '../player/PlayerState';
import { decodeFootballActionIntent } from './actionIntent';

describe('explicit football action decoding', () => {
  test('dedicated pass inputs keep their base meaning and ergonomic modifiers select variants', () => {
    expect(decodeFootballActionIntent(PlayerActionBits.Pass).passType).toBe('ground');
    expect(decodeFootballActionIntent(PlayerActionBits.ThroughPass).passType).toBe('through');
    expect(decodeFootballActionIntent(PlayerActionBits.LoftedPass).passType).toBe('lofted');
    expect(decodeFootballActionIntent(PlayerActionBits.Pass | PlayerActionBits.Precision).passType).toBe('driven');
    expect(decodeFootballActionIntent(PlayerActionBits.ThroughPass | PlayerActionBits.ChipModifier).passType).toBe('chipped-through');
    expect(decodeFootballActionIntent(PlayerActionBits.ThroughPass | PlayerActionBits.Precision).passType).toBe('through');
  });

  test('RMB means finesse and Ctrl means chip for the same held shot action', () => {
    expect(decodeFootballActionIntent(PlayerActionBits.ShootHeld).shotStyle).toBe('normal');
    expect(decodeFootballActionIntent(PlayerActionBits.ShootHeld | PlayerActionBits.Precision).shotStyle).toBe('finesse');
    expect(decodeFootballActionIntent(PlayerActionBits.ShootHeld | PlayerActionBits.ChipModifier).shotStyle).toBe('chip');
    expect(decodeFootballActionIntent(
      PlayerActionBits.ShootHeld | PlayerActionBits.Precision | PlayerActionBits.ChipModifier,
    ).shotStyle).toBe('chip');
  });

  test('receive is an explicit intent independent of precision dribble', () => {
    expect(decodeFootballActionIntent(PlayerActionBits.Receive).receiveRequested).toBe(true);
    expect(decodeFootballActionIntent(PlayerActionBits.Precision).receiveRequested).toBe(false);
  });
});
