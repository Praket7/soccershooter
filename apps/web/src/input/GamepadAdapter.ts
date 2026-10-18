import type { InputIntent } from '@soccershooter/sim';
import { PlayerActionBits } from '@soccershooter/sim/player/PlayerState';
import { normalizeMoveAxes, type LookDelta } from './ActionMap';

export interface GamepadButtonSnapshot {
  pressed: boolean;
  value: number;
}

export interface GamepadSnapshot {
  axes: readonly number[];
  buttons: readonly GamepadButtonSnapshot[];
  mapping: string;
}

export interface GamepadOptions {
  deadzone?: number;
  lookDeadzone?: number;
  yawRate?: number;
  pitchRate?: number;
  invertY?: boolean;
}

export interface GamepadFrame {
  intent: InputIntent;
  look: LookDelta;
  active: boolean;
}

export const DEFAULT_GAMEPAD_YAW_RATE = 3.5;
export const DEFAULT_GAMEPAD_PITCH_RATE = 2.7;

const TAU = Math.PI * 2;

function wrapYaw(yaw: number): number {
  const wrapped = ((yaw + Math.PI) % TAU + TAU) % TAU - Math.PI;
  return Object.is(wrapped, -0) ? 0 : wrapped;
}

function axis(snapshot: Readonly<GamepadSnapshot>, index: number): number {
  const value = snapshot.axes[index] ?? 0;
  return Number.isFinite(value) ? Math.max(-1, Math.min(1, value)) : 0;
}

function button(snapshot: Readonly<GamepadSnapshot>, index: number): boolean {
  const value = snapshot.buttons[index];
  return Boolean(value?.pressed || (value?.value ?? 0) > 0.5);
}

export function gamepadSnapshotToFrame(
  snapshot: Readonly<GamepadSnapshot>,
  currentAimYaw: number,
  deltaSeconds: number,
  options: GamepadOptions = {},
): GamepadFrame {
  if (!Number.isFinite(currentAimYaw)) throw new TypeError('currentAimYaw must be finite');
  if (!Number.isFinite(deltaSeconds) || deltaSeconds < 0 || deltaSeconds > 0.25) {
    throw new RangeError('deltaSeconds must be finite and in [0, 0.25]');
  }
  const deadzone = options.deadzone ?? 0.15;
  const lookDeadzone = options.lookDeadzone ?? 0.12;
  const yawRate = options.yawRate ?? DEFAULT_GAMEPAD_YAW_RATE;
  const pitchRate = options.pitchRate ?? DEFAULT_GAMEPAD_PITCH_RATE;
  const invertY = options.invertY ?? false;
  const move = normalizeMoveAxes(axis(snapshot, 0), -axis(snapshot, 1), deadzone);
  const look = normalizeMoveAxes(axis(snapshot, 2), axis(snapshot, 3), lookDeadzone);
  const yawDelta = look.x * yawRate * deltaSeconds;
  const pitchDelta = look.y * pitchRate * deltaSeconds * (invertY ? 1 : -1);
  let actionBits = 0;
  if (button(snapshot, 0)) actionBits |= PlayerActionBits.Jump;
  if (button(snapshot, 1)) actionBits |= PlayerActionBits.Tackle;
  if (button(snapshot, 2)) actionBits |= PlayerActionBits.Pass;
  if (button(snapshot, 5)) actionBits |= PlayerActionBits.Technique;
  if (button(snapshot, 6)) actionBits |= PlayerActionBits.Precision;
  if (button(snapshot, 7)) actionBits |= PlayerActionBits.ShootHeld;
  const intent: InputIntent = {
    moveX: move.x,
    moveY: move.y,
    aimYaw: wrapYaw(currentAimYaw + yawDelta),
    sprint: button(snapshot, 10),
    actionBits: actionBits >>> 0,
  };
  const active = move.magnitude > 0 || look.magnitude > 0 || intent.sprint || actionBits !== 0;
  return { intent, look: { yawDelta, pitchDelta }, active };
}

export class GamepadAdapter {
  readonly #options: GamepadOptions;
  #shootWasHeld = false;
  #passWasHeld = false;

  constructor(options: GamepadOptions = {}) {
    this.#options = options;
  }

  read(currentAimYaw: number, deltaSeconds: number): GamepadFrame | null {
    const pads = navigator.getGamepads?.() ?? [];
    for (const pad of pads) {
      if (!pad || !pad.connected) continue;
      if (pad.mapping !== 'standard') continue;
      const frame = gamepadSnapshotToFrame(
        {
          axes: [...pad.axes],
          buttons: pad.buttons.map((entry) => ({ pressed: entry.pressed, value: entry.value })),
          mapping: pad.mapping,
        },
        currentAimYaw,
        deltaSeconds,
        this.#options,
      );
      const shootHeld = (frame.intent.actionBits & PlayerActionBits.ShootHeld) !== 0;
      if (this.#shootWasHeld && !shootHeld) frame.intent.actionBits |= PlayerActionBits.ShootReleased;
      this.#shootWasHeld = shootHeld;

      const passHeld = (frame.intent.actionBits & PlayerActionBits.Pass) !== 0;
      if (passHeld && this.#passWasHeld) frame.intent.actionBits &= ~PlayerActionBits.Pass;
      this.#passWasHeld = passHeld;
      return frame;
    }
    this.#shootWasHeld = false;
    this.#passWasHeld = false;
    return null;
  }
}
