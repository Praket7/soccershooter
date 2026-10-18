import type { InputIntent } from '@soccershooter/sim';
import type { ActionFrame, LookDelta } from './ActionMap';
import { shapeFootballMovementIntent } from './FootballControl';
import type { GamepadFrame } from './GamepadAdapter';

export interface MergedInputFrame extends ActionFrame {}

const AXIS_EPSILON = 1e-4;
const LOOK_EPSILON = 1e-9;

export function mergeInputSources(
  keyboard: Readonly<ActionFrame>,
  gamepad: Readonly<GamepadFrame> | null,
  bufferedActionBits = 0,
): MergedInputFrame {
  const keyboardBits = (keyboard.intent.actionBits | bufferedActionBits) >>> 0;
  if (!gamepad) {
    const intent = shapeFootballMovementIntent({ ...keyboard.intent, actionBits: keyboardBits });
    return {
      intent,
      look: { ...keyboard.look },
      inputTimestamp: keyboard.inputTimestamp,
      zoomDelta: keyboard.zoomDelta,
    };
  }

  const gamepadMoving = Math.hypot(gamepad.intent.moveX, gamepad.intent.moveY) > AXIS_EPSILON;
  const gamepadLooking = Math.abs(gamepad.look.yawDelta) + Math.abs(gamepad.look.pitchDelta) > LOOK_EPSILON;
  const look: LookDelta = {
    yawDelta: keyboard.look.yawDelta + gamepad.look.yawDelta,
    pitchDelta: keyboard.look.pitchDelta + gamepad.look.pitchDelta,
  };
  const intent: InputIntent = shapeFootballMovementIntent({
    moveX: gamepadMoving ? gamepad.intent.moveX : keyboard.intent.moveX,
    moveY: gamepadMoving ? gamepad.intent.moveY : keyboard.intent.moveY,
    aimYaw: gamepadLooking ? gamepad.intent.aimYaw : keyboard.intent.aimYaw,
    sprint: keyboard.intent.sprint || gamepad.intent.sprint,
    actionBits: (keyboardBits | gamepad.intent.actionBits) >>> 0,
  });

  return {
    intent,
    look,
    inputTimestamp: keyboard.inputTimestamp,
    zoomDelta: keyboard.zoomDelta,
  };
}
