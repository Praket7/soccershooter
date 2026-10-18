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

export interface PointerButtonState {
  primaryDown: boolean;
  secondaryDown: boolean;
}

export interface PointerButtonDownInput extends PointerButtonState {
  button: number;
  pointerLocked: boolean;
}

export interface PointerButtonDownResult extends PointerButtonState {
  requestPointerLock: boolean;
  actionBits: number;
}

export const DEFAULT_MOUSE_SENSITIVITY = 0.00325;

const TAU = Math.PI * 2;
const EDGE_KEY_ACTION_BITS = (
  PlayerActionBits.Pass
  | PlayerActionBits.ThroughPass
  | PlayerActionBits.LoftedPass
  | PlayerActionBits.Receive
) >>> 0;
const MODIFIABLE_PASS_EDGE_BITS = (
  PlayerActionBits.Pass
  | PlayerActionBits.ThroughPass
  | PlayerActionBits.LoftedPass
) >>> 0;

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
  if (code === 'KeyC' || code === 'KeyB') return PlayerActionBits.Tackle;
  if (code === 'KeyE') return PlayerActionBits.Pass;
  if (code === 'KeyQ') return PlayerActionBits.ThroughPass;
  if (code === 'KeyR') return PlayerActionBits.LoftedPass;
  if (code === 'KeyF') return PlayerActionBits.Receive;
  return 0;
}

function heldTechniqueModifierBits(keys: ReadonlySet<string>, secondaryDown: boolean): number {
  let actionBits = 0;
  if (secondaryDown) actionBits |= PlayerActionBits.Precision;
  if (pressed(keys, 'ControlLeft', 'ControlRight')) actionBits |= PlayerActionBits.ChipModifier;
  return actionBits >>> 0;
}

export function pointerStateToActionBits(primaryDown: boolean, secondaryDown: boolean): number {
  let actionBits = 0;
  if (primaryDown) actionBits |= PlayerActionBits.ShootHeld;
  if (secondaryDown) actionBits |= PlayerActionBits.Precision;
  return actionBits >>> 0;
}

/**
 * Pointer-lock acquisition is a camera-mode transition, not a football action.
 * The gesture that enters mouse-look is therefore swallowed completely. Only
 * presses made while already locked can become shoot/close-control input.
 */
export function resolvePointerButtonDown(input: Readonly<PointerButtonDownInput>): PointerButtonDownResult {
  if (!input.pointerLocked) {
    return {
      primaryDown: false,
      secondaryDown: false,
      requestPointerLock: true,
      actionBits: 0,
    };
  }

  const primaryDown = input.primaryDown || input.button === 0;
  const secondaryDown = input.secondaryDown || input.button === 2;
  return {
    primaryDown,
    secondaryDown,
    requestPointerLock: false,
    actionBits: pointerStateToActionBits(primaryDown, secondaryDown),
  };
}

/** Backward-compatible helper for already-captured pointer button state. */
export function applyPointerButtonDown(
  primaryDown: boolean,
  secondaryDown: boolean,
  button: number,
): PointerButtonState {
  const result = resolvePointerButtonDown({ primaryDown, secondaryDown, button, pointerLocked: true });
  return { primaryDown: result.primaryDown, secondaryDown: result.secondaryDown };
}

export function keyboardStateToIntent(sample: Readonly<KeyboardIntentSample>): InputIntent {
  const rawX = Number(pressed(sample.keys, 'KeyD', 'ArrowRight')) - Number(pressed(sample.keys, 'KeyA', 'ArrowLeft'));
  const rawY = Number(pressed(sample.keys, 'KeyW', 'ArrowUp')) - Number(pressed(sample.keys, 'KeyS', 'ArrowDown'));
  const move = normalizeMoveAxes(rawX, rawY);
  let actionBits = 0;
  if (pressed(sample.keys, 'Space')) actionBits |= PlayerActionBits.Jump;
  if (pressed(sample.keys, 'KeyC', 'KeyB')) actionBits |= PlayerActionBits.Tackle;
  if (pressed(sample.keys, 'KeyE')) actionBits |= PlayerActionBits.Pass;
  if (pressed(sample.keys, 'KeyQ')) actionBits |= PlayerActionBits.ThroughPass;
  if (pressed(sample.keys, 'KeyR')) actionBits |= PlayerActionBits.LoftedPass;
  if (pressed(sample.keys, 'KeyF')) actionBits |= PlayerActionBits.Receive;
  if (pressed(sample.keys, 'ControlLeft', 'ControlRight')) actionBits |= PlayerActionBits.ChipModifier;
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
  #shotModifierBits = 0;
  #lastInputTimestamp: number | null = null;
  #attached = false;

  readonly #onKeyDown = (event: KeyboardEvent) => {
    this.#keys.add(event.code);
    this.#lastInputTimestamp = performance.now();
    if (!event.repeat) {
      const edgeBits = actionBitsForCode(event.code);
      this.#pendingActionBits |= edgeBits;
      if ((edgeBits & MODIFIABLE_PASS_EDGE_BITS) !== 0) {
        this.#pendingActionBits |= heldTechniqueModifierBits(this.#keys, this.#secondaryDown);
      }
    }
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
    this.#shotModifierBits = 0;
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

  /**
   * Mouse button chords intentionally use mousedown/mouseup instead of
   * pointerdown/pointerup. Pointer events only fire pointerdown on the first
   * pressed mouse button and pointerup on the last released button, which
   * makes RMB+LMB impossible to observe reliably. Mouse events fire once for
   * every individual button transition, so close-control + shot chords are
   * deterministic while pointer movement can still use Pointer Events.
   */
  readonly #onMouseDown = (event: MouseEvent) => {
    const result = resolvePointerButtonDown({
      primaryDown: this.#primaryDown,
      secondaryDown: this.#secondaryDown,
      button: event.button,
      pointerLocked: document.pointerLockElement === this.#pointerTarget,
    });
    this.#lastInputTimestamp = performance.now();
    if (event.button === 2) event.preventDefault();

    if (result.requestPointerLock) {
      this.#primaryDown = false;
      this.#secondaryDown = false;
      this.#shotModifierBits = 0;
      void this.#pointerTarget.requestPointerLock();
      return;
    }

    this.#primaryDown = result.primaryDown;
    this.#secondaryDown = result.secondaryDown;
    if (event.button === 0) {
      this.#shotModifierBits = heldTechniqueModifierBits(this.#keys, result.secondaryDown);
      this.#pendingActionBits |= this.#shotModifierBits;
    }
  };

  readonly #onMouseUp = (event: MouseEvent) => {
    if (event.button === 0 && this.#primaryDown) {
      this.#primaryDown = false;
      this.#pendingActionBits |= PlayerActionBits.ShootReleased | this.#shotModifierBits;
      this.#shotModifierBits = 0;
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
    this.#keyboardTarget.addEventListener('mouseup', this.#onMouseUp);
    this.#pointerTarget.addEventListener('mousedown', this.#onMouseDown);
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
    this.#keyboardTarget.removeEventListener('mouseup', this.#onMouseUp);
    this.#pointerTarget.removeEventListener('mousedown', this.#onMouseDown);
    this.#pointerTarget.removeEventListener('wheel', this.#onWheel);
    this.#pointerTarget.removeEventListener('contextmenu', this.#onContextMenu);
    this.#keys.clear();
    this.#pendingActionBits = 0;
    this.#pendingZoomDelta = 0;
    this.#primaryDown = false;
    this.#secondaryDown = false;
    this.#shotModifierBits = 0;
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
    // Dedicated football actions are edge-triggered even though the pure mapper
    // exposes their held state for tests/remapping UIs.
    intent.actionBits &= ~EDGE_KEY_ACTION_BITS;
    intent.actionBits = (
      intent.actionBits
      | this.#pendingActionBits
      | pointerStateToActionBits(this.#primaryDown, this.#secondaryDown)
      | (this.#primaryDown ? this.#shotModifierBits : 0)
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
