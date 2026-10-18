import { clampFootball } from './types';

export type ReceiveMode = 'kill' | 'controlled-exit';
export type ReceiveOutcome = 'idle' | 'armed' | 'consumed' | 'expired';

export interface ReceiveState {
  armedSeconds: number;
  lastOutcome: ReceiveOutcome;
}

export const RECEIVE_BUFFER_SECONDS = 0.32;
export const RECEIVE_EXIT_DEADZONE = 0.12;

export function createReceiveState(): ReceiveState {
  return { armedSeconds: 0, lastOutcome: 'idle' };
}

export function requestReceive(state: Readonly<ReceiveState>): ReceiveState {
  return { ...state, armedSeconds: RECEIVE_BUFFER_SECONDS, lastOutcome: 'armed' };
}

export function stepReceiveState(state: Readonly<ReceiveState>, deltaSeconds: number): ReceiveState {
  const dt = clampFootball(Number.isFinite(deltaSeconds) ? deltaSeconds : 0, 0, 1);
  if (state.armedSeconds <= 0) return state;
  const armedSeconds = Math.max(0, state.armedSeconds - dt);
  return {
    armedSeconds,
    lastOutcome: armedSeconds > 0 ? state.lastOutcome : 'expired',
  };
}

export function consumeReceive(state: Readonly<ReceiveState>): ReceiveState {
  return { ...state, armedSeconds: 0, lastOutcome: 'consumed' };
}

export function resolveReceiveMode(moveIntentMagnitude: number): ReceiveMode {
  const magnitude = clampFootball(Number.isFinite(moveIntentMagnitude) ? moveIntentMagnitude : 0, 0, 1);
  return magnitude < RECEIVE_EXIT_DEADZONE ? 'kill' : 'controlled-exit';
}
