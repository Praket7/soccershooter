import { PlayerActionBits } from '../player/PlayerState';
import type { PassType } from './passing';
import type { ShotStyle } from './shooting';

export interface FootballActionIntent {
  passType: PassType | null;
  receiveRequested: boolean;
  shotStyle: ShotStyle;
}

export function decodeFootballActionIntent(actionBits: number): FootballActionIntent {
  const driven = (actionBits & PlayerActionBits.DrivenModifier) !== 0;
  const chip = (actionBits & PlayerActionBits.ChipModifier) !== 0;
  let passType: PassType | null = null;
  if ((actionBits & PlayerActionBits.LoftedPass) !== 0) passType = 'lofted';
  else if ((actionBits & PlayerActionBits.ThroughPass) !== 0) passType = driven ? 'chipped-through' : 'through';
  else if ((actionBits & PlayerActionBits.Pass) !== 0) passType = driven ? 'driven' : 'ground';

  const shotStyle: ShotStyle = chip ? 'chip' : driven ? 'finesse' : 'normal';
  return {
    passType,
    receiveRequested: (actionBits & PlayerActionBits.Receive) !== 0,
    shotStyle,
  };
}
