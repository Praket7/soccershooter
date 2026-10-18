import { afterEach, describe, expect, test } from 'vitest';
import { PlayerActionBits } from '@soccershooter/sim/player/PlayerState';
import { keyboardStateToIntent, pointerStateToActionBits } from './ActionMap';
import { GamepadAdapter, gamepadSnapshotToFrame } from './GamepadAdapter';

afterEach(() => {
  Reflect.deleteProperty(globalThis, 'navigator');
});

describe('Stage 05 owner-overhaul football input mapping', () => {
  test('keyboard exposes dedicated E ground, Q through, R lofted and F receive intents', () => {
    const ground = keyboardStateToIntent({ keys: new Set(['KeyW', 'KeyE']), aimYaw: 0.4 });
    const through = keyboardStateToIntent({ keys: new Set(['KeyQ']), aimYaw: 0.4 });
    const lofted = keyboardStateToIntent({ keys: new Set(['KeyR']), aimYaw: 0.4 });
    const receive = keyboardStateToIntent({ keys: new Set(['KeyF']), aimYaw: 0.4 });
    expect(ground.moveY).toBeGreaterThan(0);
    expect(ground.actionBits & PlayerActionBits.Pass).toBe(PlayerActionBits.Pass);
    expect(through.actionBits & PlayerActionBits.ThroughPass).toBe(PlayerActionBits.ThroughPass);
    expect(lofted.actionBits & PlayerActionBits.LoftedPass).toBe(PlayerActionBits.LoftedPass);
    expect(receive.actionBits & PlayerActionBits.Receive).toBe(PlayerActionBits.Receive);
  });

  test('pointer primary/secondary state maps to shot hold and close-control precision', () => {
    const primary = pointerStateToActionBits(true, false);
    expect(primary & PlayerActionBits.ShootHeld).toBe(PlayerActionBits.ShootHeld);
    expect(primary & PlayerActionBits.Precision).toBe(0);

    const secondary = pointerStateToActionBits(false, true);
    expect(secondary & PlayerActionBits.Precision).toBe(PlayerActionBits.Precision);
    expect(secondary & PlayerActionBits.ShootHeld).toBe(0);
  });

  test('standard gamepad exposes the same high-level football intents as keyboard/mouse', () => {
    const buttons = Array.from({ length: 16 }, () => ({ pressed: false, value: 0 }));
    buttons[0] = { pressed: true, value: 1 }; // A aerial/jump
    buttons[1] = { pressed: true, value: 1 }; // B tackle
    buttons[2] = { pressed: true, value: 1 }; // X ground pass
    buttons[3] = { pressed: true, value: 1 }; // Y through pass
    buttons[4] = { pressed: true, value: 1 }; // LB lofted pass
    buttons[5] = { pressed: true, value: 1 }; // RB driven/finesse modifier
    buttons[6] = { pressed: true, value: 1 }; // LT close control
    buttons[7] = { pressed: true, value: 1 }; // RT shoot
    buttons[8] = { pressed: true, value: 1 }; // View receive/trap
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
    expect(frame.intent.actionBits & PlayerActionBits.ThroughPass).toBe(PlayerActionBits.ThroughPass);
    expect(frame.intent.actionBits & PlayerActionBits.LoftedPass).toBe(PlayerActionBits.LoftedPass);
    expect(frame.intent.actionBits & PlayerActionBits.Receive).toBe(PlayerActionBits.Receive);
    expect(frame.intent.actionBits & PlayerActionBits.ShootHeld).toBe(PlayerActionBits.ShootHeld);
    expect(frame.intent.actionBits & PlayerActionBits.Precision).toBe(PlayerActionBits.Precision);
    expect(frame.intent.actionBits & PlayerActionBits.DrivenModifier).toBe(PlayerActionBits.DrivenModifier);
  });

  test('holding any dedicated gamepad action emits one edge until released and pressed again', () => {
    const buttons = Array.from({ length: 16 }, () => ({ pressed: false, value: 0 }));
    buttons[2] = { pressed: true, value: 1 };
    buttons[3] = { pressed: true, value: 1 };
    const pad = { connected: true, mapping: 'standard', axes: [0, 0, 0, 0], buttons };
    Object.defineProperty(globalThis, 'navigator', {
      configurable: true,
      value: { getGamepads: () => [pad] },
    });

    const adapter = new GamepadAdapter();
    const first = adapter.read(0, 1 / 60);
    const held = adapter.read(0, 1 / 60);
    const edges = PlayerActionBits.Pass | PlayerActionBits.ThroughPass;
    expect((first?.intent.actionBits ?? 0) & edges).toBe(edges);
    expect((held?.intent.actionBits ?? 0) & edges).toBe(0);

    buttons[2] = { pressed: false, value: 0 };
    buttons[3] = { pressed: false, value: 0 };
    adapter.read(0, 1 / 60);
    buttons[2] = { pressed: true, value: 1 };
    const pressedAgain = adapter.read(0, 1 / 60);
    expect((pressedAgain?.intent.actionBits ?? 0) & PlayerActionBits.Pass).toBe(PlayerActionBits.Pass);
  });
});
