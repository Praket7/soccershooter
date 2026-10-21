import { describe, expect, test } from 'vitest';
import { PlayerActionBits } from '@soccershooter/sim/player/PlayerState';
import { keyboardStateToIntent, resolvePointerButtonDown } from './ActionMap';

describe('owner control overhaul input contract', () => {
  test('first primary click while unlocked requests capture only and cannot start a shot', () => {
    const result = resolvePointerButtonDown({
      primaryDown: false,
      secondaryDown: false,
      button: 0,
      pointerLocked: false,
    });
    expect(result.requestPointerLock).toBe(true);
    expect(result.primaryDown).toBe(false);
    expect(result.secondaryDown).toBe(false);
    expect(result.actionBits & (PlayerActionBits.ShootHeld | PlayerActionBits.ShootReleased)).toBe(0);
  });

  test('primary click while locked starts shot preparation', () => {
    const result = resolvePointerButtonDown({
      primaryDown: false,
      secondaryDown: false,
      button: 0,
      pointerLocked: true,
    });
    expect(result.requestPointerLock).toBe(false);
    expect(result.primaryDown).toBe(true);
    expect(result.actionBits & PlayerActionBits.ShootHeld).toBe(PlayerActionBits.ShootHeld);
  });

  test('F E Q R expose dedicated receive ground through and lofted intents', () => {
    const receive = keyboardStateToIntent({ keys: new Set(['KeyF']), aimYaw: 0 });
    const ground = keyboardStateToIntent({ keys: new Set(['KeyE']), aimYaw: 0 });
    const through = keyboardStateToIntent({ keys: new Set(['KeyQ']), aimYaw: 0 });
    const lofted = keyboardStateToIntent({ keys: new Set(['KeyR']), aimYaw: 0 });

    expect(receive.actionBits & PlayerActionBits.Receive).toBe(PlayerActionBits.Receive);
    expect(ground.actionBits & PlayerActionBits.Pass).toBe(PlayerActionBits.Pass);
    expect(through.actionBits & PlayerActionBits.ThroughPass).toBe(PlayerActionBits.ThroughPass);
    expect(lofted.actionBits & PlayerActionBits.LoftedPass).toBe(PlayerActionBits.LoftedPass);
  });

  test('Y requests the elastico move independently of the selected T technique', () => {
    const elastico = keyboardStateToIntent({ keys: new Set(['KeyY']), aimYaw: 0 });
    expect(elastico.actionBits & PlayerActionBits.Elastico).toBe(PlayerActionBits.Elastico);
    expect(elastico.actionBits & PlayerActionBits.Technique).toBe(0);
  });

  test('Ctrl is the lift modifier and no longer doubles as a tackle key', () => {
    const left = keyboardStateToIntent({ keys: new Set(['ControlLeft']), aimYaw: 0 });
    const right = keyboardStateToIntent({ keys: new Set(['ControlRight']), aimYaw: 0 });

    expect(left.actionBits & PlayerActionBits.ChipModifier).toBe(PlayerActionBits.ChipModifier);
    expect(right.actionBits & PlayerActionBits.ChipModifier).toBe(PlayerActionBits.ChipModifier);
    expect(left.actionBits & PlayerActionBits.Tackle).toBe(0);
    expect(right.actionBits & PlayerActionBits.Tackle).toBe(0);
  });

  test('C and B remain defensive actions while Z and X are removed from normal-match technique chords', () => {
    const c = keyboardStateToIntent({ keys: new Set(['KeyC']), aimYaw: 0 });
    const b = keyboardStateToIntent({ keys: new Set(['KeyB']), aimYaw: 0 });
    const z = keyboardStateToIntent({ keys: new Set(['KeyZ']), aimYaw: 0 });
    const x = keyboardStateToIntent({ keys: new Set(['KeyX']), aimYaw: 0 });

    expect(c.actionBits & PlayerActionBits.Tackle).toBe(PlayerActionBits.Tackle);
    expect(b.actionBits & PlayerActionBits.Tackle).toBe(PlayerActionBits.Tackle);
    expect(z.actionBits & (PlayerActionBits.DrivenModifier | PlayerActionBits.ChipModifier)).toBe(0);
    expect(x.actionBits & (PlayerActionBits.DrivenModifier | PlayerActionBits.ChipModifier)).toBe(0);
  });
});
