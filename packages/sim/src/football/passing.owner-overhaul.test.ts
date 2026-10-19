import { describe, expect, test } from 'vitest';
import { selectPassTarget } from './passing';

const candidates = [
  { id: 'ahead', position: { x: 0.7, y: 0, z: 8 }, velocity: { x: 1, y: 0, z: 0.2 }, laneOpenness: 0.9 },
  { id: 'wide', position: { x: 7, y: 0, z: 3 }, velocity: { x: 0, y: 0, z: 0.5 }, laneOpenness: 1 },
] as const;

describe('aim-first pass targeting', () => {
  test('candidate outside the aim cone cannot steal selection', () => {
    const selected = selectPassTarget({
      origin: { x: 0, y: 0, z: 0 },
      userAim: { x: 0, z: 1 },
      candidates,
      aimConeDegrees: 32,
    });
    expect(selected?.receiver.id).toBe('ahead');
  });

  test('clear open-space intent can deliberately select nobody', () => {
    const selected = selectPassTarget({
      origin: { x: 0, y: 0, z: 0 },
      userAim: { x: -1, z: 0 },
      candidates,
      aimConeDegrees: 28,
    });
    expect(selected).toBeNull();
  });

  test('blocked lanes lose quality even when angle is similar', () => {
    const selected = selectPassTarget({
      origin: { x: 0, y: 0, z: 0 },
      userAim: { x: 0, z: 1 },
      candidates: [
        { id: 'blocked', position: { x: 0.1, y: 0, z: 7 }, velocity: { x: 0, y: 0, z: 0 }, laneOpenness: 0.05 },
        { id: 'clear', position: { x: 1.2, y: 0, z: 7 }, velocity: { x: 0, y: 0, z: 0 }, laneOpenness: 0.95 },
      ],
      aimConeDegrees: 32,
    });
    expect(selected?.receiver.id).toBe('clear');
    expect(selected?.leadPoint.z).toBeGreaterThan(6);
  });
});
