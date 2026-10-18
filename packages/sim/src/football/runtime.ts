import { PlayerActionBits } from '../player/PlayerState';
import { clampFootball } from './types';

export interface FootballRuntimeState {
  controlTouchCooldown: number;
  kickCooldown: number;
  shotChargeSeconds: number;
  shotWasHeld: boolean;
  lastAction: 'idle' | 'touch' | 'pass' | 'shot' | 'challenge' | 'aerial';
}

export interface FootballRuntimeStep {
  state: FootballRuntimeState;
  releasedShotCharge: number | null;
}

export const MAX_SHOT_CHARGE_SECONDS = 0.85;

export function createFootballRuntimeState(): FootballRuntimeState {
  return {
    controlTouchCooldown: 0,
    kickCooldown: 0,
    shotChargeSeconds: 0,
    shotWasHeld: false,
    lastAction: 'idle',
  };
}

export function stepFootballRuntime(
  state: Readonly<FootballRuntimeState>,
  actionBits: number,
  deltaSeconds: number,
): FootballRuntimeStep {
  const dt = clampFootball(Number.isFinite(deltaSeconds) ? deltaSeconds : 0, 0, 0.25);
  const shootHeld = (actionBits & PlayerActionBits.ShootHeld) !== 0;
  const shootReleased = (actionBits & PlayerActionBits.ShootReleased) !== 0;
  let shotChargeSeconds = state.shotChargeSeconds;
  if (shootHeld) shotChargeSeconds = Math.min(MAX_SHOT_CHARGE_SECONDS, shotChargeSeconds + dt);

  let releasedShotCharge: number | null = null;
  if (shootReleased && (state.shotWasHeld || shotChargeSeconds > 0)) {
    releasedShotCharge = clampFootball(shotChargeSeconds / MAX_SHOT_CHARGE_SECONDS, 0.12, 1);
    shotChargeSeconds = 0;
  } else if (state.shotWasHeld && !shootHeld) {
    // A missing release edge means the input source disappeared (blur,
    // pointer-lock loss, controller disconnect) or the player cancelled the
    // preparation. Never bank that hidden charge into the next shot.
    shotChargeSeconds = 0;
  }

  return {
    state: {
      controlTouchCooldown: Math.max(0, state.controlTouchCooldown - dt),
      kickCooldown: Math.max(0, state.kickCooldown - dt),
      shotChargeSeconds,
      shotWasHeld: shootHeld,
      lastAction: state.lastAction,
    },
    releasedShotCharge,
  };
}

export function markControlTouch(
  state: Readonly<FootballRuntimeState>,
  sprint: boolean,
): FootballRuntimeState {
  return {
    ...state,
    // Frequent but still discrete touches: fast enough to steer a dribble,
    // slow enough that the free ball always gets real physics time between
    // contacts. Effort-turn/trap touches use the controlled cadence.
    controlTouchCooldown: sprint ? 0.17 : 0.12,
    lastAction: 'touch',
  };
}

export function markKick(
  state: Readonly<FootballRuntimeState>,
  action: 'pass' | 'shot' = 'shot',
): FootballRuntimeState {
  return {
    ...state,
    kickCooldown: action === 'pass' ? 0.14 : 0.19,
    lastAction: action,
  };
}
