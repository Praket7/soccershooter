import { describe, expect, test } from 'vitest';
import { PlayerActionBits } from '@soccershooter/sim/player/PlayerState';
import { keyboardStateToIntent, pointerStateToActionBits } from './ActionMap';
import { gamepadSnapshotToFrame } from './GamepadAdapter';

describe('Stage 05 football input mapping', () => {
  test('keyboard E passes and Q acts as a held technique modifier without disturbing movement', () => {
    const intent = keyboardStateToIntent({ keys: new Set(['KeyW', 'KeyE', 'KeyQ']), aimYaw: 0.4 });
    expect(intent.moveY).toBeGreaterThan(0);
    expect(intent.actionBits & PlayerActionBits.Pass).toBe(PlayerActionBits.Pass);
    expect(intent.actionBits & PlayerActionBits.Technique).toBe(PlayerActionBits.Technique);
  });

  test('pointer primary/secondary state maps to shot hold and precision control', () => {
    const primary = pointerStateToActionBits(true, false);
    expect(primary & PlayerActionBits.ShootHeld).toBe(PlayerActionBits.ShootHeld);
    expect(primary & PlayerActionBits.Precision).toBe(0);

    const secondary = pointerStateToActionBits(false, true);
    expect(secondary & PlayerActionBits.Precision).toBe(PlayerActionBits.Precision);
    expect(secondary & PlayerActionBits.ShootHeld).toBe(0);
  });

  test('standard gamepad exposes pass, shot, precision, technique, aerial, tackle and sprint intents', () => {
    const buttons = Array.from({ length: 16 }, () => ({ pressed: false, value: 0 }));
    buttons[0] = { pressed: true, value: 1 }; // A aerial/jump
    buttons[1] = { pressed: true, value: 1 }; // B tackle
    buttons[2] = { pressed: true, value: 1 }; // X pass
    buttons[5] = { pressed: true, value: 1 }; // RB technique
    buttons[6] = { pressed: true, value: 1 }; // LT precision
    buttons[7] = { pressed: true, value: 1 }; // RT shoot
    buttons[10] = { pressed: true, value: 1 }; // L3 sprint

    const frame = gamepadSnapshotToFrame(
      { axes: [0, -1, 0, 0], buttons, mapping: 'standard' },
      0,
      1 / 60,
    );

    expect(frame.intent.sprint).toBe(true);
    expect(frame.intent.actionBits & PlayerActionBits.Jump).toBe(PlayerActionBits.Jump);
    expect(frame.intent.actionBits & PlayerActionBits.Tackle).toBe(PlayerActionBits.Tackle);
    expect(frame.intent.actionBits & PlayerActionBits.Pass).toBe(PlayerActionBits.Pass);
    expect(frame.intent.actionBits & PlayerActionBits.ShootHeld).toBe(PlayerActionBits.ShootHeld);
    expect(frame.intent.actionBits & PlayerActionBits.Precision).toBe(PlayerActionBits.Precision);
    expect(frame.intent.actionBits & PlayerActionBits.Technique).toBe(PlayerActionBits.Technique);
  });
});
