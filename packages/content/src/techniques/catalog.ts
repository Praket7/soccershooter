import { validateTechnique, type TechniqueDefinition } from './schema';

function technique(
  id: string,
  displayName: string,
  family: TechniqueDefinition['family'],
  surface: TechniqueDefinition['contact']['surface'],
  evolution?: TechniqueDefinition['evolution'],
): TechniqueDefinition {
  return {
    id,
    displayName,
    family,
    tags: [family, surface],
    input: { action: 'technique', ...(family === 'dribble' ? { requiresPrecision: true } : {}) },
    eligibility: {
      minimumSpeed: family === 'aerial' ? 1 : id === 'body-feint' ? 0 : 0.6,
      maximumSpeed: family === 'aerial' ? 8.5 : 9,
      maximumPressure: 0.82,
      maximumBallDistance: 0.76,
      requiresGrounded: family !== 'aerial',
    },
    cost: { stamina: family === 'aerial' ? 7 : 4, cooldownTicks: family === 'dribble' ? 48 : 72 },
    timing: { anticipationTicks: family === 'dribble' ? 4 : 6, contactWindowTicks: 2, recoveryTicks: family === 'aerial' ? 30 : 18 },
    movement: { maximumTurnRadians: family === 'dribble' ? 2.9 : 1.95, speedScale: family === 'dribble' ? 0.74 : 0.62, preserveSteering: true },
    contact: { surface, impulseScale: family === 'aerial' ? 0.84 : 1, maxImpulse: family === 'aerial' ? 11 : 15, spinScale: family === 'pass-shot' ? 1.1 : 0.7 },
    mechanic: !evolution || evolution.tier === 1
      ? 'standard'
      : evolution.chain === 'phantom-step' && evolution.tier >= 3
        ? 'branching-step'
        : evolution.chain === 'phantom-step'
          ? 'late-cut'
          : evolution.chain === 'whipped-curl' && evolution.tier >= 3
            ? 'late-cut'
            : evolution.chain === 'whipped-curl'
              ? 'curl-release'
              : evolution.chain === 'thunder-strike'
                ? 'late-plant'
                : evolution.chain === 'threaded-ball'
                  ? 'guided-lane'
                  : evolution.chain === 'acrobat'
                    ? 'air-redirection'
                    : 'standard',
    failure: { recoveryTicks: 14, reason: 'timing-or-geometry-miss' },
    counter: { windowTicks: family === 'dribble' ? 8 : 12, vulnerable: true },
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
