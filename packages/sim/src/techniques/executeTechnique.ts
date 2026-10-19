import type { TechniqueDefinition, TechniqueMechanic, TechniqueSpinAxis } from '@soccershooter/content/techniques/schema';

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
  ballHeight: number;
  grounded: boolean;
  stamina: number;
  actionBits: number;
}

export interface TechniqueContactIntent {
  techniqueId: string;
  contactTick: number;
  surface: TechniqueDefinition['contact']['surface'];
  targetSpeed: number;
  launchElevationDegrees: number;
  spinAxis: TechniqueSpinAxis;
  spinRate: number;
  impulseScale: number;
  maxImpulse: number;
  spinScale: number;
  mechanic: TechniqueMechanic;
  counterUntilTick: number;
}

export interface TechniqueContactKinematics {
  targetVelocity: { x: number; y: number; z: number };
  angularVelocity: { x: number; y: number; z: number };
  targetSpeed: number;
  launchElevationDegrees: number;
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

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function mechanicKinematicFactors(mechanic: TechniqueMechanic): { speed: number; elevation: number; spin: number } {
  switch (mechanic) {
    case 'branching-step': return { speed: 0.94, elevation: 0, spin: 0.9 };
    case 'late-cut': return { speed: 1.02, elevation: 0, spin: 1.12 };
    case 'curl-release': return { speed: 0.98, elevation: 1.5, spin: 1.12 };
    case 'late-plant': return { speed: 1.06, elevation: -1, spin: 0.82 };
    case 'guided-lane': return { speed: 0.98, elevation: -1.5, spin: 0.72 };
    case 'air-redirection': return { speed: 1.03, elevation: 5, spin: 1 };
    case 'standard': return { speed: 1, elevation: 0, spin: 1 };
  }
}

function spinVector(
  axis: TechniqueSpinAxis,
  rate: number,
  surface: TechniqueContactIntent['surface'],
  horizontalDirection: Readonly<{ x: number; z: number }>,
): { x: number; y: number; z: number } {
  if (axis === 'none' || rate <= 1e-9) return { x: 0, y: 0, z: 0 };
  if (axis === 'top' || axis === 'back') {
    // Spin must be expressed in the ball's travel frame rather than the world
    // frame. up × forward gives the horizontal rolling axis: +X for a +Z shot,
    // -Z for a +X shot. Backspin is the exact inverse.
    const sign = axis === 'top' ? 1 : -1;
    return {
      x: horizontalDirection.z * rate * sign,
      y: 0,
      z: -horizontalDirection.x * rate * sign,
    };
  }
  const sideSign = surface === 'inside' ? -1 : 1;
  return { x: 0, y: rate * sideSign, z: 0 };
}

/**
 * Converts a declarative technique contact into physical target velocity and
 * spin. The result only supplies a target to the normal bounded impulse path;
 * it never bypasses the shared ball/contact solver.
 */
export function resolveTechniqueContactKinematics(
  contact: Readonly<TechniqueContactIntent>,
  aim: Readonly<{ x: number; z: number }>,
): TechniqueContactKinematics {
  const aimLength = Math.hypot(aim.x, aim.z);
  const nx = aimLength > 1e-9 ? aim.x / aimLength : 0;
  const nz = aimLength > 1e-9 ? aim.z / aimLength : 1;
  const factors = mechanicKinematicFactors(contact.mechanic);
  const speed = clamp(contact.targetSpeed * factors.speed, 0, 36);
  const elevation = clamp(contact.launchElevationDegrees + factors.elevation, -5, 55);
  const elevationRadians = elevation * Math.PI / 180;
  const horizontal = speed * Math.cos(elevationRadians);
  const spinRate = clamp(contact.spinRate * factors.spin, 0, 120);
  return {
    targetVelocity: { x: nx * horizontal, y: speed * Math.sin(elevationRadians), z: nz * horizontal },
    angularVelocity: spinVector(contact.spinAxis, spinRate, contact.surface, { x: nx, z: nz }),
    targetSpeed: speed,
    launchElevationDegrees: elevation,
  };
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
  if (technique.eligibility.requiresGrounded && !context.grounded) return failed(state, 'ineligible', 'ground-contact-required');
  if (context.ballHeight < technique.eligibility.minimumBallHeight || context.ballHeight > technique.eligibility.maximumBallHeight) {
    return failed(state, 'ineligible', 'wrong-ball-height');
  }
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
      targetSpeed: technique.contact.targetSpeed,
      launchElevationDegrees: technique.contact.launchElevationDegrees,
      spinAxis: technique.contact.spinAxis,
      spinRate: technique.contact.spinRate,
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
