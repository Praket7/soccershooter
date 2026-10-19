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

  it('does not score every named technique inside a family as a statistical clone', () => {
    const result = runTechniqueTournament(0x8a11ce, 512);
    const contribution = new Map(result.rows.map((row) => [row.id, row.contribution]));
    const distinct = (ids: string[]) => new Set(ids.map((id) => contribution.get(id)?.toFixed(6))).size;
    expect(distinct(['stepover', 'double-stepover', 'phantom-step', 'roulette', 'elastico', 'rainbow', 'body-feint'])).toBeGreaterThanOrEqual(5);
    expect(distinct(['finesse-curl', 'whipped-curl', 'impossible-angle', 'power-strike', 'thunder-strike', 'knuckle-strike', 'trivela-contact', 'lofted-through', 'threaded-ball'])).toBeGreaterThanOrEqual(6);
    expect(distinct(['volley', 'scissor', 'bicycle', 'diving-header'])).toBeGreaterThanOrEqual(3);
  });
});
