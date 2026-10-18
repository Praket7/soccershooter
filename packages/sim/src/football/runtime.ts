import { PlayerActionBits } from '../player/PlayerState';
import { consumeReceive, createReceiveState, requestReceive, stepReceiveState, type ReceiveState } from './receive';
import { clampFootball } from './types';

export interface FootballRuntimeState {
  controlTouchCooldown: number;
  kickCooldown: number;
  shotChargeSeconds: number;
  shotWasHeld: boolean;
  receive: ReceiveState;
  lastAction: 'idle' | 'touch' | 'pass' | 'shot' | 'challenge' | 'aerial';
}

export interface FootballRuntimeStep {
  state: FootballRuntimeState;
  releasedShotCharge: number | null;
}

export const MAX_SHOT_CHARGE_SECONDS = 0.85;
/** Extra defense against accidental tiny releases; pointer capture itself is now isolated. */
export const MIN_SHOT_CHARGE_SECONDS = 0.06;

export function createFootballRuntimeState(): FootballRuntimeState {
  return {
    controlTouchCooldown: 0,
    kickCooldown: 0,
    shotChargeSeconds: 0,
    shotWasHeld: false,
    receive: createReceiveState(),
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
    if (shotChargeSeconds >= MIN_SHOT_CHARGE_SECONDS) {
      releasedShotCharge = clampFootball(shotChargeSeconds / MAX_SHOT_CHARGE_SECONDS, 0.12, 1);
    }
    shotChargeSeconds = 0;
  } else if (state.shotWasHeld && !shootHeld) {
    shotChargeSeconds = 0;
  }

  let receive = state.receive;
  if ((actionBits & PlayerActionBits.Receive) !== 0) receive = requestReceive(receive);
  receive = stepReceiveState(receive, dt);

  return {
    state: {
      controlTouchCooldown: Math.max(0, state.controlTouchCooldown - dt),
      kickCooldown: Math.max(0, state.kickCooldown - dt),
      shotChargeSeconds,
      shotWasHeld: shootHeld,
      receive,
      lastAction: state.lastAction,
    },
    releasedShotCharge,
  };
}

export function consumeReceiveIntent(state: Readonly<FootballRuntimeState>): FootballRuntimeState {
  return { ...state, receive: consumeReceive(state.receive) };
}

export function markControlTouch(
  state: Readonly<FootballRuntimeState>,
  sprint: boolean,
  mode: 'normal' | 'precision' | 'sprint' | 'effort-turn' | 'trap' | 'receive-exit' = sprint ? 'sprint' : 'normal',
): FootballRuntimeState {
  let controlTouchCooldown = sprint ? 0.14 : 0.12;
  if (mode === 'effort-turn') controlTouchCooldown = 0.08;
  else if (mode === 'precision') controlTouchCooldown = 0.1;
  else if (mode === 'trap' || mode === 'receive-exit') controlTouchCooldown = 0.09;
  return {
    ...state,
    controlTouchCooldown,
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
