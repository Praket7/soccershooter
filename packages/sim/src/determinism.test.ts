import { describe, expect, test } from 'vitest';
import {
  createSimulation,
  getSimulationTick,
  hashSimulationState,
  serializeInputTrace,
  stepSimulation,
  type InputIntent,
  type InputTraceFrame,
} from './index';
import { createFixedStepRunner } from './fixedStep';

const NEUTRAL: InputIntent = {
  moveX: 0,
  moveY: 0,
  aimYaw: 0,
  sprint: false,
  actionBits: 0,
};

function intentFor(tick: number, salt: number): InputIntent {
  const phase = (tick + salt) % 17;
  return {
    moveX: ((phase % 5) - 2) / 2,
    moveY: (((phase * 3) % 5) - 2) / 2,
    aimYaw: ((tick * 0.013 + salt * 0.17) % (Math.PI * 2)) - Math.PI,
    sprint: (tick + salt) % 7 < 3,
    actionBits: ((tick + salt) % 8) | 0,
  };
}

function inputsAtTick(tick: number): ReadonlyMap<string, InputIntent> {
  return new Map([
    ['alpha', intentFor(tick, 1)],
    ['bravo', intentFor(tick, 9)],
  ]);
}

function run(seed: number, ticks: number): string {
  const sim = createSimulation({ tickHz: 30, seed });
  for (let tick = 0; tick < ticks; tick += 1) {
    stepSimulation(sim, inputsAtTick(tick));
  }
  expect(getSimulationTick(sim)).toBe(ticks);
  return hashSimulationState(sim);
}

describe('deterministic simulation shell', () => {
  test('same seed and ordered inputs produce identical hash after 10,000 ticks', () => {
    expect(run(0x51cce7, 10_000)).toBe(run(0x51cce7, 10_000));
  });

  test('100 repeated 10,000-tick runs match the baseline hash', () => {
    const baseline = run(0x1234abcd, 10_000);
    for (let iteration = 0; iteration < 100; iteration += 1) {
      expect(run(0x1234abcd, 10_000), `iteration ${iteration}`).toBe(baseline);
    }
  }, 30_000);

  test('seed participates in authoritative state', () => {
    expect(run(111, 300)).not.toBe(run(222, 300));
  });

  test('stable input serialization ignores Map insertion order', () => {
    const a: InputTraceFrame[] = [
      { tick: 3, inputs: new Map([['bravo', NEUTRAL], ['alpha', intentFor(3, 1)]]) },
      { tick: 1, inputs: new Map([['alpha', intentFor(1, 1)], ['bravo', NEUTRAL]]) },
    ];
    const b: InputTraceFrame[] = [
      { tick: 1, inputs: new Map([['bravo', NEUTRAL], ['alpha', intentFor(1, 1)]]) },
      { tick: 3, inputs: new Map([['alpha', intentFor(3, 1)], ['bravo', NEUTRAL]]) },
    ];
    expect(serializeInputTrace(a)).toBe(serializeInputTrace(b));
  });
});

describe('fixed-step presentation accumulator', () => {
  function runPresented(presentationHz: number): { hash: string; ticks: number } {
    const sim = createSimulation({ tickHz: 30, seed: 0xc0ffee });
    const runner = createFixedStepRunner(sim, (tick) => inputsAtTick(tick), {
      maxCatchUpSteps: 8,
    });

    const frameCount = presentationHz * 10;
    const delta = 1 / presentationHz;
    for (let frame = 0; frame < frameCount; frame += 1) {
      runner.advance(delta);
    }

    return { hash: hashSimulationState(sim), ticks: getSimulationTick(sim) };
  }

  test('60, 120, and 144 Hz presentation cadences do not alter final simulation state', () => {
    const at60 = runPresented(60);
    const at120 = runPresented(120);
    const at144 = runPresented(144);

    expect(at60.ticks).toBe(300);
    expect(at120.ticks).toBe(300);
    expect(at144.ticks).toBe(300);
    expect(at120.hash).toBe(at60.hash);
    expect(at144.hash).toBe(at60.hash);
  });

  test('spiral cap is visible and retains backlog instead of silently dropping simulation time', () => {
    const sim = createSimulation({ tickHz: 30, seed: 9 });
    const runner = createFixedStepRunner(sim, () => new Map(), { maxCatchUpSteps: 5 });

    const first = runner.advance(1);
    expect(first.steps).toBe(5);
    expect(first.capped).toBe(true);
    expect(first.capCount).toBe(1);
    expect(first.backlogSeconds).toBeGreaterThan(0.8);
    expect(getSimulationTick(sim)).toBe(5);

    for (let i = 0; i < 5; i += 1) runner.advance(0);
    expect(getSimulationTick(sim)).toBe(30);
    expect(runner.getDiagnostics().backlogSeconds).toBeLessThan(1 / 30);
  });
});
