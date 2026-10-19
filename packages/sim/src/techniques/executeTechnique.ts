import type { TechniqueDefinition, TechniqueMechanic } from '@soccershooter/content/techniques/schema';

export interface TechniqueState {
  stamina: number;
  cooldownUntilTick: number;
  recoveryUntilTick: number;
  active: null | { techniqueId: string; contactTick: number; counterUntilTick: number };
  lastFailure: string | null;
}

export interface TechniqueContext {
  tick: number;
  speed: number;
  pressure: number;
  ballDistance: number;
  grounded: boolean;
  stamina: number;
  actionBits: number;
}

export interface TechniqueContactIntent {
  techniqueId: string;
  contactTick: number;
  surface: TechniqueDefinition['contact']['surface'];
  impulseScale: number;
  maxImpulse: number;
  spinScale: number;
  mechanic: TechniqueMechanic;
  counterUntilTick: number;
}

export type TechniqueResultStatus = 'windup' | 'ineligible' | 'cooldown' | 'recovery' | 'interrupted';
export interface TechniqueResult {
  status: TechniqueResultStatus;
  state: TechniqueState;
  contact: TechniqueContactIntent | null;
  reason: string;
  counterUntilTick: number;
}

export function createTechniqueState(stamina = 100): TechniqueState {
  if (!Number.isFinite(stamina)) throw new TypeError('stamina must be finite');
  return { stamina: Math.max(0, stamina), cooldownUntilTick: 0, recoveryUntilTick: 0, active: null, lastFailure: null };
}

function failed(state: Readonly<TechniqueState>, status: TechniqueResultStatus, reason: string): TechniqueResult {
  return { status, state: { ...state }, contact: null, reason, counterUntilTick: state.active?.counterUntilTick ?? 0 };
}

export function executeTechnique(
  technique: Readonly<TechniqueDefinition>,
  state: Readonly<TechniqueState>,
  context: Readonly<TechniqueContext>,
): TechniqueResult {
  if (context.tick < state.recoveryUntilTick) return failed(state, 'recovery', 'recovery-active');
  if (context.tick < state.cooldownUntilTick) return failed(state, 'cooldown', 'cooldown-active');
  if (state.active) return failed(state, 'recovery', 'technique-already-active');
  if ((context.actionBits & (1 << 6)) === 0) return failed(state, 'ineligible', 'technique-input-missing');
  if (!technique.eligibility.requiresGrounded && !context.grounded) return failed(state, 'ineligible', 'airborne-technique-required');
  if (technique.eligibility.requiresGrounded && !context.grounded) return failed(state, 'ineligible', 'ground-contact-required');
  if (
    context.speed < technique.eligibility.minimumSpeed
    || context.speed > technique.eligibility.maximumSpeed
    || context.pressure > technique.eligibility.maximumPressure
    || context.ballDistance > technique.eligibility.maximumBallDistance
  ) return failed(state, 'ineligible', 'context-outside-eligibility');
  if (context.stamina < technique.cost.stamina || state.stamina < technique.cost.stamina) {
    return failed(state, 'ineligible', 'insufficient-stamina');
  }

  const contactTick = context.tick + technique.timing.anticipationTicks;
  const counterUntilTick = contactTick + technique.counter.windowTicks;
  const nextState: TechniqueState = {
    stamina: Math.min(state.stamina, context.stamina) - technique.cost.stamina,
    cooldownUntilTick: context.tick + technique.cost.cooldownTicks,
    recoveryUntilTick: contactTick + technique.timing.recoveryTicks,
    active: { techniqueId: technique.id, contactTick, counterUntilTick },
    lastFailure: null,
  };
  return {
    status: 'windup',
    state: nextState,
    contact: {
      techniqueId: technique.id,
      contactTick,
      surface: technique.contact.surface,
      impulseScale: technique.contact.impulseScale,
      maxImpulse: technique.contact.maxImpulse,
      spinScale: technique.contact.spinScale,
      mechanic: technique.mechanic,
      counterUntilTick,
    },
    reason: 'eligible-windup',
    counterUntilTick,
  };
}

export function interruptTechnique(
  technique: Readonly<TechniqueDefinition>,
  state: Readonly<TechniqueState>,
  tick: number,
): TechniqueResult {
  const counterUntilTick = state.active?.counterUntilTick ?? tick + technique.counter.windowTicks;
  return {
    status: 'interrupted',
    state: {
      ...state,
      active: null,
      recoveryUntilTick: tick + technique.failure.recoveryTicks,
      lastFailure: technique.failure.reason,
    },
    contact: null,
    reason: technique.failure.reason,
    counterUntilTick,
  };
}
