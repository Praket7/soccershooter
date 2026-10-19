import { PlayerActionBits } from '@soccershooter/sim/player/PlayerState';

export const FOOTBALL_EDGE_ACTION_BITS = (
  PlayerActionBits.Jump
  | PlayerActionBits.Tackle
  | PlayerActionBits.Pass
  | PlayerActionBits.ThroughPass
  | PlayerActionBits.LoftedPass
  | PlayerActionBits.Receive
  | PlayerActionBits.ShootReleased
) >>> 0;

export const FOOTBALL_HELD_ACTION_BITS = (
  PlayerActionBits.ShootHeld
  | PlayerActionBits.Precision
  | PlayerActionBits.DrivenModifier
  | PlayerActionBits.ChipModifier
  | PlayerActionBits.Technique
) >>> 0;

/** Mirrors the current render-to-fixed-step buffering behavior. */
export function bufferFootballActionBits(current: number, frameBits: number): number {
  return (current | (frameBits & FOOTBALL_EDGE_ACTION_BITS)) >>> 0;
}

export function consumeFootballActionBits(current: number, consumedBits: number): number {
  return (current & ~(consumedBits & FOOTBALL_EDGE_ACTION_BITS)) >>> 0;
}
