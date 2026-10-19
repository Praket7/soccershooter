import { describe, expect, it } from 'vitest';
import { TECHNIQUE_BY_ID } from '@soccershooter/content/techniques/catalog';
import * as techniqueExecution from './executeTechnique';
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

  it('requires aerial techniques to be airborne rather than grounded', () => {
    const volley = TECHNIQUE_BY_ID.get('volley')!;
    const grounded = executeTechnique(volley, createTechniqueState(), { ...context, grounded: true });
    const airborne = executeTechnique(volley, createTechniqueState(), { ...context, grounded: false });
    expect(grounded.status).toBe('ineligible');
    expect(grounded.reason).toBe('airborne-technique-required');
    expect(airborne.status).toBe('windup');
  });

  it('carries declarative launch and spin geometry into the authoritative contact intent', () => {
    const rainbow = executeTechnique(TECHNIQUE_BY_ID.get('rainbow')!, createTechniqueState(), context).contact as unknown as Record<string, unknown>;
    const lofted = executeTechnique(TECHNIQUE_BY_ID.get('lofted-through')!, createTechniqueState(), context).contact as unknown as Record<string, unknown>;
    const knuckle = executeTechnique(TECHNIQUE_BY_ID.get('knuckle-strike')!, createTechniqueState(), context).contact as unknown as Record<string, unknown>;
    expect(Number(rainbow.launchElevationDegrees)).toBeGreaterThan(25);
    expect(Number(lofted.launchElevationDegrees)).toBeGreaterThan(18);
    expect(knuckle.spinAxis).toBe('none');
  });

  it('rotates top and back spin axes with the horizontal shot direction', () => {
    const powerContact = executeTechnique(TECHNIQUE_BY_ID.get('power-strike')!, createTechniqueState(), context).contact!;
    const loftedContact = executeTechnique(TECHNIQUE_BY_ID.get('lofted-through')!, createTechniqueState(), context).contact!;
    const powerRight = techniqueExecution.resolveTechniqueContactKinematics(powerContact, { x: 1, z: 0 });
    const loftedRight = techniqueExecution.resolveTechniqueContactKinematics(loftedContact, { x: 1, z: 0 });

    expect(Math.abs(powerRight.angularVelocity.x)).toBeLessThan(1e-9);
    expect(powerRight.angularVelocity.z).toBeLessThan(-5);
    expect(Math.abs(loftedRight.angularVelocity.x)).toBeLessThan(1e-9);
    expect(loftedRight.angularVelocity.z).toBeGreaterThan(20);
  });

  it('resolves physically distinct technique kinematics while preserving the requested aim direction', () => {
    const resolver = techniqueExecution.resolveTechniqueContactKinematics;
    const rainbowContact = executeTechnique(TECHNIQUE_BY_ID.get('rainbow')!, createTechniqueState(), context).contact!;
    const bodyContact = executeTechnique(TECHNIQUE_BY_ID.get('body-feint')!, createTechniqueState(), context).contact!;
    const finesseContact = executeTechnique(TECHNIQUE_BY_ID.get('finesse-curl')!, createTechniqueState(), context).contact!;
    const powerContact = executeTechnique(TECHNIQUE_BY_ID.get('power-strike')!, createTechniqueState(), context).contact!;
    const knuckleContact = executeTechnique(TECHNIQUE_BY_ID.get('knuckle-strike')!, createTechniqueState(), context).contact!;
    const rainbow = resolver(rainbowContact, { x: 0.6, z: 0.8 });
    const body = resolver(bodyContact, { x: 0.6, z: 0.8 });
    const finesse = resolver(finesseContact, { x: 0, z: 1 });
    const power = resolver(powerContact, { x: 0, z: 1 });
    const knuckle = resolver(knuckleContact, { x: 0, z: 1 });
    expect(rainbow.targetVelocity.y).toBeGreaterThan(2.5);
    expect(Math.hypot(rainbow.targetVelocity.x, rainbow.targetVelocity.z)).toBeGreaterThan(Math.hypot(body.targetVelocity.x, body.targetVelocity.z));
    expect(power.targetSpeed).toBeGreaterThan(finesse.targetSpeed);
    expect(Math.hypot(finesse.angularVelocity.x, finesse.angularVelocity.y, finesse.angularVelocity.z)).toBeGreaterThan(40);
    expect(Math.hypot(knuckle.angularVelocity.x, knuckle.angularVelocity.y, knuckle.angularVelocity.z)).toBeLessThan(6);
    expect(rainbow.targetVelocity.x / rainbow.targetVelocity.z).toBeCloseTo(0.6 / 0.8, 6);
  });
});
