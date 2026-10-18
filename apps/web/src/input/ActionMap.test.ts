import { describe, expect, test } from 'vitest';
import { PlayerActionBits } from '@soccershooter/sim/player/PlayerState';
import { keyboardStateToIntent, normalizeMoveAxes } from './ActionMap';
import { gamepadSnapshotToFrame } from './GamepadAdapter';

describe('Stage 03 normalized input contract', () => {
  test('keyboard diagonal input is normalized rather than faster', () => {
    const intent = keyboardStateToIntent({ keys: new Set(['KeyW', 'KeyD']), aimYaw: 0 });
    expect(Math.hypot(intent.moveX, intent.moveY)).toBeCloseTo(1, 10);
  });

  test('radial deadzone preserves direction and remaps usable analog range', () => {
    expect(normalizeMoveAxes(0.05, -0.04, 0.15)).toEqual({ x: 0, y: 0, magnitude: 0 });
    const value = normalizeMoveAxes(0.6, 0.8, 0.15);
    expect(Math.hypot(value.x, value.y)).toBeCloseTo(value.magnitude, 10);
    expect(value.magnitude).toBeCloseTo(1, 10);
  });

  test('keyboard and standard gamepad can generate equivalent gameplay intent', () => {
    const keyboard = keyboardStateToIntent({ keys: new Set(['KeyW', 'ShiftLeft', 'Space']), aimYaw: 0.75 });
    const buttons = Array.from({ length: 16 }, () => ({ pressed: false, value: 0 }));
    buttons[0] = { pressed: true, value: 1 };
    buttons[10] = { pressed: true, value: 1 };
    const gamepad = gamepadSnapshotToFrame(
      { axes: [0, -1, 0, 0], buttons, mapping: 'standard' },
      0.75,
      0,
    );
    expect(gamepad.intent).toEqual(keyboard);
    expect(gamepad.intent.actionBits & PlayerActionBits.Jump).toBe(PlayerActionBits.Jump);
  });

  test('action hooks are encoded as bounded bits rather than device-specific state', () => {
    const intent = keyboardStateToIntent({ keys: new Set(['KeyC', 'Space']), aimYaw: 0 });
    expect(intent.actionBits & PlayerActionBits.Jump).toBe(PlayerActionBits.Jump);
    expect(intent.actionBits & PlayerActionBits.Tackle).toBe(PlayerActionBits.Tackle);
  });
});
