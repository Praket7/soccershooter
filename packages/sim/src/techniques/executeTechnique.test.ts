import { describe, expect, it } from 'vitest';
import { TECHNIQUE_BY_ID } from '@soccershooter/content/techniques/catalog';
import { createTechniqueState, executeTechnique, interruptTechnique } from './executeTechnique';

const context = { tick: 100, speed: 4, pressure: 0.2, ballDistance: 0.35, grounded: true, stamina: 80, actionBits: 1 << 6 };

describe('deterministic technique execution', () => {
  it('rejects ineligible input without charging stamina or starting cooldown', () => {
    const result = executeTechnique(TECHNIQUE_BY_ID.get('roulette')!, createTechniqueState(80), { ...context, speed: 0.1 });
    expect(result.status).toBe('ineligible');
    expect(result.state.stamina).toBe(80);
    expect(result.state.cooldownUntilTick).toBe(0);
  });

  it('spends authoritative cost once and emits a bounded planned contact', () => {
    const first = executeTechnique(TECHNIQUE_BY_ID.get('stepover')!, createTechniqueState(), context);
    const replay = executeTechnique(TECHNIQUE_BY_ID.get('stepover')!, createTechniqueState(), context);
    expect(first).toEqual(replay);
    expect(first.status).toBe('windup');
    expect(first.state.stamina).toBeLessThan(80);
    expect(first.contact?.maxImpulse).toBeLessThanOrEqual(15);
    expect(executeTechnique(TECHNIQUE_BY_ID.get('stepover')!, first.state, { ...context, tick: 101 }).status).toBe('recovery');
  });

  it('interruption enters recovery and exposes the declared counter window', () => {
    const started = executeTechnique(TECHNIQUE_BY_ID.get('power-strike')!, createTechniqueState(), context);
    const interrupted = interruptTechnique(TECHNIQUE_BY_ID.get('power-strike')!, started.state, 102);
    expect(interrupted.status).toBe('interrupted');
    expect(interrupted.state.recoveryUntilTick).toBeGreaterThan(102);
    expect(interrupted.counterUntilTick).toBe(started.contact!.counterUntilTick);
  });
});
