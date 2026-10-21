import { PlayerActionBits } from '../player/PlayerState';
import { decodeFootballActionIntent } from './actionIntent';
import { consumeReceive, createReceiveState, requestReceive, stepReceiveState, type ReceiveState } from './receive';
import type { ShotStyle } from './shooting';
import { clampFootball } from './types';

export {
  createFootballContactPlan,
  executePlannedFootballContact,
} from './contactPlan';
export type {
  ExecutePlannedFootballContactInput,
  FootballContactPlan,
  FootballContactPlanSeed,
  FootballContactSurface,
  FootballPlannedContactKind,
  PlannedContactExecutionReason,
  PlannedFootballContactExecution,
} from './contactPlan';
export {
  createPlannedDribbleState,
  stepPlannedDribble,
  stepTechniqueCarry,
} from './dribblePlanner';
export type {
  PlannedDribbleInput,
  PlannedDribbleState,
  PlannedDribbleStep,
} from './dribblePlanner';

export interface FootballRuntimeState {
  controlTouchCooldown: number;
  kickCooldown: number;
  shotChargeSeconds: number;
  shotWasHeld: boolean;
  shotStyleLatched: ShotStyle | null;
  receive: ReceiveState;
  lastAction: 'idle' | 'touch' | 'pass' | 'shot' | 'challenge' | 'aerial';
}

export interface FootballRuntimeStep {
  state: FootballRuntimeState;
  releasedShotCharge: number | null;
  releasedShotStyle: ShotStyle | null;
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
    shotStyleLatched: null,
    receive: createReceiveState(),
    lastAction: 'idle',
  };
}

function shotTechniquePriority(style: ShotStyle): number {
  if (style === 'chip') return 2;
  if (style === 'finesse') return 1;
  return 0;
}

function upgradeLatchedShotStyle(current: ShotStyle | null, requested: ShotStyle): ShotStyle {
  if (current === null) return requested;
  return shotTechniquePriority(requested) > shotTechniquePriority(current) ? requested : current;
}

export function stepFootballRuntime(
  state: Readonly<FootballRuntimeState>,
  actionBits: number,
  deltaSeconds: number,
): FootballRuntimeStep {
  const dt = clampFootball(Number.isFinite(deltaSeconds) ? deltaSeconds : 0, 0, 0.25);
  const shootHeld = (actionBits & PlayerActionBits.ShootHeld) !== 0;
  const shootReleased = (actionBits & PlayerActionBits.ShootReleased) !== 0;
  const shotStarted = shootHeld && !state.shotWasHeld;

  let shotChargeSeconds = state.shotChargeSeconds;
  let shotStyleLatched = state.shotStyleLatched;
  const requestedShotStyle = decodeFootballActionIntent(actionBits).shotStyle;
  if (shotStarted) shotStyleLatched = requestedShotStyle;
  else if (shootHeld) {
    // Real players do not hit multi-button chords on the exact same input frame.
    // While LMB remains held, allow the technique to upgrade from normal ->
    // finesse -> chip. Once upgraded it never downgrades if the modifier is
    // released before LMB, so the resulting contact remains deterministic and
    // readable without requiring perfect button ordering.
    shotStyleLatched = upgradeLatchedShotStyle(shotStyleLatched, requestedShotStyle);
  }
  if (shootHeld) shotChargeSeconds = Math.min(MAX_SHOT_CHARGE_SECONDS, shotChargeSeconds + dt);

  let releasedShotCharge: number | null = null;
  let releasedShotStyle: ShotStyle | null = null;
  if (shootReleased && (state.shotWasHeld || shotChargeSeconds > 0)) {
    if (shotChargeSeconds >= MIN_SHOT_CHARGE_SECONDS) {
      releasedShotCharge = clampFootball(shotChargeSeconds / MAX_SHOT_CHARGE_SECONDS, 0.12, 1);
      releasedShotStyle = shotStyleLatched ?? decodeFootballActionIntent(actionBits).shotStyle;
    }
    shotChargeSeconds = 0;
    shotStyleLatched = null;
  } else if (state.shotWasHeld && !shootHeld) {
    shotChargeSeconds = 0;
    shotStyleLatched = null;
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
      shotStyleLatched,
      receive,
      lastAction: state.lastAction,
    },
    releasedShotCharge,
    releasedShotStyle,
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
  // Legacy cadence retained temporarily for pass/shot migration compatibility.
  // Stage 05R planned dribbling must not read this field as its cadence source.
  let controlTouchCooldown = 0.16;
  if (mode === 'sprint') controlTouchCooldown = 0.20;
  else if (mode === 'effort-turn') controlTouchCooldown = 0.09;
  else if (mode === 'precision') controlTouchCooldown = 0.13;
  else if (mode === 'trap' || mode === 'receive-exit') controlTouchCooldown = 0.08;
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
