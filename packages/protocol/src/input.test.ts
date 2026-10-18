import { describe, expect, test } from 'vitest';
import { sanitizeInputIntent } from './input';

const valid = {
  moveX: 0.25,
  moveY: -0.5,
  aimYaw: 0.75,
  sprint: true,
  actionBits: 3,
};

describe('input protocol boundary', () => {
  test('accepts and normalizes a valid intent', () => {
    expect(sanitizeInputIntent(valid)).toEqual(valid);
  });

  test('clamps movement components to [-1, 1]', () => {
    expect(sanitizeInputIntent({ ...valid, moveX: 5, moveY: -3 })).toMatchObject({
      moveX: 1,
      moveY: -1,
    });
  });

  test('normalizes aim yaw to [-pi, pi)', () => {
    const intent = sanitizeInputIntent({ ...valid, aimYaw: Math.PI * 5 });
    expect(intent.aimYaw).toBeGreaterThanOrEqual(-Math.PI);
    expect(intent.aimYaw).toBeLessThan(Math.PI);
    expect(intent.aimYaw).toBeCloseTo(-Math.PI, 12);
  });

  test.each([
    [{ ...valid, moveX: Number.NaN }, 'moveX'],
    [{ ...valid, moveY: Number.POSITIVE_INFINITY }, 'moveY'],
    [{ ...valid, aimYaw: Number.NEGATIVE_INFINITY }, 'aimYaw'],
    [{ ...valid, sprint: 1 }, 'sprint'],
    [{ ...valid, actionBits: -1 }, 'actionBits'],
    [{ ...valid, actionBits: 1.5 }, 'actionBits'],
    [{ ...valid, actionBits: 0x1_0000_0000 }, 'actionBits'],
  ])('rejects malformed field %s', (candidate, field) => {
    expect(() => sanitizeInputIntent(candidate)).toThrow(new RegExp(String(field), 'i'));
  });

  test('rejects missing required fields', () => {
    const { aimYaw: _removed, ...candidate } = valid;
    expect(() => sanitizeInputIntent(candidate)).toThrow(/aimYaw/i);
  });

  test('rejects unexpected fields instead of accepting protocol drift', () => {
    expect(() => sanitizeInputIntent({ ...valid, clientScore: 99 })).toThrow(/clientScore|unexpected/i);
  });
});
