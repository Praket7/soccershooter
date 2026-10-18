import { describe, expect, test } from 'vitest';
import { runBallFuzz } from './ball-fuzz';

describe('Stage 04 deterministic ball fuzz harness', () => {
  test('is deterministic and keeps legal random launches finite', () => {
    const first = runBallFuzz({ launches: 2500, seed: 0x4ba11, substepsPerLaunch: 12 });
    const second = runBallFuzz({ launches: 2500, seed: 0x4ba11, substepsPerLaunch: 12 });
    expect(first.failures).toBe(0);
    expect(first.checksum).toBe(second.checksum);
    expect(first.launches).toBe(2500);
    expect(first.maxSpeedObserved).toBeLessThan(70);
    expect(first.maxSpinObserved).toBeLessThanOrEqual(180);
  });
});
