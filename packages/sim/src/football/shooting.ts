import {
  clampFootball,
  commandTowardVelocity,
  forwardFromYaw,
  horizontalDistance,
  horizontalDot,
  normalizeHorizontal,
  type BallContactCommand,
  type FootballActorSnapshot,
  type FootballBallSnapshot,
  type FootballFoot,
  type FootballHorizontalDirection,
  type FootballVec3,
} from './types';

export type ShotStyle = 'normal' | 'driven' | 'finesse' | 'chip' | 'knuckle' | 'outside-foot';

export interface ShotBuildInput {
  style: ShotStyle;
  shooter: Readonly<FootballActorSnapshot>;
  ball: Readonly<FootballBallSnapshot>;
  /** Horizontal fallback for AI/legacy callers that do not provide a world target. */
  aim: FootballHorizontalDirection;
  /**
   * Optional center-reticle world target. When supplied, the shot points from
   * the physical ball toward this target in both horizontal direction and
   * elevation, bounded by the selected technique rather than silently using a
   * fixed vertical launch angle.
   */
  aimTarget?: FootballVec3;
  charge: number;
  spinInput: number;
  pressure: number;
  balance: number;
  contactFoot: FootballFoot;
  /** Deterministic event seed used only by a legal knuckle strike. */
  knuckleSeed?: number;
}

export interface ShotSolution {
  legal: boolean;
  reason: 'ok' | 'ball-out-of-reach' | 'behind-body';
  launchVelocity: FootballVec3;
  launchSpeed: number;
  alignment: number;
  effectiveBalance: number;
  /** Explicit physics lifecycle metadata: zero disables knuckle perturbation. */
  knuckleSeed: number;
  command?: BallContactCommand;
}

const SHOT_CONTACT_REACH = 1.45;
const MIN_LEGAL_DOT = Math.cos(122 * Math.PI / 180);
const DEFAULT_KNUCKLE_SEED = 0x5a17f00d;

function styleSpeed(style: ShotStyle, charge: number): number {
  if (style === 'driven') return 14 + 22 * charge;
  if (style === 'finesse') return 10 + 16 * charge;
  if (style === 'chip') return 9 + 14 * charge;
  if (style === 'knuckle') return 14 + 20 * charge;
  if (style === 'outside-foot') return 12 + 19 * charge;
  return 10 + 19 * charge;
}

function styleElevationDegrees(style: ShotStyle, charge: number): number {
  if (style === 'chip') return 28 + 9 * (1 - charge);
  if (style === 'finesse') return 10.5;
  if (style === 'outside-foot') return 8.5;
  if (style === 'knuckle') return 6.5;
  if (style === 'driven') return 4.5;
  return 7.5;
}

function styleElevationEnvelopeDegrees(style: ShotStyle): readonly [number, number] {
  if (style === 'chip') return [18, 42];
  if (style === 'finesse') return [5, 20];
  if (style === 'outside-foot') return [3, 18];
  if (style === 'knuckle') return [1.5, 12];
  if (style === 'driven') return [0.5, 7];
  return [1.5, 18];
}

function resolvedAim(input: Readonly<ShotBuildInput>): FootballHorizontalDirection {
  const target = input.aimTarget;
  if (target
    && Number.isFinite(target.x)
    && Number.isFinite(target.z)
    && Math.hypot(target.x - input.ball.position.x, target.z - input.ball.position.z) > 1e-6) {
    return normalizeHorizontal({
      x: target.x - input.ball.position.x,
      z: target.z - input.ball.position.z,
    }, forwardFromYaw(input.shooter.facingYaw));
  }
  return normalizeHorizontal(input.aim, forwardFromYaw(input.shooter.facingYaw));
}

function resolvedElevationRadians(input: Readonly<ShotBuildInput>, charge: number): number {
  const fallbackDegrees = styleElevationDegrees(input.style, charge);
  const target = input.aimTarget;
  if (!target || !Number.isFinite(target.y)) return fallbackDegrees * Math.PI / 180;

  const horizontal = Math.hypot(
    target.x - input.ball.position.x,
    target.z - input.ball.position.z,
  );
  if (!Number.isFinite(horizontal) || horizontal <= 0.25) return fallbackDegrees * Math.PI / 180;

  const requestedDegrees = Math.atan2(target.y - input.ball.position.y, horizontal) * 180 / Math.PI;
  const [minDegrees, maxDegrees] = styleElevationEnvelopeDegrees(input.style);
  return clampFootball(requestedDegrees, minDegrees, maxDegrees) * Math.PI / 180;
}

function angularSignature(style: ShotStyle, spinInput: number, foot: FootballFoot): FootballVec3 {
  const spin = clampFootball(spinInput, -1, 1);
  const footSign = foot === 'right' ? -1 : 1;
  if (style === 'finesse') return { x: -5, y: 48 * spin * footSign, z: 0 };
  if (style === 'outside-foot') return { x: 1.5, y: 56 * Math.max(0.35, Math.abs(spin)) * footSign, z: 0 };
  if (style === 'chip') return { x: -28 * (0.55 + 0.45 * Math.abs(spin)), y: 0, z: 0 };
  if (style === 'knuckle') return { x: 0.45 * spin, y: -0.65 * spin, z: 0.25 * spin };
  if (style === 'driven') return { x: 9 + 7 * Math.max(0, spin), y: 3 * spin * footSign, z: 0 };
  // Normal is the deliberately straight baseline. Backspin gives it a natural
  // flight profile, while intentional lateral bend belongs to finesse and
  // outside-foot contacts instead of appearing automatically.
  return { x: -3, y: 0, z: 0 };
}

function deterministicKnuckleSeed(input: Readonly<ShotBuildInput>): number {
  if (input.style !== 'knuckle') return 0;
  const supplied = input.knuckleSeed;
  if (supplied === undefined) return DEFAULT_KNUCKLE_SEED;
  if (!Number.isFinite(supplied)) throw new TypeError('knuckleSeed must be finite');
  return Math.trunc(supplied) >>> 0;
}

export function buildShot(input: Readonly<ShotBuildInput>): ShotSolution {
  const aim = resolvedAim(input);
  const facing = forwardFromYaw(input.shooter.facingYaw);
  const facingDot = horizontalDot(facing, aim);
  const alignment = clampFootball((facingDot - MIN_LEGAL_DOT) / (1 - MIN_LEGAL_DOT), 0, 1);
  const charge = clampFootball(input.charge, 0, 1);
  const pressure = clampFootball(input.pressure, 0, 1);
  const requestedBalance = clampFootball(input.balance, 0, 1);
  const bodyBalance = clampFootball(input.shooter.balance, 0, 1);
  const effectiveBalance = requestedBalance * bodyBalance * (1 - 0.38 * pressure);
  const knuckleSeed = deterministicKnuckleSeed(input);

  const empty: ShotSolution = {
    legal: false,
    reason: 'ball-out-of-reach',
    launchVelocity: { x: 0, y: 0, z: 0 },
    launchSpeed: 0,
    alignment,
    effectiveBalance,
    knuckleSeed: 0,
  };

  if (horizontalDistance(input.shooter.position, input.ball.position) > SHOT_CONTACT_REACH) return empty;
  if (facingDot < MIN_LEGAL_DOT) return { ...empty, reason: 'behind-body' };

  const nominalSpeed = styleSpeed(input.style, charge);
  // Misalignment and pressure reduce the attainable launch speed rather than
  // silently correcting aim. This preserves user intent while making body setup
  // mechanically valuable.
  const alignmentFactor = 0.69 + 0.31 * alignment;
  const balanceFactor = 0.72 + 0.28 * effectiveBalance;
  const launchSpeed = clampFootball(nominalSpeed * alignmentFactor * balanceFactor, 0, 36);
  const elevation = resolvedElevationRadians(input, charge);
  const horizontal = launchSpeed * Math.cos(elevation);
  const launchVelocity: FootballVec3 = {
    x: aim.x * horizontal,
    y: launchSpeed * Math.sin(elevation),
    z: aim.z * horizontal,
  };
  const angularVelocityDelta = angularSignature(input.style, input.spinInput, input.contactFoot);
  const command = commandTowardVelocity(
    'shot',
    input.ball,
    launchVelocity,
    angularVelocityDelta,
    15.5,
    `${input.style} shot charge=${charge.toFixed(2)} align=${alignment.toFixed(2)} balance=${effectiveBalance.toFixed(2)} foot=${input.contactFoot}`,
  );

  return {
    legal: true,
    reason: 'ok',
    launchVelocity,
    launchSpeed,
    alignment,
    effectiveBalance,
    knuckleSeed,
    command,
  };
}
