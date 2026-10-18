import { describe, expect, test } from 'vitest';
import { PlayerActionBits } from '@soccershooter/sim/player/PlayerState';
import {
  DEFAULT_MOUSE_SENSITIVITY,
  keyboardStateToIntent,
  normalizeMoveAxes,
  normalizeWheelZoomDelta,
} from './ActionMap';
import { DEFAULT_GAMEPAD_YAW_RATE, gamepadSnapshotToFrame } from './GamepadAdapter';

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

  test('trackpad and wheel zoom deltas preserve direction across browser delta modes and stay bounded', () => {
    expect(normalizeWheelZoomDelta(60, 0)).toBeGreaterThan(0);
    expect(normalizeWheelZoomDelta(-60, 0)).toBeLessThan(0);
    expect(normalizeWheelZoomDelta(3, 1)).toBeGreaterThan(0);
    expect(normalizeWheelZoomDelta(-1, 2)).toBeLessThan(0);
    expect(Math.abs(normalizeWheelZoomDelta(100000, 0))).toBeLessThanOrEqual(1);
  });

  test('default camera input is faster than the first playtest build without becoming twitchy', () => {
    expect(DEFAULT_MOUSE_SENSITIVITY).toBeGreaterThanOrEqual(0.003);
    expect(DEFAULT_MOUSE_SENSITIVITY).toBeLessThanOrEqual(0.0036);
    expect(DEFAULT_GAMEPAD_YAW_RATE).toBeGreaterThanOrEqual(3.3);
    expect(DEFAULT_GAMEPAD_YAW_RATE).toBeLessThanOrEqual(3.8);

    const frame = gamepadSnapshotToFrame(
      {
        axes: [0, 0, 1, 0],
        buttons: Array.from({ length: 16 }, () => ({ pressed: false, value: 0 })),
        mapping: 'standard',
      },
      0,
      1 / 60,
    );
    expect(frame.look.yawDelta).toBeGreaterThan(0.055);
    expect(frame.look.yawDelta).toBeLessThan(0.065);
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

  test('keyboard B is an explicit tackle-hook alias while A remains left movement', () => {
    const tackle = keyboardStateToIntent({ keys: new Set(['KeyB']), aimYaw: 0 });
    expect(tackle.actionBits & PlayerActionBits.Tackle).toBe(PlayerActionBits.Tackle);

    const left = keyboardStateToIntent({ keys: new Set(['KeyA']), aimYaw: 0 });
    expect(left.moveX).toBeLessThan(0);
    expect(left.actionBits & PlayerActionBits.Jump).toBe(0);
  });
});