import { createStrikeContactPlan, stepStrikeContact } from '../../packages/sim/src/football/strikePlanner';
import type { FootballBallSnapshot, FootballVec3 } from '../../packages/sim/src/football/types';

const PHASES = Array.from({ length: 10 }, (_, index) => index / 10);
const STRIDE_SECONDS = [0.46, 0.58] as const;
const TICK = 120;
const ACTOR: FootballVec3 = { x: 0, y: 0, z: 0 };
const BALL: FootballBallSnapshot = {
  position: { x: 0.1, y: 0.11, z: 0.42 },
  velocity: { x: 0, y: 0, z: 0 },
  angularVelocity: { x: 0, y: 0, z: 0 },
  radius: 0.11,
  mass: 0.436,
  grounded: true,
};

interface TransitionSummary {
  samples: number;
  contactDelayTicks: { min: number; p50: number; p90: number; max: number };
  legalContactRate: number;
}

function percentile(values: readonly number[], fraction: number): number {
  const ordered = [...values].sort((a, b) => a - b);
  return ordered[Math.min(ordered.length - 1, Math.floor((ordered.length - 1) * fraction))]!;
}

function summarizeDelays(delays: readonly number[]): TransitionSummary {
  if (delays.length === 0) throw new Error('transition calibration produced no contact plans');
  return {
    samples: delays.length,
    contactDelayTicks: {
      min: Math.min(...delays),
      p50: percentile(delays, 0.5),
      p90: percentile(delays, 0.9),
      max: Math.max(...delays),
    },
    legalContactRate: 1,
  };
}

/** Measures request-to-contact timing from the same gait-aware planner used by live practice. */
export function runStrikeTransitionCalibration(): {
  version: 1;
  tickRateHz: 60;
  gaitPhases: number;
  strideDurationsSeconds: readonly number[];
  transitions: { shot: TransitionSummary; pass: TransitionSummary };
} {
  const delays: Record<'shot' | 'pass', number[]> = { shot: [], pass: [] };
  for (const kind of ['shot', 'pass'] as const) {
    for (const strideSeconds of STRIDE_SECONDS) {
      for (const gaitPhase of PHASES) {
        const plan = createStrikeContactPlan({
          kind,
          sourceId: `stage-05r-${kind}-${strideSeconds}-${gaitPhase}`,
          tick: TICK,
          gaitPhase,
          strideSeconds,
          actorPosition: ACTOR,
          ball: BALL,
          targetBallVelocity: kind === 'shot' ? { x: 0, y: 3, z: 22 } : { x: 1, y: 0, z: 9 },
          preferredFoot: 'right',
          balance: 1,
        });
        if (!plan) throw new Error(`no viable ${kind} contact at phase ${gaitPhase}`);
        const contact = stepStrikeContact(plan, plan.contactTick, plan.expectedFootPoint, {
          ...BALL,
          position: { ...plan.expectedBallPoint },
        });
        if (contact.status !== 'contact') throw new Error(`${kind} contact failed at phase ${gaitPhase}`);
        delays[kind].push(plan.contactTick - TICK);
      }
    }
  }

  return {
    version: 1,
    tickRateHz: 60,
    gaitPhases: PHASES.length,
    strideDurationsSeconds: STRIDE_SECONDS,
    transitions: {
      shot: summarizeDelays(delays.shot),
      pass: summarizeDelays(delays.pass),
    },
  };
}

if (process.argv[1]?.endsWith('strike-transition-calibration.ts')) {
  process.stdout.write(`${JSON.stringify(runStrikeTransitionCalibration(), null, 2)}\n`);
}
