import type { FootballContactSurface } from './contactPlan';
import type { FootballFoot, FootballVec3 } from './types';

export type ControlAssistSkill = 'beginner' | 'mastery';

export interface ControlAssistInput {
  actorPosition: Readonly<FootballVec3>;
  ballPosition: Readonly<FootballVec3>;
  facingYaw: number;
  nextFoot: Exclude<FootballFoot, 'both'>;
  preferredFoot: Exclude<FootballFoot, 'both'>;
  pressure: number;
  balance: number;
  precision: boolean;
  turnDemand: number;
  skill: ControlAssistSkill;
}

export interface ControlAssistChoice {
  foot: Exclude<FootballFoot, 'both'>;
  surface: FootballContactSurface;
  timingWindowTicks: number;
  maxReachMeters: number;
  approachCorrectionMeters: number;
  reason: 'phase-and-ball-side' | 'preferred-foot' | 'pressure-narrowed';
}

const HARD_MAX_REACH_METERS = 1.48;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Number.isFinite(value) ? value : 0));
}

/**
 * Ranks legal contact options for an intent. Assistance may choose a viable
 * foot and widen a routine beginner timing window by at most one tick; it
 * never changes the physical reach limit or ball physics.
 */
export function chooseControlAssist(input: Readonly<ControlAssistInput>): ControlAssistChoice {
  const dx = input.ballPosition.x - input.actorPosition.x;
  const dz = input.ballPosition.z - input.actorPosition.z;
  const localX = dx * Math.cos(input.facingYaw) - dz * Math.sin(input.facingYaw);
  const sideFoot = localX > 0.05 ? 'right' : localX < -0.05 ? 'left' : null;
  const score = (foot: 'left' | 'right'): number =>
    (foot === sideFoot ? 0.58 : 0)
    + (foot === input.nextFoot ? 0.24 : 0)
    + (foot === input.preferredFoot ? 0.18 : 0);
  const foot = score('left') >= score('right') ? 'left' : 'right';
  const pressure = clamp(input.pressure, 0, 1);
  const balance = clamp(input.balance, 0, 1);
  const timingWindowTicks = input.skill === 'beginner'
    && !input.precision
    && pressure < 0.45
    && balance > 0.5
    ? 2
    : 1;
  const surface: FootballContactSurface = input.precision
    ? 'inside'
    : Math.abs(input.turnDemand) > 0.34
      ? (input.turnDemand > 0 ? (foot === 'right' ? 'outside' : 'inside') : (foot === 'left' ? 'outside' : 'inside'))
      : 'instep';
  const approachCorrectionMeters = input.skill === 'beginner'
    && !input.precision
    && pressure < 0.2
    && balance > 0.8
    ? 0.08
    : 0;
  const reason = pressure >= 0.45 || balance <= 0.5
    ? 'pressure-narrowed'
    : foot === input.preferredFoot
      ? 'preferred-foot'
      : 'phase-and-ball-side';
  return {
    foot,
    surface,
    timingWindowTicks,
    maxReachMeters: HARD_MAX_REACH_METERS,
    approachCorrectionMeters,
    reason,
  };
}
