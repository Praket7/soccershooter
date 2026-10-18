import { describe, expect, test } from 'vitest';
import type { InputIntent } from '@soccershooter/sim';
import type { GamepadFrame } from './GamepadAdapter';
import { mergeInputSources } from './InputMerge';

const keyboardIntent: InputIntent = {
  moveX: 0,
  moveY: 1,
  aimYaw: 0.4,
  sprint: true,
  actionBits: 1,
};

describe('Stage 03 mixed-device input integration', () => {
  test('gamepad camera look does not erase active keyboard movement or sprint', () => {
    const gamepad: GamepadFrame = {
      active: true,
      intent: { moveX: 0, moveY: 0, aimYaw: 0.7, sprint: false, actionBits: 0 },
      look: { yawDelta: 0.3, pitchDelta: 0.1 },
    };
    const merged = mergeInputSources(
      { intent: keyboardIntent, look: { yawDelta: 0.05, pitchDelta: 0 }, inputTimestamp: 10, zoomDelta: 0 },
      gamepad,
      0,
    );
    expect(merged.intent.moveX).toBe(0);
    expect(merged.intent.moveY).toBe(1);
    expect(merged.intent.sprint).toBe(true);
    expect(merged.intent.aimYaw).toBeCloseTo(0.7, 10);
    expect(merged.look.yawDelta).toBeCloseTo(0.35, 10);
  });

  test('active gamepad movement can take movement authority while preserving action bits from both devices', () => {
    const gamepad: GamepadFrame = {
      active: true,
      intent: { moveX: -0.8, moveY: 0.2, aimYaw: 0.4, sprint: false, actionBits: 2 },
      look: { yawDelta: 0, pitchDelta: 0 },
    };
    const merged = mergeInputSources(
      { intent: keyboardIntent, look: { yawDelta: 0, pitchDelta: 0 }, inputTimestamp: 10, zoomDelta: 0 },
      gamepad,
      0,
    );
    expect(merged.intent.moveX).toBeCloseTo(-0.8, 10);
    expect(merged.intent.moveY).toBeCloseTo(0.2, 10);
    expect(merged.intent.actionBits).toBe(3);
    expect(merged.intent.sprint).toBe(true);
  });
});