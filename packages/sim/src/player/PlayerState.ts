import {
  cloneAthleticMotionState,
  createAthleticMotionState,
  type AthleticMotionState,
} from './athleticMotion';

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export const PlayerActionBits = Object.freeze({
  Jump: 1 << 0,
  Tackle: 1 << 1,
  Pass: 1 << 2,
  ShootHeld: 1 << 3,
  ShootReleased: 1 << 4,
  Precision: 1 << 5,
  Technique: 1 << 6,
  ThroughPass: 1 << 7,
  LoftedPass: 1 << 8,
  Receive: 1 << 9,
  DrivenModifier: 1 << 10,
  ChipModifier: 1 << 11,
});

export type LocomotionState =
  | 'idle'
  | 'walk'
  | 'jog'
  | 'sprint'
  | 'decelerate'
  | 'sharp-cut'
  | 'airborne';

export interface PlayerActionHooks {
  jumpRequested: boolean;
  tackleRequested: boolean;
}

export interface PlayerState {
  position: Vec3;
  velocity: Vec3;
  facingYaw: number;
  stamina: number;
  sprintLocked: boolean;
  grounded: boolean;
  groundHeight: number;
  locomotion: LocomotionState;
  athleticMotion: AthleticMotionState;
  actionHooks: PlayerActionHooks;
}

export interface PlayerStateInit {
  position?: Partial<Vec3>;
  velocity?: Partial<Vec3>;
  facingYaw?: number;
  stamina?: number;
  sprintLocked?: boolean;
  grounded?: boolean;
  groundHeight?: number;
  locomotion?: LocomotionState;
  athleticMotion?: AthleticMotionState;
  actionHooks?: Partial<PlayerActionHooks>;
}

function finiteOr(value: number | undefined, fallback: number, field: string): number {
  const resolved = value ?? fallback;
  if (!Number.isFinite(resolved)) throw new TypeError(`${field} must be finite`);
  return resolved;
}

export function createPlayerState(init: PlayerStateInit = {}): PlayerState {
  return {
    position: {
      x: finiteOr(init.position?.x, 0, 'position.x'),
      y: finiteOr(init.position?.y, 0, 'position.y'),
      z: finiteOr(init.position?.z, 0, 'position.z'),
    },
    velocity: {
      x: finiteOr(init.velocity?.x, 0, 'velocity.x'),
      y: finiteOr(init.velocity?.y, 0, 'velocity.y'),
      z: finiteOr(init.velocity?.z, 0, 'velocity.z'),
    },
    facingYaw: finiteOr(init.facingYaw, 0, 'facingYaw'),
    stamina: finiteOr(init.stamina, 100, 'stamina'),
    sprintLocked: init.sprintLocked ?? false,
    grounded: init.grounded ?? true,
    groundHeight: finiteOr(init.groundHeight, init.position?.y ?? 0, 'groundHeight'),
    locomotion: init.locomotion ?? 'idle',
    athleticMotion: init.athleticMotion
      ? cloneAthleticMotionState(init.athleticMotion)
      : createAthleticMotionState(),
    actionHooks: {
      jumpRequested: init.actionHooks?.jumpRequested ?? false,
      tackleRequested: init.actionHooks?.tackleRequested ?? false,
    },
  };
}

export function clonePlayerState(state: Readonly<PlayerState>): PlayerState {
  return {
    ...state,
    position: { ...state.position },
    velocity: { ...state.velocity },
    athleticMotion: cloneAthleticMotionState(state.athleticMotion),
    actionHooks: { ...state.actionHooks },
  };
}
