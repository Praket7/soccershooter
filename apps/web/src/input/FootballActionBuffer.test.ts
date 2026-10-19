import { describe, expect, test } from 'vitest';
import { PlayerActionBits } from '@soccershooter/sim/player/PlayerState';
import { decodeFootballActionIntent } from '@soccershooter/sim/football/actionIntent';
import { bufferFootballActionBits, consumeFootballActionBits } from './FootballActionBuffer';

describe('render-to-fixed-step football action buffering', () => {
  test('Ctrl+Q remains chipped-through when the render frame has no simulation step', () => {
    const chord = PlayerActionBits.ThroughPass | PlayerActionBits.ChipModifier;
    const buffered = bufferFootballActionBits(0, chord);

    expect(decodeFootballActionIntent(buffered).passType).toBe('chipped-through');
  });

  test('RMB+E remains driven when RMB is released before the next fixed step', () => {
    const chord = PlayerActionBits.Pass | PlayerActionBits.Precision;
    const buffered = bufferFootballActionBits(0, chord);

    expect(decodeFootballActionIntent(buffered).passType).toBe('driven');
  });

  test('consuming a pass edge also consumes its snapshotted technique modifier', () => {
    const chord = PlayerActionBits.ThroughPass | PlayerActionBits.ChipModifier;
    const buffered = bufferFootballActionBits(0, chord);
    const remaining = consumeFootballActionBits(buffered, chord);

    expect(remaining & PlayerActionBits.ThroughPass).toBe(0);
    expect(remaining & PlayerActionBits.ChipModifier).toBe(0);
  });
});
