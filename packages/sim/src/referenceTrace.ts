import {
  createSimulation,
  getSimulationTick,
  hashSimulationState,
  stepSimulation,
  type InputIntent,
} from './index';

export const REFERENCE_TRACE_SEED = 0x5a17c0de;
export const REFERENCE_TRACE_TICKS = 10_000;

export function referenceInputAtTick(tick: number): ReadonlyMap<string, InputIntent> {
  const make = (salt: number): InputIntent => {
    const phase = (tick + salt) % 23;
    return {
      moveX: ((phase % 7) - 3) / 3,
      moveY: (((phase * 5) % 7) - 3) / 3,
      aimYaw: ((tick * 0.0091 + salt * 0.117) % (Math.PI * 2)) - Math.PI,
      sprint: (tick + salt) % 11 < 4,
      actionBits: ((tick * (salt + 1)) ^ (tick >>> 3)) & 0xff,
    };
  };

  return new Map([
    ['alpha', make(2)],
    ['bravo', make(11)],
    ['charlie', make(19)],
  ]);
}

export function runReferenceTrace(
  ticks = REFERENCE_TRACE_TICKS,
  seed = REFERENCE_TRACE_SEED,
): { hash: string; ticks: number; seed: number } {
  if (!Number.isSafeInteger(ticks) || ticks <= 0) {
    throw new RangeError('ticks must be a positive safe integer');
  }

  const sim = createSimulation({ tickHz: 30, seed });
  for (let tick = 0; tick < ticks; tick += 1) {
    stepSimulation(sim, referenceInputAtTick(tick));
  }

  return {
    hash: hashSimulationState(sim),
    ticks: getSimulationTick(sim),
    seed,
  };
}
