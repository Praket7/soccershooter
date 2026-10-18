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

  test('Z and X are explicit held modifiers rather than hidden shot-style hotkeys', () => {
    const driven = keyboardStateToIntent({ keys: new Set(['KeyZ']), aimYaw: 0 });
    const chip = keyboardStateToIntent({ keys: new Set(['KeyX']), aimYaw: 0 });
    expect(driven.actionBits & PlayerActionBits.DrivenModifier).toBe(PlayerActionBits.DrivenModifier);
    expect(chip.actionBits & PlayerActionBits.ChipModifier).toBe(PlayerActionBits.ChipModifier);
  });
});
