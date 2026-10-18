import { getSimulationTick, stepSimulation, type InputIntent, type SimTick, type Simulation } from './index';

export interface FixedStepRunnerOptions {
  maxCatchUpSteps?: number;
}

export interface FixedStepDiagnostics {
  steps: number;
  capped: boolean;
  capCount: number;
  backlogSeconds: number;
  interpolationAlpha: number;
  simTick: SimTick;
}

export interface FixedStepRunner {
  advance(deltaSeconds: number): FixedStepDiagnostics;
  getDiagnostics(): FixedStepDiagnostics;
}

const DEFAULT_MAX_CATCH_UP_STEPS = 8;
const EPSILON_SECONDS = 1e-12;

export function createFixedStepRunner(
  sim: Simulation,
  inputProvider: (tick: SimTick) => ReadonlyMap<string, InputIntent>,
  options: FixedStepRunnerOptions = {},
): FixedStepRunner {
  const maxCatchUpSteps = options.maxCatchUpSteps ?? DEFAULT_MAX_CATCH_UP_STEPS;
  if (!Number.isSafeInteger(maxCatchUpSteps) || maxCatchUpSteps <= 0) {
    throw new RangeError('maxCatchUpSteps must be a positive safe integer');
  }

  const fixedDelta = 1 / sim.config.tickHz;
  let accumulator = 0;
  let capCount = 0;
  let last: FixedStepDiagnostics = {
    steps: 0,
    capped: false,
    capCount: 0,
    backlogSeconds: 0,
    interpolationAlpha: 0,
    simTick: getSimulationTick(sim),
  };

  function diagnostics(steps: number, capped: boolean): FixedStepDiagnostics {
    return {
      steps,
      capped,
      capCount,
      backlogSeconds: Math.max(0, accumulator),
      interpolationAlpha: Math.max(0, Math.min(1, accumulator / fixedDelta)),
      simTick: getSimulationTick(sim),
    };
  }

  return {
    advance(deltaSeconds: number): FixedStepDiagnostics {
      if (!Number.isFinite(deltaSeconds) || deltaSeconds < 0) {
        throw new RangeError('deltaSeconds must be a non-negative finite number');
      }
      accumulator += deltaSeconds;
      let steps = 0;

      while (accumulator + EPSILON_SECONDS >= fixedDelta && steps < maxCatchUpSteps) {
        const tick = getSimulationTick(sim);
        stepSimulation(sim, inputProvider(tick));
        accumulator -= fixedDelta;
        if (Math.abs(accumulator) < EPSILON_SECONDS) accumulator = 0;
        steps += 1;
      }

      const capped = accumulator + EPSILON_SECONDS >= fixedDelta;
      if (capped) capCount += 1;
      last = diagnostics(steps, capped);
      return last;
    },

    getDiagnostics(): FixedStepDiagnostics {
      return { ...last, backlogSeconds: Math.max(0, accumulator), simTick: getSimulationTick(sim) };
    },
  };
}
