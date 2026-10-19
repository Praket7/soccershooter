import { validateTechnique, type TechniqueDefinition, type TechniqueMechanic, type TechniqueSpinAxis } from './schema';

type Eligibility = TechniqueDefinition['eligibility'];
type Cost = TechniqueDefinition['cost'];
type Timing = TechniqueDefinition['timing'];
type Movement = TechniqueDefinition['movement'];
type Contact = TechniqueDefinition['contact'];
type Counter = TechniqueDefinition['counter'];

interface TechniqueTuning {
  eligibility?: Partial<Eligibility>;
  cost?: Partial<Cost>;
  timing?: Partial<Timing>;
  movement?: Partial<Movement>;
  contact?: Partial<Omit<Contact, 'surface'>>;
  counter?: Partial<Counter>;
  mechanic?: TechniqueMechanic;
}

/**
 * Physical-unit contact profiles keep named moves distinct without changing the
 * authoritative ball laws. Shot speeds are deliberately below the 36 m/s
 * absolute solver envelope: ordinary specialist strikes sit around the
 * 20–30 m/s range, while knuckle contacts combine high speed with low spin.
 */
const TUNING: Readonly<Record<string, Readonly<TechniqueTuning>>> = Object.freeze({
  stepover: { cost: { stamina: 3, cooldownTicks: 34 }, timing: { anticipationTicks: 3, recoveryTicks: 11 }, contact: { targetSpeed: 2.9, spinAxis: 'side', spinRate: 8, impulseScale: 0.76, maxImpulse: 5.6, spinScale: 0.42 }, counter: { windowTicks: 6 } },
  'double-stepover': { cost: { stamina: 4, cooldownTicks: 42 }, timing: { anticipationTicks: 4, recoveryTicks: 14 }, contact: { targetSpeed: 3.2, spinAxis: 'side', spinRate: 11, impulseScale: 0.84, maxImpulse: 6.2, spinScale: 0.5 }, counter: { windowTicks: 8 } },
  'phantom-step': { cost: { stamina: 5, cooldownTicks: 48 }, timing: { anticipationTicks: 3, recoveryTicks: 15 }, contact: { targetSpeed: 3.7, spinAxis: 'side', spinRate: 18, impulseScale: 0.96, maxImpulse: 7.2, spinScale: 0.72 }, counter: { windowTicks: 9 } },
  roulette: { cost: { stamina: 5, cooldownTicks: 50 }, timing: { anticipationTicks: 5, recoveryTicks: 16 }, movement: { speedScale: 0.66 }, contact: { targetSpeed: 2.7, spinAxis: 'back', spinRate: 16, impulseScale: 0.72, maxImpulse: 5.7, spinScale: 0.56 }, counter: { windowTicks: 10 } },
  elastico: { cost: { stamina: 5, cooldownTicks: 46 }, timing: { anticipationTicks: 4, recoveryTicks: 15 }, contact: { targetSpeed: 4.0, spinAxis: 'side', spinRate: 24, impulseScale: 1.05, maxImpulse: 7.5, spinScale: 0.9 }, counter: { windowTicks: 9 }, mechanic: 'late-cut' },
  rainbow: { eligibility: { maximumPressure: 0.62, maximumBallDistance: 0.68 }, cost: { stamina: 7, cooldownTicks: 72 }, timing: { anticipationTicks: 7, recoveryTicks: 22 }, movement: { speedScale: 0.58 }, contact: { targetSpeed: 4.8, launchElevationDegrees: 40, spinAxis: 'back', spinRate: 20, impulseScale: 1.24, maxImpulse: 8.2, spinScale: 0.72 }, counter: { windowTicks: 14 }, mechanic: 'air-redirection' },
  'body-feint': { eligibility: { maximumPressure: 0.92 }, cost: { stamina: 2, cooldownTicks: 24 }, timing: { anticipationTicks: 2, recoveryTicks: 8 }, contact: { targetSpeed: 2.2, spinAxis: 'side', spinRate: 4, impulseScale: 0.58, maxImpulse: 4.4, spinScale: 0.24 }, counter: { windowTicks: 4 } },

  'finesse-curl': { cost: { stamina: 5, cooldownTicks: 60 }, timing: { anticipationTicks: 6, recoveryTicks: 17 }, contact: { targetSpeed: 23, launchElevationDegrees: 16.5, spinAxis: 'side', spinRate: 55, impulseScale: 1, maxImpulse: 13.5, spinScale: 1.35 }, counter: { windowTicks: 11 } },
  'whipped-curl': { cost: { stamina: 6, cooldownTicks: 66 }, timing: { anticipationTicks: 6, recoveryTicks: 18 }, contact: { targetSpeed: 24.5, launchElevationDegrees: 14, spinAxis: 'side', spinRate: 65, impulseScale: 1.06, maxImpulse: 14.3, spinScale: 1.5 }, counter: { windowTicks: 12 } },
  'impossible-angle': { eligibility: { maximumPressure: 0.74 }, cost: { stamina: 7, cooldownTicks: 74 }, timing: { anticipationTicks: 5, recoveryTicks: 21 }, contact: { targetSpeed: 22.5, launchElevationDegrees: 13, spinAxis: 'side', spinRate: 74, impulseScale: 1.02, maxImpulse: 14.1, spinScale: 1.65 }, counter: { windowTicks: 15 } },
  'power-strike': { cost: { stamina: 7, cooldownTicks: 72 }, timing: { anticipationTicks: 7, recoveryTicks: 22 }, contact: { targetSpeed: 27, launchElevationDegrees: 10, spinAxis: 'top', spinRate: 12, impulseScale: 1.18, maxImpulse: 15.5, spinScale: 0.38 }, counter: { windowTicks: 13 } },
  'thunder-strike': { eligibility: { maximumPressure: 0.7 }, cost: { stamina: 9, cooldownTicks: 86 }, timing: { anticipationTicks: 8, recoveryTicks: 27 }, contact: { targetSpeed: 30, launchElevationDegrees: 9, spinAxis: 'top', spinRate: 8, impulseScale: 1.32, maxImpulse: 15.5, spinScale: 0.28 }, counter: { windowTicks: 17 } },
  'knuckle-strike': { eligibility: { maximumPressure: 0.68 }, cost: { stamina: 8, cooldownTicks: 84 }, timing: { anticipationTicks: 8, recoveryTicks: 25 }, contact: { targetSpeed: 26, launchElevationDegrees: 10, spinAxis: 'none', spinRate: 5, impulseScale: 1.14, maxImpulse: 15.5, spinScale: 0.08 }, counter: { windowTicks: 16 } },
  'trivela-contact': { cost: { stamina: 6, cooldownTicks: 68 }, timing: { anticipationTicks: 6, recoveryTicks: 19 }, contact: { targetSpeed: 24, launchElevationDegrees: 12, spinAxis: 'side', spinRate: 62, impulseScale: 1.04, maxImpulse: 14.4, spinScale: 1.45 }, counter: { windowTicks: 13 }, mechanic: 'curl-release' },
  'lofted-through': { cost: { stamina: 4, cooldownTicks: 54 }, timing: { anticipationTicks: 5, recoveryTicks: 14 }, contact: { targetSpeed: 18, launchElevationDegrees: 28, spinAxis: 'back', spinRate: 34, impulseScale: 0.82, maxImpulse: 11.5, spinScale: 0.9 }, counter: { windowTicks: 9 } },
  'threaded-ball': { cost: { stamina: 5, cooldownTicks: 58 }, timing: { anticipationTicks: 5, recoveryTicks: 15 }, contact: { targetSpeed: 21, launchElevationDegrees: 7, spinAxis: 'top', spinRate: 11, impulseScale: 0.95, maxImpulse: 12.6, spinScale: 0.42 }, counter: { windowTicks: 10 } },

  volley: { eligibility: { minimumSpeed: 0.4, maximumPressure: 0.84, maximumBallDistance: 0.72, minimumBallHeight: 0.34, maximumBallHeight: 1.28 }, cost: { stamina: 6, cooldownTicks: 60 }, timing: { anticipationTicks: 4, recoveryTicks: 22 }, contact: { targetSpeed: 22, launchElevationDegrees: 10, spinAxis: 'top', spinRate: 24, impulseScale: 1, maxImpulse: 13.5, spinScale: 0.72 }, counter: { windowTicks: 10 } },
  scissor: { eligibility: { maximumPressure: 0.72, maximumBallDistance: 0.68, minimumBallHeight: 0.55, maximumBallHeight: 1.5 }, cost: { stamina: 8, cooldownTicks: 78 }, timing: { anticipationTicks: 7, recoveryTicks: 28 }, movement: { speedScale: 0.54 }, contact: { targetSpeed: 23, launchElevationDegrees: 15, spinAxis: 'top', spinRate: 28, impulseScale: 1.08, maxImpulse: 14, spinScale: 0.8 }, counter: { windowTicks: 15 } },
  bicycle: { eligibility: { maximumPressure: 0.62, maximumBallDistance: 0.64, minimumBallHeight: 0.75, maximumBallHeight: 1.7 }, cost: { stamina: 10, cooldownTicks: 96 }, timing: { anticipationTicks: 9, recoveryTicks: 34 }, movement: { speedScale: 0.46 }, contact: { targetSpeed: 24, launchElevationDegrees: 18, spinAxis: 'back', spinRate: 30, impulseScale: 1.12, maxImpulse: 14.5, spinScale: 0.88 }, counter: { windowTicks: 18 } },
  'diving-header': { eligibility: { maximumPressure: 0.8, maximumBallDistance: 0.7, minimumBallHeight: 0.9, maximumBallHeight: 1.8 }, cost: { stamina: 5, cooldownTicks: 62 }, timing: { anticipationTicks: 5, recoveryTicks: 26 }, contact: { targetSpeed: 15, launchElevationDegrees: 7, spinAxis: 'none', spinRate: 0, impulseScale: 0.78, maxImpulse: 9.5, spinScale: 0 }, counter: { windowTicks: 12 }, mechanic: 'air-redirection' },
});

function defaultContact(family: TechniqueDefinition['family'], surface: TechniqueDefinition['contact']['surface']): Contact {
  if (family === 'dribble') return { surface, targetSpeed: 3.2, launchElevationDegrees: 0, spinAxis: 'side', spinRate: 10, impulseScale: 0.82, maxImpulse: 6.5, spinScale: 0.5 };
  if (family === 'aerial') return { surface, targetSpeed: 20, launchElevationDegrees: 12, spinAxis: 'top', spinRate: 20, impulseScale: 0.9, maxImpulse: 12.5, spinScale: 0.7 };
  return { surface, targetSpeed: 23, launchElevationDegrees: 11, spinAxis: 'side', spinRate: 35, impulseScale: 1, maxImpulse: 14.5, spinScale: 1 };
}

function evolutionMechanic(evolution?: TechniqueDefinition['evolution']): TechniqueMechanic {
  if (!evolution || evolution.tier === 1) return 'standard';
  if (evolution.chain === 'phantom-step' && evolution.tier >= 3) return 'branching-step';
  if (evolution.chain === 'phantom-step') return 'late-cut';
  if (evolution.chain === 'whipped-curl' && evolution.tier >= 3) return 'late-cut';
  if (evolution.chain === 'whipped-curl') return 'curl-release';
  if (evolution.chain === 'thunder-strike') return 'late-plant';
  if (evolution.chain === 'threaded-ball') return 'guided-lane';
  if (evolution.chain === 'acrobat') return 'air-redirection';
  return 'standard';
}

function technique(
  id: string,
  displayName: string,
  family: TechniqueDefinition['family'],
  surface: TechniqueDefinition['contact']['surface'],
  evolution?: TechniqueDefinition['evolution'],
): TechniqueDefinition {
  const tuning = TUNING[id] ?? {};
  const defaultEligibility: Eligibility = {
    minimumSpeed: family === 'aerial' ? 1 : id === 'body-feint' ? 0 : 0.6,
    maximumSpeed: family === 'aerial' ? 8.5 : 9,
    maximumPressure: 0.82,
    maximumBallDistance: 0.76,
    minimumBallHeight: 0,
    maximumBallHeight: family === 'aerial' ? 1.8 : 0.45,
    requiresGrounded: family !== 'aerial',
  };
  const defaultCost: Cost = { stamina: family === 'aerial' ? 7 : 4, cooldownTicks: family === 'dribble' ? 48 : 72 };
  const defaultTiming: Timing = { anticipationTicks: family === 'dribble' ? 4 : 6, contactWindowTicks: 2, recoveryTicks: family === 'aerial' ? 30 : 18 };
  const defaultMovement: Movement = { maximumTurnRadians: family === 'dribble' ? 2.9 : 1.95, speedScale: family === 'dribble' ? 0.74 : 0.62, preserveSteering: true };
  const defaultCounter: Counter = { windowTicks: family === 'dribble' ? 8 : 12, vulnerable: true };
  return {
    id,
    displayName,
    family,
    tags: [family, surface],
    input: { action: 'technique', ...(family === 'dribble' ? { requiresPrecision: true } : {}) },
    eligibility: { ...defaultEligibility, ...tuning.eligibility },
    cost: { ...defaultCost, ...tuning.cost },
    timing: { ...defaultTiming, ...tuning.timing },
    movement: { ...defaultMovement, ...tuning.movement },
    contact: { ...defaultContact(family, surface), ...tuning.contact, surface },
    mechanic: tuning.mechanic ?? evolutionMechanic(evolution),
    failure: { recoveryTicks: 14, reason: 'timing-or-geometry-miss' },
    counter: { ...defaultCounter, ...tuning.counter },
    animationKey: `technique-${id}`,
    ...(evolution ? { evolution } : {}),
  };
}

export const TECHNIQUES: readonly TechniqueDefinition[] = Object.freeze([
  technique('stepover', 'Step-over', 'dribble', 'outside', { chain: 'phantom-step', tier: 1 }),
  technique('double-stepover', 'Double step-over', 'dribble', 'outside', { chain: 'phantom-step', tier: 2 }),
  technique('phantom-step', 'Phantom step', 'dribble', 'inside', { chain: 'phantom-step', tier: 3 }),
  technique('roulette', 'Roulette', 'dribble', 'sole'),
  technique('elastico', 'Elastico', 'dribble', 'outside'),
  technique('rainbow', 'Rainbow touch', 'dribble', 'toe'),
  technique('body-feint', 'Body feint', 'dribble', 'inside'),
  technique('finesse-curl', 'Finesse curl', 'pass-shot', 'inside', { chain: 'whipped-curl', tier: 1 }),
  technique('whipped-curl', 'Whipped curl', 'pass-shot', 'outside', { chain: 'whipped-curl', tier: 2 }),
  technique('impossible-angle', 'Impossible angle', 'pass-shot', 'outside', { chain: 'whipped-curl', tier: 3 }),
  technique('power-strike', 'Power strike', 'pass-shot', 'instep', { chain: 'thunder-strike', tier: 1 }),
  technique('thunder-strike', 'Thunder strike', 'pass-shot', 'instep', { chain: 'thunder-strike', tier: 2 }),
  technique('knuckle-strike', 'Knuckle strike', 'pass-shot', 'instep'),
  technique('trivela-contact', 'Outside-foot strike', 'pass-shot', 'outside'),
  technique('lofted-through', 'Lofted through ball', 'pass-shot', 'instep', { chain: 'threaded-ball', tier: 1 }),
  technique('threaded-ball', 'Threaded ball', 'pass-shot', 'inside', { chain: 'threaded-ball', tier: 2 }),
  technique('volley', 'Volley', 'aerial', 'instep', { chain: 'acrobat', tier: 1 }),
  technique('scissor', 'Scissor strike', 'aerial', 'instep', { chain: 'acrobat', tier: 2 }),
  technique('bicycle', 'Bicycle strike', 'aerial', 'instep', { chain: 'acrobat', tier: 3 }),
  technique('diving-header', 'Diving header', 'aerial', 'head'),
]);

for (const definition of TECHNIQUES) validateTechnique(definition);
export const TECHNIQUE_BY_ID: ReadonlyMap<string, TechniqueDefinition> = new Map(TECHNIQUES.map((item) => [item.id, item]));
