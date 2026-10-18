import type { PlayerState, Vec3 } from '@soccershooter/sim/player/PlayerState';
import type { LookDelta } from '../input/ActionMap';

export interface CameraObstacle {
  id: string;
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  minZ: number;
  maxZ: number;
}

export interface ThirdPersonCameraSettings {
  distance: number;
  targetHeight: number;
  shoulderOffset: number;
  baseFov: number;
  sprintFovBoost: number;
  initialYaw: number;
  initialPitch: number;
  minPitch: number;
  maxPitch: number;
  targetSettlingSeconds: number;
  obstructionRecoverySeconds: number;
  collisionRadius: number;
  collisionPadding: number;
  minArmLength: number;
}

export interface CameraSnapshot {
  position: Vec3;
  target: Vec3;
  yaw: number;
  pitch: number;
  fov: number;
  armLength: number;
  collision: {
    active: boolean;
    obstacleId: string | null;
    correctionPerSecond: number;
  };
}

const DEFAULT_SETTINGS: Readonly<ThirdPersonCameraSettings> = Object.freeze({
  distance: 5.6,
  targetHeight: 1.38,
  shoulderOffset: 0.45,
  baseFov: 55,
  sprintFovBoost: 2.25,
  initialYaw: 0,
  initialPitch: 0.32,
  minPitch: -0.12,
  maxPitch: 0.68,
  targetSettlingSeconds: 0.07,
  obstructionRecoverySeconds: 0.12,
  collisionRadius: 0.22,
  collisionPadding: 0.08,
  minArmLength: 1.2,
});

interface SpringState {
  value: number;
  velocity: number;
}

const TAU = Math.PI * 2;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function wrapYaw(yaw: number): number {
  const wrapped = ((yaw + Math.PI) % TAU + TAU) % TAU - Math.PI;
  return Object.is(wrapped, -0) ? 0 : wrapped;
}

function smoothDamp(state: SpringState, target: number, smoothTime: number, dt: number): SpringState {
  const time = Math.max(0.0001, smoothTime);
  const omega = 2 / time;
  const x = omega * dt;
  const exp = 1 / (1 + x + 0.48 * x * x + 0.235 * x * x * x);
  const change = state.value - target;
  const temp = (state.velocity + omega * change) * dt;
  return {
    value: target + (change + temp) * exp,
    velocity: (state.velocity - omega * temp) * exp,
  };
}

function segmentAabbT(start: Vec3, end: Vec3, obstacle: CameraObstacle, radius: number): number | null {
  const min = { x: obstacle.minX - radius, y: obstacle.minY - radius, z: obstacle.minZ - radius };
  const max = { x: obstacle.maxX + radius, y: obstacle.maxY + radius, z: obstacle.maxZ + radius };
  const delta = { x: end.x - start.x, y: end.y - start.y, z: end.z - start.z };
  let tMin = 0;
  let tMax = 1;
  for (const key of ['x', 'y', 'z'] as const) {
    const origin = start[key];
    const direction = delta[key];
    if (Math.abs(direction) < 1e-10) {
      if (origin < min[key] || origin > max[key]) return null;
      continue;
    }
    const inv = 1 / direction;
    let near = (min[key] - origin) * inv;
    let far = (max[key] - origin) * inv;
    if (near > far) [near, far] = [far, near];
    tMin = Math.max(tMin, near);
    tMax = Math.min(tMax, far);
    if (tMin > tMax) return null;
  }
  return tMin >= 0 && tMin <= 1 ? tMin : null;
}

function cameraPosition(target: Vec3, yaw: number, pitch: number, armLength: number, shoulder: number): Vec3 {
  const horizontal = Math.cos(pitch) * armLength;
  return {
    x: target.x - Math.sin(yaw) * horizontal + Math.cos(yaw) * shoulder,
    y: target.y + Math.sin(pitch) * armLength,
    z: target.z - Math.cos(yaw) * horizontal - Math.sin(yaw) * shoulder,
  };
}

export class ThirdPersonCamera {
  readonly settings: Readonly<ThirdPersonCameraSettings>;
  #yaw: number;
  #pitch: number;
  #armLength: number;
  #targetX: SpringState = { value: 0, velocity: 0 };
  #targetY: SpringState = { value: DEFAULT_SETTINGS.targetHeight, velocity: 0 };
  #targetZ: SpringState = { value: 0, velocity: 0 };
  #targetInitialized = false;
  #fov: number;

  constructor(options: Partial<ThirdPersonCameraSettings> = {}) {
    this.settings = Object.freeze({ ...DEFAULT_SETTINGS, ...options });
    this.#yaw = wrapYaw(this.settings.initialYaw);
    this.#pitch = clamp(this.settings.initialPitch, this.settings.minPitch, this.settings.maxPitch);
    this.#armLength = this.settings.distance;
    this.#fov = this.settings.baseFov;
  }

  update(
    player: Readonly<PlayerState>,
    look: Readonly<LookDelta>,
    deltaSeconds: number,
    obstacles: readonly CameraObstacle[],
    sprintFraction = 0,
  ): CameraSnapshot {
    if (!Number.isFinite(deltaSeconds) || deltaSeconds <= 0 || deltaSeconds > 0.25) {
      throw new RangeError('camera deltaSeconds must be finite and in (0, 0.25]');
    }
    this.#yaw = wrapYaw(this.#yaw + look.yawDelta);
    this.#pitch = clamp(this.#pitch + look.pitchDelta, this.settings.minPitch, this.settings.maxPitch);

    const rawTarget = {
      x: player.position.x,
      y: player.position.y + this.settings.targetHeight,
      z: player.position.z,
    };
    if (!this.#targetInitialized) {
      this.#targetInitialized = true;
      this.#targetX = { value: rawTarget.x, velocity: 0 };
      this.#targetY = { value: rawTarget.y, velocity: 0 };
      this.#targetZ = { value: rawTarget.z, velocity: 0 };
    } else {
      this.#targetX = smoothDamp(this.#targetX, rawTarget.x, this.settings.targetSettlingSeconds, deltaSeconds);
      this.#targetY = smoothDamp(this.#targetY, rawTarget.y, this.settings.targetSettlingSeconds, deltaSeconds);
      this.#targetZ = smoothDamp(this.#targetZ, rawTarget.z, this.settings.targetSettlingSeconds, deltaSeconds);
    }
    const target = { x: this.#targetX.value, y: this.#targetY.value, z: this.#targetZ.value };
    const fullPosition = cameraPosition(target, this.#yaw, this.#pitch, this.settings.distance, this.settings.shoulderOffset);

    let nearestT = 1;
    let nearestId: string | null = null;
    for (const obstacle of obstacles) {
      const hit = segmentAabbT(target, fullPosition, obstacle, this.settings.collisionRadius);
      if (hit !== null && hit < nearestT) {
        nearestT = hit;
        nearestId = obstacle.id;
      }
    }

    const desiredArm = nearestId === null
      ? this.settings.distance
      : Math.max(this.settings.minArmLength, this.settings.distance * nearestT - this.settings.collisionPadding);
    const previousArm = this.#armLength;
    if (desiredArm < this.#armLength) {
      this.#armLength = desiredArm;
    } else {
      const alpha = 1 - Math.exp(-deltaSeconds / Math.max(0.001, this.settings.obstructionRecoverySeconds));
      this.#armLength += (desiredArm - this.#armLength) * alpha;
    }

    const targetFov = this.settings.baseFov + this.settings.sprintFovBoost * clamp(sprintFraction, 0, 1);
    const fovAlpha = 1 - Math.exp(-deltaSeconds / 0.1);
    this.#fov += (targetFov - this.#fov) * fovAlpha;

    return {
      position: cameraPosition(target, this.#yaw, this.#pitch, this.#armLength, this.settings.shoulderOffset),
      target,
      yaw: this.#yaw,
      pitch: this.#pitch,
      fov: this.#fov,
      armLength: this.#armLength,
      collision: {
        active: nearestId !== null,
        obstacleId: nearestId,
        correctionPerSecond: Math.abs(this.#armLength - previousArm) / deltaSeconds,
      },
    };
  }
}
