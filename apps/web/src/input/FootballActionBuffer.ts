import { PlayerActionBits } from '@soccershooter/sim/player/PlayerState';

export const FOOTBALL_EDGE_ACTION_BITS = (
  PlayerActionBits.Jump
  | PlayerActionBits.Tackle
  | PlayerActionBits.Pass
  | PlayerActionBits.ThroughPass
  | PlayerActionBits.LoftedPass
  | PlayerActionBits.Receive
  | PlayerActionBits.Elastico
  | PlayerActionBits.ShootReleased
) >>> 0;

export const FOOTBALL_HELD_ACTION_BITS = (
  PlayerActionBits.ShootHeld
  | PlayerActionBits.Precision
  | PlayerActionBits.DrivenModifier
  | PlayerActionBits.ChipModifier
  | PlayerActionBits.Technique
) >>> 0;

const PASS_EDGE_ACTION_BITS = (
  PlayerActionBits.Pass
  | PlayerActionBits.ThroughPass
  | PlayerActionBits.LoftedPass
) >>> 0;

const PASS_TECHNIQUE_MODIFIER_BITS = (
  PlayerActionBits.Precision
  | PlayerActionBits.DrivenModifier
  | PlayerActionBits.ChipModifier
) >>> 0;

/**
 * Preserve edge-triggered football actions until the next authoritative fixed
 * step. Pass technique is part of the same intent transaction: if Q was
 * pressed while Ctrl was held (or E while RMB/precision was held), releasing
 * the modifier on a later render frame must not downgrade the already-sampled
 * pass before simulation consumes it.
 */
export function bufferFootballActionBits(current: number, frameBits: number): number {
  const edgeBits = frameBits & FOOTBALL_EDGE_ACTION_BITS;
  let next = (current | edgeBits) >>> 0;
  if ((edgeBits & PASS_EDGE_ACTION_BITS) !== 0) {
    next = (next | (frameBits & PASS_TECHNIQUE_MODIFIER_BITS)) >>> 0;
  }
  return next;
}

/**
 * Consume the exact fixed-step edge. Snapshotted pass modifiers are cleared
 * with the pass so a one-frame chord can never contaminate the next action.
 */
export function consumeFootballActionBits(current: number, consumedBits: number): number {
  const consumedEdges = consumedBits & FOOTBALL_EDGE_ACTION_BITS;
  let next = (current & ~consumedEdges) >>> 0;
  if ((consumedEdges & PASS_EDGE_ACTION_BITS) !== 0) {
    next = (next & ~PASS_TECHNIQUE_MODIFIER_BITS) >>> 0;
  }
  return next;
}
