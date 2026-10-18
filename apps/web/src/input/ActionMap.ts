import type { InputIntent } from '@soccershooter/sim';
import { PlayerActionBits } from '@soccershooter/sim/player/PlayerState';

export interface KeyboardIntentSample {
  keys: ReadonlySet<string>;
  aimYaw: number;
}

export interface NormalizedAxes {
  x: number;
  y: number;
  magnitude: number;
}

export interface LookDelta {
  yawDelta: number;
  pitchDelta: number;
}

export interface ActionFrame {
  intent: InputIntent;
  look: LookDelta;
  inputTimestamp: number | null;
  zoomDelta: number;
}

export interface ActionMapOptions {
  mouseSensitivity?: number;
  invertY?: boolean;
}

export const DEFAULT_MOUSE_SENSITIVITY = 0.00325;

const TAU = Math.PI * 2;

function wrapYaw(yaw: number): number {
  const wrapped = ((yaw + Math.PI) % TAU + TAU) % TAU - Math.PI;
  return Object.is(wrapped, -0) ? 0 : wrapped;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function normalizeWheelZoomDelta(deltaY: number, deltaMode: number): number {
  if (!Number.isFinite(deltaY) || !Number.isFinite(deltaMode)) {
    throw new TypeError('wheel zoom delta and mode must be finite');
  }
  const modeScale = deltaMode === 1 ? 16 : deltaMode === 2 ? 600 : 1;
  return clamp((deltaY * modeScale) / 120, -1, 1);
}

export function normalizeMoveAxes(x: number, y: number, deadzone = 0): NormalizedAxes {
  if (![x, y, deadzone].every(Number.isFinite)) throw new TypeError('axes and deadzone must be finite');
  if (deadzone < 0 || deadzone >= 1) throw new RangeError('deadzone must be in [0, 1)');
  const length = Math.hypot(x, y);
  if (length <= deadzone || length === 0) return { x: 0, y: 0, magnitude: 0 };
  const clamped = Math.min(1, length);
  const magnitude = deadzone === 0 ? clamped : Math.min(1, (clamped - deadzone) / (1 - deadzone));
  const scale = magnitude / length;
  return { x: x * scale, y: y * scale, magnitude };
}

function pressed(keys: ReadonlySet<string>, ...codes: string[]): boolean {
  return codes.some((code) => keys.has(code));
}

function actionBitsForCode(code: string): number {
  if (code === 'Space') return PlayerActionBits.Jump;
  if (code === 'KeyC' || code === 'KeyB' || code === 'ControlLeft' || code === 'ControlRight') return PlayerActionBits.Tackle;
  if (code === 'KeyE') return PlayerActionBits.Pass;
  return 0;
}

export function pointerStateToActionBits(primaryDown: boolean, secondaryDown: boolean): number {
  let actionBits = 0;
  if (primaryDown) actionBits |= PlayerActionBits.ShootHeld;
  if (secondaryDown) actionBits |= PlayerActionBits.Precision;
  return actionBits >>> 0;
}

export function keyboardStateToIntent(sample: Readonly<KeyboardIntentSample>): InputIntent {
  const rawX = Number(pressed(sample.keys, 'KeyD', 'ArrowRight')) - Number(pressed(sample.keys, 'KeyA', 'ArrowLeft'));
  const rawY = Number(pressed(sample.keys, 'KeyW', 'ArrowUp')) - Number(pressed(sample.keys, 'KeyS', 'ArrowDown'));
  const move = normalizeMoveAxes(rawX, rawY);
  let actionBits = 0;
  if (pressed(sample.keys, 'Space')) actionBits |= PlayerActionBits.Jump;
  if (pressed(sample.keys, 'KeyC', 'KeyB', 'ControlLeft', 'ControlRight')) actionBits |= PlayerActionBits.Tackle;
  if (pressed(sample.keys, 'KeyQ')) actionBits |= PlayerActionBits.Technique;
  return {
    moveX: move.x,
    moveY: move.y,
    aimYaw: wrapYaw(sample.aimYaw),
    sprint: pressed(sample.keys, 'ShiftLeft', 'ShiftRight'),
    actionBits: actionBits >>> 0,
  };
}

export class ActionMap {
  readonly #keys = new Set<string>();
  readonly #mouseSensitivity: number;
  readonly #invertY: boolean;
  readonly #keyboardTarget: Window;
  readonly #pointerTarget: HTMLElement;
  #aimYaw = 0;
  #pendingYawDelta = 0;
  #pendingPitchDelta = 0;
  #pendingZoomDelta = 0;
  #pendingActionBits = 0;
  #primaryDown = false;
  #secondaryDown = false;
  #lastInputTimestamp: number | null = null;
  #attached = false;

  readonly #onKeyDown = (event: KeyboardEvent) => {
    this.#keys.add(event.code);
    this.#lastInputTimestamp = performance.now();
    if (!event.repeat) this.#pendingActionBits |= actionBitsForCode(event.code);
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.code)) event.preventDefault();
  };

  readonly #onKeyUp = (event: KeyboardEvent) => {
    this.#keys.delete(event.code);
    this.#lastInputTimestamp = performance.now();
  };

  readonly #onBlur = () => {
    this.#keys.clear();
    this.#pendingActionBits = 0;
    this.#primaryDown = false;
    this.#secondaryDown = false;
  };

  readonly #onPointerMove = (event: PointerEvent) => {
    if (document.pointerLockElement !== this.#pointerTarget) return;
    const yawDelta = event.movementX * this.#mouseSensitivity;
    const pitchSign = this.#invertY ? 1 : -1;
    const pitchDelta = event.movementY * this.#mouseSensitivity * pitchSign;
    this.#aimYaw = wrapYaw(this.#aimYaw + yawDelta);
    this.#pendingYawDelta += yawDelta;
    this.#pendingPitchDelta += pitchDelta;
    this.#lastInputTimestamp = performance.now();
  };

  readonly #onWheel = (event: WheelEvent) => {
    event.preventDefault();
    this.#pendingZoomDelta = clamp(
      this.#pendingZoomDelta + normalizeWheelZoomDelta(event.deltaY, event.deltaMode),
      -2,
      2,
    );
  };

  readonly #onPointerDown = (event: PointerEvent) => {
    if (document.pointerLockElement !== this.#pointerTarget) {
      void this.#pointerTarget.requestPointerLock();
      return;
    }
    if (event.button === 0) this.#primaryDown = true;
    if (event.button === 2) {
      this.#secondaryDown = true;
      event.preventDefault();
    }
    this.#lastInputTimestamp = performance.now();
  };

  readonly #onPointerUp = (event: PointerEvent) => {
    if (event.button === 0 && this.#primaryDown) {
      this.#primaryDown = false;
      this.#pendingActionBits |= PlayerActionBits.ShootReleased;
    }
    if (event.button === 2) this.#secondaryDown = false;
    this.#lastInputTimestamp = performance.now();
  };

  readonly #onContextMenu = (event: Event) => {
    event.preventDefault();
  };

  constructor(keyboardTarget: Window, pointerTarget: HTMLElement, options: ActionMapOptions = {}) {
    this.#keyboardTarget = keyboardTarget;
    this.#pointerTarget = pointerTarget;
    this.#mouseSensitivity = options.mouseSensitivity ?? DEFAULT_MOUSE_SENSITIVITY;
    this.#invertY = options.invertY ?? false;
    if (!Number.isFinite(this.#mouseSensitivity) || this.#mouseSensitivity <= 0) {
      throw new RangeError('mouseSensitivity must be a positive finite number');
    }
  }

  attach(): void {
    if (this.#attached) return;
    this.#attached = true;
    this.#keyboardTarget.addEventListener('keydown', this.#onKeyDown, { passive: false });
    this.#keyboardTarget.addEventListener('keyup', this.#onKeyUp);
    this.#keyboardTarget.addEventListener('blur', this.#onBlur);
    this.#keyboardTarget.addEventListener('pointermove', this.#onPointerMove);
    this.#keyboardTarget.addEventListener('pointerup', this.#onPointerUp);
    this.#pointerTarget.addEventListener('pointerdown', this.#onPointerDown);
    this.#pointerTarget.addEventListener('wheel', this.#onWheel, { passive: false });
    this.#pointerTarget.addEventListener('contextmenu', this.#onContextMenu);
  }

  detach(): void {
    if (!this.#attached) return;
    this.#attached = false;
    this.#keyboardTarget.removeEventListener('keydown', this.#onKeyDown);
    this.#keyboardTarget.removeEventListener('keyup', this.#onKeyUp);
    this.#keyboardTarget.removeEventListener('blur', this.#onBlur);
    this.#keyboardTarget.removeEventListener('pointermove', this.#onPointerMove);
    this.#keyboardTarget.removeEventListener('pointerup', this.#onPointerUp);
    this.#pointerTarget.removeEventListener('pointerdown', this.#onPointerDown);
    this.#pointerTarget.removeEventListener('wheel', this.#onWheel);
    this.#pointerTarget.removeEventListener('contextmenu', this.#onContextMenu);
    this.#keys.clear();
    this.#pendingActionBits = 0;
    this.#pendingZoomDelta = 0;
    this.#primaryDown = false;
    this.#secondaryDown = false;
  }

  setAimYaw(yaw: number): void {
    if (!Number.isFinite(yaw)) throw new TypeError('aim yaw must be finite');
    this.#aimYaw = wrapYaw(yaw);
  }

  get aimYaw(): number {
    return this.#aimYaw;
  }

  consumeFrame(): ActionFrame {
    const intent = keyboardStateToIntent({ keys: this.#keys, aimYaw: this.#aimYaw });
    intent.actionBits = (
      intent.actionBits
      | this.#pendingActionBits
      | pointerStateToActionBits(this.#primaryDown, this.#secondaryDown)
    ) >>> 0;
    const frame: ActionFrame = {
      intent,
      look: { yawDelta: this.#pendingYawDelta, pitchDelta: this.#pendingPitchDelta },
      inputTimestamp: this.#lastInputTimestamp,
      zoomDelta: this.#pendingZoomDelta,
    };
    this.#pendingYawDelta = 0;
    this.#pendingPitchDelta = 0;
    this.#pendingZoomDelta = 0;
    this.#pendingActionBits = 0;
    return frame;
  }
}
