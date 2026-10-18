import type { InputIntent } from '../../sim/src/index';

const REQUIRED_KEYS = ['moveX', 'moveY', 'aimYaw', 'sprint', 'actionBits'] as const;
const REQUIRED_KEY_SET = new Set<string>(REQUIRED_KEYS);
const TAU = Math.PI * 2;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function finiteNumber(value: unknown, field: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new TypeError(`${field} must be a finite number`);
  }
  return value;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function normalizeYaw(value: number): number {
  const wrapped = ((value + Math.PI) % TAU + TAU) % TAU - Math.PI;
  return Object.is(wrapped, -0) ? 0 : wrapped;
}

export function sanitizeInputIntent(value: unknown): InputIntent {
  if (!isRecord(value)) throw new TypeError('input intent must be an object');

  for (const key of Object.keys(value)) {
    if (!REQUIRED_KEY_SET.has(key)) throw new TypeError(`unexpected input field: ${key}`);
  }
  for (const key of REQUIRED_KEYS) {
    if (!(key in value)) throw new TypeError(`${key} is required`);
  }

  const moveX = clamp(finiteNumber(value.moveX, 'moveX'), -1, 1);
  const moveY = clamp(finiteNumber(value.moveY, 'moveY'), -1, 1);
  const aimYaw = normalizeYaw(finiteNumber(value.aimYaw, 'aimYaw'));

  if (typeof value.sprint !== 'boolean') throw new TypeError('sprint must be boolean');
  if (
    typeof value.actionBits !== 'number' ||
    !Number.isSafeInteger(value.actionBits) ||
    value.actionBits < 0 ||
    value.actionBits > 0xffff_ffff
  ) {
    throw new RangeError('actionBits must be an unsigned 32-bit integer');
  }

  return {
    moveX,
    moveY,
    aimYaw,
    sprint: value.sprint,
    actionBits: value.actionBits >>> 0,
  };
}
