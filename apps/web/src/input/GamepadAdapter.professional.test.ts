import { describe, expect, test } from 'vitest';
import { PlayerActionBits } from '@soccershooter/sim/player/PlayerState';
import { decodeFootballActionIntent } from '@soccershooter/sim/football/actionIntent';
import { gamepadSnapshotToFrame } from './GamepadAdapter';

function buttons(...pressed: number[]) {
  return Array.from({ length: 16 }, (_, index) => ({ pressed: pressed.includes(index), value: pressed.includes(index) ? 1 : 0 }));
}

describe('professional gamepad football parity', () => {
  test('right-stick click plus RT requests a chip shot', () => {
    const frame = gamepadSnapshotToFrame(
      { axes: [0, 0, 0, 0], buttons: buttons(7, 11), mapping: 'standard' },
      0,
      1 / 60,
    );
    expect(frame.intent.actionBits & PlayerActionBits.ChipModifier).toBe(PlayerActionBits.ChipModifier);
    expect(decodeFootballActionIntent(frame.intent.actionBits).shotStyle).toBe('chip');
  });

  test('right-stick click plus Y requests a chipped through ball', () => {
    const frame = gamepadSnapshotToFrame(
      { axes: [0, 0, 0, 0], buttons: buttons(3, 11), mapping: 'standard' },
      0,
      1 / 60,
    );
    expect(decodeFootballActionIntent(frame.intent.actionBits).passType).toBe('chipped-through');
  });
});
