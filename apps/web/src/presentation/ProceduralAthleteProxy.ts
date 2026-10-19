import * as THREE from 'three';
import type { FootballContactPlan } from '../../../../packages/sim/src/football/contactPlan';
import type { FootballFoot } from '../../../../packages/sim/src/football/types';
import type { PlayerState } from '../../../../packages/sim/src/player/PlayerState';
import { PLAYER_VISUAL_LAYOUT } from './PlayerVisualLayout';

export interface ProceduralAthleteInput {
  player: Pick<PlayerState, 'position' | 'facingYaw' | 'athleticMotion'>;
  plan?: Readonly<FootballContactPlan> | null;
  simulationTick: number;
  interpolationAlpha: number;
}

export interface ProceduralAthletePose {
  contactTick: number | null;
  contactFoot: FootballFoot | null;
  contactVisible: boolean;
  contactErrorMeters: number;
  supportFoot: FootballFoot | null;
  plantedFootSlideMeters: number;
}

const FEET = ['left', 'right'] as const;
const PRESENTATION_WARP_REACH = 0.76;
const MAX_STANCE_STRETCH = 0.48;
const UP = new THREE.Vector3(0, 1, 0);
const BODY_COLOR = 0xd9f35b;
const BOOT_COLOR = 0x10202a;
const TAU = Math.PI * 2;

type PlayerFoot = Exclude<FootballFoot, 'both'>;
type FootPositions = Record<PlayerFoot, THREE.Vector3>;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function angleDelta(from: number, to: number): number {
  return ((to - from + Math.PI) % TAU + TAU) % TAU - Math.PI;
}

function interpolateYaw(from: number, to: number, alpha: number): number {
  return from + angleDelta(from, to) * clamp(alpha, 0, 1);
}

function localToWorld(
  position: Readonly<THREE.Vector3>,
  local: Readonly<THREE.Vector3>,
  yaw: number,
): THREE.Vector3 {
  return local.clone().applyAxisAngle(UP, yaw).add(position);
}

function segmentBetween(mesh: THREE.Mesh, start: THREE.Vector3, end: THREE.Vector3): void {
  const direction = end.clone().sub(start);
  const length = direction.length();
  mesh.position.copy(start).add(end).multiplyScalar(0.5);
  mesh.quaternion.setFromUnitVectors(UP, length > 1e-6 ? direction.normalize() : UP);
  mesh.scale.y = Math.max(0.08, length);
}

export class ProceduralAthleteProxy {
  readonly group: THREE.Group;
  readonly bodyMaterial = new THREE.MeshStandardMaterial({ color: BODY_COLOR, roughness: 0.7 });
  readonly pose: ProceduralAthletePose = {
    contactTick: null,
    contactFoot: null,
    contactVisible: false,
    contactErrorMeters: 0,
    supportFoot: null,
    plantedFootSlideMeters: 0,
  };

  readonly #trunk = new THREE.Group();
  readonly #upperLegs: Record<'left' | 'right', THREE.Mesh>;
  readonly #lowerLegs: Record<'left' | 'right', THREE.Mesh>;
  readonly #boots: Record<'left' | 'right', THREE.Mesh>;
  #plantLock: { foot: Exclude<FootballFoot, 'both'>; worldPosition: THREE.Vector3 } | null = null;
  #lastPlantPosition: THREE.Vector3 | null = null;
  #footPositions: FootPositions = {
    left: new THREE.Vector3(-0.15, PLAYER_VISUAL_LAYOUT.footCenterY, 0.08),
    right: new THREE.Vector3(0.15, PLAYER_VISUAL_LAYOUT.footCenterY, 0.08),
  };
  #yawInitialized = false;
  #yawFrom = 0;
  #yawTo = 0;
  #lastSimulationTick = -1;

  constructor(scene: THREE.Scene) {
    this.group = new THREE.Group();
    this.group.name = 'stage05r-procedural-athlete-proxy';
    this.group.userData.proceduralAthleteProxy = true;
    this.group.add(this.#trunk);

    const bootMaterial = new THREE.MeshStandardMaterial({ color: BOOT_COLOR, roughness: 0.8 });
    const pelvis = new THREE.Mesh(new THREE.CapsuleGeometry(0.19, 0.20, 4, 8), this.bodyMaterial);
    pelvis.position.y = 0.87;
    pelvis.castShadow = true;
    this.#trunk.add(pelvis);

    const torso = new THREE.Mesh(
      new THREE.CylinderGeometry(0.27, 0.31, 0.58, 16),
      this.bodyMaterial,
    );
    torso.position.y = 1.21;
    torso.castShadow = true;
    this.#trunk.add(torso);

    const head = new THREE.Mesh(new THREE.SphereGeometry(0.19, 16, 12), this.bodyMaterial);
    head.position.y = 1.68;
    head.castShadow = true;
    this.#trunk.add(head);

    const upperLegs = {} as Record<'left' | 'right', THREE.Mesh>;
    const lowerLegs = {} as Record<'left' | 'right', THREE.Mesh>;
    const boots = {} as Record<'left' | 'right', THREE.Mesh>;
    for (const foot of FEET) {
      upperLegs[foot] = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.11, 1, 10), this.bodyMaterial);
      lowerLegs[foot] = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.075, 1, 10), this.bodyMaterial);
      boots[foot] = new THREE.Mesh(
        new THREE.BoxGeometry(
          PLAYER_VISUAL_LAYOUT.footWidth,
          PLAYER_VISUAL_LAYOUT.footHeight,
          PLAYER_VISUAL_LAYOUT.footLength,
        ),
        bootMaterial,
      );
      upperLegs[foot].castShadow = true;
      lowerLegs[foot].castShadow = true;
      boots[foot].castShadow = true;
      this.group.add(upperLegs[foot], lowerLegs[foot], boots[foot]);
    }
    this.#upperLegs = upperLegs;
    this.#lowerLegs = lowerLegs;
    this.#boots = boots;
    scene.add(this.group);
  }

  update(input: Readonly<ProceduralAthleteInput>): ProceduralAthletePose {
    const { player, plan } = input;
    const alpha = clamp(input.interpolationAlpha, 0, 1);
    if (!this.#yawInitialized) {
      this.#yawInitialized = true;
      this.#yawFrom = player.facingYaw;
      this.#yawTo = player.facingYaw;
      this.#lastSimulationTick = input.simulationTick;
    } else if (input.simulationTick !== this.#lastSimulationTick) {
      this.#yawFrom = this.#yawTo;
      this.#yawTo = player.facingYaw;
      this.#lastSimulationTick = input.simulationTick;
    }
    const displayYaw = interpolateYaw(this.#yawFrom, this.#yawTo, alpha);

    this.group.position.set(player.position.x, player.position.y, player.position.z);
    this.group.rotation.y = displayYaw;
    this.group.updateMatrixWorld(true);

    this.#trunk.rotation.x = -clamp(player.athleticMotion.bodyLean.forward, -1, 1) * 0.16;
    this.#trunk.rotation.z = clamp(player.athleticMotion.bodyLean.lateral, -1, 1) * 0.14;
    this.#trunk.position.y = -player.athleticMotion.plantIntensity * 0.035;

    const feet = this.#buildFootPositions(input, alpha, displayYaw);
    const supportFoot = player.athleticMotion.gait !== 'idle'
      && player.athleticMotion.supportFoot !== 'both'
      ? player.athleticMotion.supportFoot
      : null;
    let plantedFootSlideMeters = 0;
    if (supportFoot) {
      const natural = feet[supportFoot]!;
      if (!this.#plantLock || this.#plantLock.foot !== supportFoot) {
        this.#plantLock = { foot: supportFoot, worldPosition: natural.clone() };
      } else if (natural.distanceTo(this.#plantLock.worldPosition) > MAX_STANCE_STRETCH) {
        // Never stretch a leg indefinitely just to satisfy a presentation lock.
        // The authoritative root keeps moving; presentation releases/replants.
        this.#plantLock = { foot: supportFoot, worldPosition: natural.clone() };
        this.#lastPlantPosition = null;
      }
      feet[supportFoot] = this.#plantLock.worldPosition.clone();
      if (this.#lastPlantPosition) {
        plantedFootSlideMeters = feet[supportFoot].distanceTo(this.#lastPlantPosition);
      }
      this.#lastPlantPosition = feet[supportFoot].clone();
    } else {
      this.#plantLock = null;
      this.#lastPlantPosition = null;
    }

    let contactVisible = false;
    let contactErrorMeters = 0;
    if (plan) {
      const contactFoot = plan.foot;
      const base = feet[contactFoot]!;
      const target = new THREE.Vector3(
        plan.expectedFootPoint.x,
        plan.expectedFootPoint.y,
        plan.expectedFootPoint.z,
      );
      const reach = base.distanceTo(target);
      const windowStart = plan.prepareTick;
      const contactProgress = plan.contactTick <= windowStart
        ? 1
        : clamp((input.simulationTick + alpha - windowStart) / (plan.contactTick - windowStart), 0, 1);
      const smoothProgress = contactProgress * contactProgress * (3 - 2 * contactProgress);
      contactErrorMeters = reach;
      if (reach <= PRESENTATION_WARP_REACH && input.simulationTick <= plan.contactTick + plan.timingWindowTicks) {
        feet[contactFoot] = base.clone().lerp(target, smoothProgress);
        contactVisible = true;
        contactErrorMeters = feet[contactFoot].distanceTo(target);
      }
      this.pose.contactFoot = contactFoot;
      this.pose.contactTick = plan.contactTick;
    } else {
      this.pose.contactFoot = null;
      this.pose.contactTick = null;
    }

    this.#footPositions = feet;
    this.#syncLegsAndBoots(feet, input, displayYaw);
    this.pose.contactVisible = contactVisible;
    this.pose.contactErrorMeters = contactErrorMeters;
    this.pose.supportFoot = supportFoot;
    this.pose.plantedFootSlideMeters = plantedFootSlideMeters;
    return this.pose;
  }

  getFootWorldPosition(foot: Exclude<FootballFoot, 'both'>): THREE.Vector3 {
    return this.#footPositions[foot]!.clone();
  }

  dispose(): void {
    this.group.removeFromParent();
    this.group.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      object.geometry.dispose();
      if (Array.isArray(object.material)) object.material.forEach((material) => material.dispose());
      else object.material.dispose();
    });
  }

  #buildFootPositions(input: Readonly<ProceduralAthleteInput>, alpha: number, displayYaw: number): FootPositions {
    const { player } = input;
    const motion = player.athleticMotion;
    const speed = Math.hypot(motion.plannedVelocity.x, motion.plannedVelocity.z);
    const strideLength = clamp(speed * motion.strideSeconds * 0.62, 0.08, 0.72);
    const phase = (motion.gaitPhase + alpha / 60 / Math.max(0.2, motion.strideSeconds)) % 1;
    const travelYaw = speed > 0.18 ? Math.atan2(motion.plannedVelocity.x, motion.plannedVelocity.z) : displayYaw;
    const travelRelativeYaw = angleDelta(displayYaw, travelYaw);
    const forwardStride = Math.cos(travelRelativeYaw);
    const lateralStride = Math.sin(travelRelativeYaw);
    const positions = {} as FootPositions;
    for (const foot of FEET) {
      const footPhase = (phase + (foot === 'left' ? 0.5 : 0)) % 1;
      const swing = Math.sin(footPhase * Math.PI * 2);
      const local = new THREE.Vector3(
        (foot === 'left' ? -PLAYER_VISUAL_LAYOUT.legOffsetX : PLAYER_VISUAL_LAYOUT.legOffsetX)
          + swing * strideLength * 0.20 * lateralStride,
        PLAYER_VISUAL_LAYOUT.footCenterY + Math.max(0, swing) * 0.075,
        PLAYER_VISUAL_LAYOUT.footForward + swing * strideLength * 0.28 * forwardStride,
      );
      positions[foot] = localToWorld(
        new THREE.Vector3(player.position.x, player.position.y, player.position.z),
        local,
        displayYaw,
      );
    }

    return positions;
  }

  #syncLegsAndBoots(feet: FootPositions, input: Readonly<ProceduralAthleteInput>, displayYaw: number): void {
    this.group.updateMatrixWorld(true);
    for (const foot of FEET) {
      const side = foot === 'left' ? -1 : 1;
      const hip = new THREE.Vector3(side * PLAYER_VISUAL_LAYOUT.legOffsetX, 0.91, 0);
      const bootWorld = feet[foot]!;
      const ankleWorld = bootWorld.clone().add(new THREE.Vector3(0, 0.075, -0.015).applyAxisAngle(UP, displayYaw));
      const hipWorld = hip.clone().applyMatrix4(this.group.matrixWorld);
      const ankleLocal = ankleWorld.clone();
      this.group.worldToLocal(ankleLocal);
      const hipLocal = this.group.worldToLocal(hipWorld.clone());
      const phase = input.player.athleticMotion.gaitPhase + (foot === 'left' ? 0.5 : 0);
      const kneeLocal = hipLocal.clone().lerp(ankleLocal, 0.52);
      kneeLocal.y += 0.035;
      kneeLocal.z += Math.sin(phase * Math.PI * 2) * 0.045;
      segmentBetween(this.#upperLegs[foot], hipLocal, kneeLocal);
      segmentBetween(this.#lowerLegs[foot], kneeLocal, ankleLocal);
      this.#boots[foot].position.copy(this.group.worldToLocal(bootWorld.clone()));
    }
  }
}
