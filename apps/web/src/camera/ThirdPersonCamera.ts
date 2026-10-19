import type { PlayerState, Vec3 } from '@soccershooter/sim/player/PlayerState';
import type { LookDelta } from '../input/ActionMap';
import { currentGameplayPreferences } from '../settings/GameplayPreferences';

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
  minDistance: number;
  maxDistance: number;
  zoomSpeed: number;
  zoomSettlingSeconds: number;
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
  userDistance: number;
  desiredDistance: number;
  collision: {
    active: boolean;
    obstacleId: string | null;
    correctionPerSecond: number;
  };
}

const DEFAULT_SETTINGS: Readonly<ThirdPersonCameraSettings> = Object.freeze({
  distance: 5.6,
  minDistance: 3.4,
  maxDistance: 8.8,
  zoomSpeed: 1.4,
  zoomSettlingSeconds: 0.11,
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

function hasOwnSetting(options: Partial<ThirdPersonCameraSettings>, key: keyof ThirdPersonCameraSettings): boolean {
  return Object.prototype.hasOwnProperty.call(options, key);
}

export class ThirdPersonCamera {
  readonly settings: Readonly<ThirdPersonCameraSettings>;
  readonly #distanceUsesPreferences: boolean;
  readonly #fovUsesPreferences: boolean;
  readonly #sprintFovUsesPreferences: boolean;
  #lastPreferenceDistance: number;
  #yaw: number;
  #pitch: number;
  #armLength: number;
  #desiredDistance: number;
  #userDistance: number;
  #targetX: SpringState = { value: 0, velocity: 0 };
  #targetY: SpringState = { value: DEFAULT_SETTINGS.targetHeight, velocity: 0 };
  #targetZ: SpringState = { value: 0, velocity: 0 };
  #targetInitialized = false;
  #fov: number;

  constructor(options: Partial<ThirdPersonCameraSettings> = {}) {
    const preferences = currentGameplayPreferences();
    this.#distanceUsesPreferences = !hasOwnSetting(options, 'distance');
    this.#fovUsesPreferences = !hasOwnSetting(options, 'baseFov');
    this.#sprintFovUsesPreferences = !hasOwnSetting(options, 'sprintFovBoost');
    const settings = {
      ...DEFAULT_SETTINGS,
      ...(this.#distanceUsesPreferences ? { distance: preferences.cameraDistance } : {}),
      ...(this.#fovUsesPreferences ? { baseFov: preferences.cameraFov } : {}),
      ...(this.#sprintFovUsesPreferences ? { sprintFovBoost: preferences.sprintFovBoost } : {}),
      ...options,
    };
    if (![settings.distance, settings.minDistance, settings.maxDistance, settings.zoomSpeed, settings.zoomSettlingSeconds].every(Number.isFinite)) {
      throw new RangeError('camera zoom settings must be finite');
    }
    if (settings.minDistance <= settings.minArmLength || settings.maxDistance <= settings.minDistance) {
      throw new RangeError('camera distance envelope must be above minArmLength and have maxDistance > minDistance');
    }
    if (settings.zoomSpeed <= 0 || settings.zoomSettlingSeconds <= 0) {
      throw new RangeError('camera zoom speed and settling time must be positive');
    }
    settings.distance = clamp(settings.distance, settings.minDistance, settings.maxDistance);
    this.settings = Object.freeze(settings);
    this.#lastPreferenceDistance = preferences.cameraDistance;
    this.#yaw = wrapYaw(this.settings.initialYaw);
    this.#pitch = clamp(this.settings.initialPitch, this.settings.minPitch, this.settings.maxPitch);
    this.#desiredDistance = this.settings.distance;
    this.#userDistance = this.settings.distance;
    this.#armLength = this.settings.distance;
    this.#fov = this.settings.baseFov;
  }

  adjustZoom(delta: number): void {
    if (!Number.isFinite(delta)) throw new TypeError('camera zoom delta must be finite');
    this.#desiredDistance = clamp(
      this.#desiredDistance + delta * this.settings.zoomSpeed,
      this.settings.minDistance,
      this.settings.maxDistance,
    );
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
    const preferences = currentGameplayPreferences();
    if (this.#distanceUsesPreferences && Math.abs(preferences.cameraDistance - this.#lastPreferenceDistance) > 1e-9) {
      this.#lastPreferenceDistance = preferences.cameraDistance;
      this.#desiredDistance = clamp(preferences.cameraDistance, this.settings.minDistance, this.settings.maxDistance);
    }

    this.#yaw = wrapYaw(this.#yaw + look.yawDelta);
    this.#pitch = clamp(this.#pitch + look.pitchDelta, this.settings.minPitch, this.settings.maxPitch);

    const zoomAlpha = 1 - Math.exp(-deltaSeconds / this.settings.zoomSettlingSeconds);
    this.#userDistance += (this.#desiredDistance - this.#userDistance) * zoomAlpha;
    this.#userDistance = clamp(this.#userDistance, this.settings.minDistance, this.settings.maxDistance);

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
    const fullPosition = cameraPosition(target, this.#yaw, this.#pitch, this.#userDistance, this.settings.shoulderOffset);

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
      ? this.#userDistance
      : Math.max(this.settings.minArmLength, this.#userDistance * nearestT - this.settings.collisionPadding);
    const previousArm = this.#armLength;
    if (desiredArm < this.#armLength) {
      this.#armLength = desiredArm;
    } else {
      const alpha = 1 - Math.exp(-deltaSeconds / Math.max(0.001, this.settings.obstructionRecoverySeconds));
      this.#armLength += (desiredArm - this.#armLength) * alpha;
    }

    const baseFov = this.#fovUsesPreferences ? preferences.cameraFov : this.settings.baseFov;
    const configuredSprintBoost = this.#sprintFovUsesPreferences ? preferences.sprintFovBoost : this.settings.sprintFovBoost;
    const sprintBoost = preferences.reducedMotion ? 0 : configuredSprintBoost;
    const targetFov = baseFov + sprintBoost * clamp(sprintFraction, 0, 1);
    const fovAlpha = 1 - Math.exp(-deltaSeconds / 0.1);
    this.#fov += (targetFov - this.#fov) * fovAlpha;

    return {
      position: cameraPosition(target, this.#yaw, this.#pitch, this.#armLength, this.settings.shoulderOffset),
      target,
      yaw: this.#yaw,
      pitch: this.#pitch,
      fov: this.#fov,
      armLength: this.#armLength,
      userDistance: this.#userDistance,
      desiredDistance: this.#desiredDistance,
      collision: {
        active: nearestId !== null,
        obstacleId: nearestId,
        correctionPerSecond: Math.abs(this.#armLength - previousArm) / deltaSeconds,
      },
    };
  }
}
