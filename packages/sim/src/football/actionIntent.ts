import { PlayerActionBits } from '../player/PlayerState';
import type { PassType } from './passing';
import type { ShotStyle } from './shooting';

export interface FootballActionIntent {
  passType: PassType | null;
  receiveRequested: boolean;
  shotStyle: ShotStyle;
}

/**
 * Decodes high-level football intent from device-agnostic action bits.
 *
 * Precision is the firm/controlled technique family: on a ground pass it
 * becomes driven, and on a shot it becomes finesse. ChipModifier is the lift
 * family: on a through ball it becomes chipped-through, and on a shot it
 * becomes a chip. DrivenModifier remains a compatibility alias for existing
 * gamepad traces while keyboard/mouse no longer exposes the old Z chord.
 */
export function decodeFootballActionIntent(actionBits: number): FootballActionIntent {
  const precision = (actionBits & PlayerActionBits.Precision) !== 0;
  const legacyDriven = (actionBits & PlayerActionBits.DrivenModifier) !== 0;
  const chip = (actionBits & PlayerActionBits.ChipModifier) !== 0;
  const firmTechnique = precision || legacyDriven;

  let passType: PassType | null = null;
  if ((actionBits & PlayerActionBits.LoftedPass) !== 0) {
    passType = 'lofted';
  } else if ((actionBits & PlayerActionBits.ThroughPass) !== 0) {
    passType = chip || legacyDriven ? 'chipped-through' : 'through';
  } else if ((actionBits & PlayerActionBits.Pass) !== 0) {
    passType = firmTechnique ? 'driven' : 'ground';
  }

  const shotStyle: ShotStyle = chip ? 'chip' : firmTechnique ? 'finesse' : 'normal';
  return {
    passType,
    receiveRequested: (actionBits & PlayerActionBits.Receive) !== 0,
    shotStyle,
  };
}
