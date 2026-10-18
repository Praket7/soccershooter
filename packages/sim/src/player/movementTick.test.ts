import { describe, expect, test } from 'vitest';
import { PLAYER_MOVEMENT_TICK_HZ } from './movement';

describe('Stage 03 responsiveness budget', () => {
  test('authoritative player movement can accept new intent within one 60 Hz frame', () => {
    expect(PLAYER_MOVEMENT_TICK_HZ).toBeGreaterThanOrEqual(60);
    expect(1000 / PLAYER_MOVEMENT_TICK_HZ).toBeLessThanOrEqual(1000 / 60);
  });
});
