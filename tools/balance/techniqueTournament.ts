import { TECHNIQUES } from '../../packages/content/src/techniques/catalog';
import { createTechniqueState, executeTechnique } from '../../packages/sim/src/techniques/executeTechnique';

export interface TechniqueTournamentRow {
  id: string;
  attempts: number;
  eligible: number;
  contribution: number;
  share: number;
}

export interface TechniqueTournamentResult {
  seed: number;
  trialsPerTechnique: number;
  rows: TechniqueTournamentRow[];
  dominantTechniqueShare: number;
}

/** Deterministic comparative balance proxy; scores usable, counterable contacts per stamina/cooldown. */
export function runTechniqueTournament(seed = 0x8a11ce, trialsPerTechnique = 512): TechniqueTournamentResult {
  if (!Number.isSafeInteger(seed) || seed < 0) throw new RangeError('seed must be a non-negative integer');
  if (!Number.isSafeInteger(trialsPerTechnique) || trialsPerTechnique < 1) throw new RangeError('trialsPerTechnique must be positive');
  const rows = TECHNIQUES.map((technique) => {
    let eligible = 0;
    let contribution = 0;
    for (let trial = 0; trial < trialsPerTechnique; trial += 1) {
      const pressure = ((trial * 37 + seed) % 101) / 100;
      const speed = ((trial * 13 + seed) % 91) / 10;
      const result = executeTechnique(technique, createTechniqueState(), {
        tick: trial * 120,
        speed,
        pressure,
        ballDistance: ((trial * 7 + seed) % 76) / 100,
        grounded: technique.family !== 'aerial' || trial % 2 === 0,
        stamina: 100,
        actionBits: 1 << 6,
      });
      if (!result.contact) continue;
      eligible += 1;
      const counterTax = technique.counter.vulnerable ? 1 / (1 + technique.counter.windowTicks / 12) : 1;
      contribution += result.contact.impulseScale * result.contact.maxImpulse * counterTax
        * (technique.movement.preserveSteering ? 1 : 0.8)
        / (1 + technique.cost.stamina / 12 + technique.cost.cooldownTicks / 96);
    }
    return { id: technique.id, attempts: trialsPerTechnique, eligible, contribution, share: 0 };
  });
  const total = rows.reduce((sum, row) => sum + row.contribution, 0);
  for (const row of rows) row.share = total > 0 ? row.contribution / total : 0;
  rows.sort((a, b) => b.share - a.share || a.id.localeCompare(b.id));
  return {
    seed,
    trialsPerTechnique,
    rows,
    dominantTechniqueShare: rows[0]?.share ?? 0,
  };
}

if (process.argv[1]?.endsWith('techniqueTournament.ts')) {
  const result = runTechniqueTournament();
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}
