import { describe, expect, test } from 'vitest';
import { runBallFuzz } from './ball-fuzz';

describe('Stage 04 deterministic ball fuzz harness', () => {
  test('is deterministic and keeps legal random launches finite and bounded', () => {
    const first = runBallFuzz({ launches: 2500, seed: 0x4ba11, substepsPerLaunch: 12 });
    const second = runBallFuzz({ launches: 2500, seed: 0x4ba11, substepsPerLaunch: 12 });
    expect(first.failures).toBe(0);
    expect(first.checksum).toBe(second.checksum);
    expect(first.launches).toBe(2500);
    expect(first.maxSpeedObserved).toBeLessThan(70);
    // Turf contact can legitimately convert linear speed into angular speed.
    // 450 rad/s remains above the no-slip rate of a 45 m/s legal launch (v/r ≈ 409 rad/s)
    // while still catching numerical spin explosions.
    expect(first.maxSpinObserved).toBeLessThan(450);
  });
});
