import { describe, expect, it } from 'vitest';
import { runTechniqueTournament } from './techniqueTournament';

describe('technique balance tournament', () => {
  it('is seed-replay deterministic and reports no dominant single technique', () => {
    const result = runTechniqueTournament(0x8a11ce, 256);
    expect(runTechniqueTournament(0x8a11ce, 256)).toEqual(result);
    expect(result.rows.length).toBeGreaterThanOrEqual(12);
    expect(result.rows.every((row) => row.eligible > 0 && row.share >= 0)).toBe(true);
    expect(result.dominantTechniqueShare).toBeLessThan(0.16);
  });
});
