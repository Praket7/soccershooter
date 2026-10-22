import * as THREE from 'three';
import type { FootballContactPlan } from '../../../../packages/sim/src/football/contactPlan';
import type { FootballFoot } from '../../../../packages/sim/src/football/types';
import type { PlayerState } from '../../../../packages/sim/src/player/PlayerState';
import { PLAYER_VISUAL_LAYOUT } from './PlayerVisualLayout';

export interface ProceduralAthleteInput {
  player: Pick<PlayerState, 'position' | 'velocity' | 'facingYaw' | 'athleticMotion'>;
  plan?: Readonly<FootballContactPlan> | null;
  stepOver?: Readonly<{
    kind: 'stepover' | 'elastico';
    startTick: number;
    contactTick: number;
    endTick: number;
    feintFoot: 'left' | 'right';
    exitFoot: 'left' | 'right';
  }> | null;
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
const MAX_STANCE_STRETCH = 0.24;
const MAX_REPLANT_STEP = 0.025;
const UPPER_LEG_LENGTH = 0.525;
const LOWER_LEG_LENGTH = 0.525;
const MAX_LEG_REACH = UPPER_LEG_LENGTH + LOWER_LEG_LENGTH;
const ANKLE_FROM_FOOT_CENTER = new THREE.Vector3(0, 0.075, -0.07);
const FOOT_CENTER_FROM_CONTACT = new THREE.Vector3(0, 0, -PLAYER_VISUAL_LAYOUT.footLength / 2);
const VISUAL_CONTACT_APPROACH_TICKS = 18;
const MAX_FOOT_STEP_PER_TICK = 0.075;
const MAX_SKILL_FOOT_STEP_PER_TICK = 0.14;
const PRESENTATION_TICK_SECONDS = 1 / 60;
const BODY_TURN_ANGULAR_ACCELERATION = 20;
const UP = new THREE.Vector3(0, 1, 0);
const BODY_COLOR = 0x76243d;
const SHORTS_COLOR = 0x142b46;
const SKIN_COLOR = 0xc78357;
const HAIR_COLOR = 0x30231d;
const SOCK_COLOR = 0xe8edf2;
const BOOT_COLOR = 0x10202a;
const KIT_TRIM_COLOR = 0xd8d2c6;
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

function moveToward(current: number, target: number, maxDelta: number): number {
  const delta = target - current;
  if (Math.abs(delta) <= maxDelta) return target;
  return current + Math.sign(delta) * maxDelta;
}

function smoothstep(value: number): number {
  const t = clamp(value, 0, 1);
  return t * t * (3 - 2 * t);
}

function catmullRom(points: readonly THREE.Vector3[], progress: number): THREE.Vector3 {
  const scaled = clamp(progress, 0, 1) * (points.length - 1);
  const index = Math.min(points.length - 2, Math.floor(scaled));
  const t = scaled - index;
  const p0 = points[Math.max(0, index - 1)]!;
  const p1 = points[index]!;
  const p2 = points[index + 1]!;
  const p3 = points[Math.min(points.length - 1, index + 2)]!;
  const t2 = t * t;
  const t3 = t2 * t;
  return new THREE.Vector3(
    0.5 * ((2 * p1.x) + (-p0.x + p2.x) * t + (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 + (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3),
    0.5 * ((2 * p1.y) + (-p0.y + p2.y) * t + (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 + (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3),
    0.5 * ((2 * p1.z) + (-p0.z + p2.z) * t + (2 * p0.z - 5 * p1.z + 4 * p2.z - p3.z) * t2 + (-p0.z + 3 * p1.z - 3 * p2.z + p3.z) * t3),
  );
}

function presentationFacingYaw(
  player: ProceduralAthleteInput['player'],
): number {
  if (player.athleticMotion.strikePreparation) return player.facingYaw;
  // Body heading is already accelerated and planted by the movement model.
  // Switching to travel yaw near alignment introduces a visible snap at the
  // old 0.35 rad threshold and makes the hips skate independently of the turn.
  return player.athleticMotion.bodyYaw;
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

function unitLimbGeometry(radius: number, cylinderLength: number, capSegments: number, radialSegments: number): THREE.CapsuleGeometry {
  const geometry = new THREE.CapsuleGeometry(radius, cylinderLength, capSegments, radialSegments);
  geometry.computeBoundingBox();
  const length = geometry.boundingBox!.getSize(new THREE.Vector3()).y;
  geometry.scale(1, 1 / length, 1);
  return geometry;
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
  readonly #head = new THREE.Group();
  readonly #pelvis: THREE.Mesh;
  readonly #shoulders: Record<'left' | 'right', THREE.Mesh>;
  readonly #elbows: Record<'left' | 'right', THREE.Mesh>;
  readonly #hands: Record<'left' | 'right', THREE.Mesh>;
  readonly #socks: Record<'left' | 'right', THREE.Mesh>;
  readonly #upperLegs: Record<'left' | 'right', THREE.Mesh>;
  readonly #lowerLegs: Record<'left' | 'right', THREE.Mesh>;
  readonly #upperArms: Record<'left' | 'right', THREE.Mesh>;
  readonly #lowerArms: Record<'left' | 'right', THREE.Mesh>;
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
  #yawRate = 0;
  #lastSimulationTick = -1;
  #lastFootTick = -1;
  #footPoseInitialized = false;
  #lastPlayerPosition: THREE.Vector3 | null = null;

  constructor(scene: THREE.Scene) {
    this.group = new THREE.Group();
    this.group.name = 'stage05r-procedural-athlete-proxy';
    this.group.userData.proceduralAthleteProxy = true;
    this.#trunk.name = 'athlete-trunk';
    this.group.add(this.#trunk);

    const shortsMaterial = new THREE.MeshStandardMaterial({ color: SHORTS_COLOR, roughness: 0.76 });
    const skinMaterial = new THREE.MeshStandardMaterial({ color: SKIN_COLOR, roughness: 0.72 });
    const hairMaterial = new THREE.MeshStandardMaterial({ color: HAIR_COLOR, roughness: 0.82 });
    const sockMaterial = new THREE.MeshStandardMaterial({ color: SOCK_COLOR, roughness: 0.8 });
    const bootMaterial = new THREE.MeshStandardMaterial({ color: BOOT_COLOR, roughness: 0.8 });
    const kitTrimMaterial = new THREE.MeshStandardMaterial({ color: KIT_TRIM_COLOR, roughness: 0.74 });
    kitTrimMaterial.side = THREE.DoubleSide;
    this.#pelvis = new THREE.Mesh(new THREE.CapsuleGeometry(0.20, 0.19, 4, 10), shortsMaterial);
    this.#pelvis.name = 'athlete-pelvis';
    this.#pelvis.position.y = 0.91;
    this.#pelvis.castShadow = true;
    this.#trunk.add(this.#pelvis);
    const shorts = new THREE.Mesh(new THREE.CapsuleGeometry(0.205, 0.17, 4, 10), shortsMaterial);
    shorts.name = 'athlete-shorts';
    shorts.position.y = 0.91;
    shorts.castShadow = true;
    this.#trunk.add(shorts);

    const torso = new THREE.Mesh(new THREE.LatheGeometry([
      new THREE.Vector2(0.205, 0),
      new THREE.Vector2(0.22, 0.06),
      new THREE.Vector2(0.215, 0.19),
      new THREE.Vector2(0.235, 0.34),
      new THREE.Vector2(0.285, 0.50),
      new THREE.Vector2(0.315, 0.64),
      new THREE.Vector2(0.285, 0.73),
      new THREE.Vector2(0.145, 0.80),
    ], 32), this.bodyMaterial);
    torso.name = 'athlete-torso';
    torso.position.y = 0.87;
    torso.castShadow = true;
    this.#trunk.add(torso);

    const collar = new THREE.Mesh(new THREE.TorusGeometry(0.082, 0.014, 8, 28), kitTrimMaterial);
    collar.name = 'athlete-jersey-collar';
    collar.rotation.x = Math.PI / 2;
    collar.position.set(0, 1.615, 0);
    collar.castShadow = true;
    this.#trunk.add(collar);

    // A restrained back number and shoulder seams add football-kit structure
    // to the gameplay-facing side without introducing a texture atlas or draw
    // call per garment detail.
    const numberShape = new THREE.Shape();
    numberShape.moveTo(-0.07, 0.115);
    numberShape.lineTo(0.07, 0.115);
    numberShape.lineTo(0.07, 0.075);
    numberShape.lineTo(0.012, 0.075);
    numberShape.lineTo(-0.038, -0.115);
    numberShape.lineTo(-0.081, -0.115);
    numberShape.lineTo(-0.027, 0.075);
    numberShape.lineTo(-0.07, 0.075);
    numberShape.closePath();
    const numberGeometry = new THREE.ShapeGeometry(numberShape);
    const numberPositions = numberGeometry.getAttribute('position');
    for (let index = 0; index < numberPositions.count; index += 1) {
      const y = 1.35 + numberPositions.getY(index);
      const backRadius = y < 1.37
        ? 0.235 + clamp((y - 1.23) / 0.14, 0, 1) * 0.05
        : 0.285 + clamp((y - 1.37) / 0.14, 0, 1) * 0.03;
      numberPositions.setY(index, y);
      numberPositions.setZ(index, -backRadius - 0.004);
    }
    numberGeometry.computeVertexNormals();
    const backNumber = new THREE.Mesh(numberGeometry, kitTrimMaterial);
    backNumber.name = 'athlete-back-number';
    backNumber.castShadow = true;
    this.#trunk.add(backNumber);
    for (const side of ['left', 'right'] as const) {
      const sign = side === 'left' ? -1 : 1;
      const seamPath = new THREE.CatmullRomCurve3([
        new THREE.Vector3(sign * 0.17, 1.59, -0.15),
        new THREE.Vector3(sign * 0.25, 1.555, -0.17),
        new THREE.Vector3(sign * 0.30, 1.48, -0.12),
      ]);
      const seam = new THREE.Mesh(new THREE.TubeGeometry(seamPath, 8, 0.008, 5, false), kitTrimMaterial);
      seam.name = `athlete-${side}-shoulder-seam`;
      this.#trunk.add(seam);
    }

    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.067, 0.082, 0.14, 12), skinMaterial);
    neck.name = 'athlete-neck';
    neck.position.y = 1.52;
    neck.castShadow = true;
    this.#head.name = 'stepover-head';
    this.#head.position.y = 1.54;
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.17, 20, 16), skinMaterial);
    head.name = 'athlete-head';
    head.position.y = 0.14;
    head.castShadow = true;
    this.#head.add(head);
    const hair = new THREE.Mesh(new THREE.SphereGeometry(0.173, 20, 12, 0, TAU, 0, Math.PI * 0.48), hairMaterial);
    hair.name = 'athlete-hair';
    hair.position.y = 0.18;
    hair.castShadow = true;
    this.#head.add(hair);
    const faceMaterial = new THREE.MeshStandardMaterial({ color: 0x211914, roughness: 0.56 });
    for (const side of ['left', 'right'] as const) {
      const sign = side === 'left' ? -1 : 1;
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.018, 8, 8), faceMaterial);
      eye.name = `athlete-${side}-eye`;
      eye.position.set(sign * 0.057, 0.155, 0.15);
      this.#head.add(eye);
      const ear = new THREE.Mesh(new THREE.SphereGeometry(0.038, 10, 10), skinMaterial);
      ear.name = `athlete-${side}-ear`;
      ear.position.set(sign * 0.165, 0.12, 0.01);
      this.#head.add(ear);
    }
    const nose = new THREE.Mesh(new THREE.SphereGeometry(0.027, 10, 8), skinMaterial);
    nose.name = 'athlete-nose';
    nose.scale.set(0.72, 0.82, 1.1);
    nose.position.set(0, 0.115, 0.17);
    this.#head.add(nose);
    this.#trunk.add(neck, this.#head);

    const upperLegs = {} as Record<'left' | 'right', THREE.Mesh>;
    const lowerLegs = {} as Record<'left' | 'right', THREE.Mesh>;
    const upperArms = {} as Record<'left' | 'right', THREE.Mesh>;
    const lowerArms = {} as Record<'left' | 'right', THREE.Mesh>;
    const boots = {} as Record<'left' | 'right', THREE.Mesh>;
    const shoulders = {} as Record<'left' | 'right', THREE.Mesh>;
    const elbows = {} as Record<'left' | 'right', THREE.Mesh>;
    const hands = {} as Record<'left' | 'right', THREE.Mesh>;
    const socks = {} as Record<'left' | 'right', THREE.Mesh>;
    for (const foot of FEET) {
      upperLegs[foot] = new THREE.Mesh(unitLimbGeometry(0.075, 0.42, 4, 8), skinMaterial);
      lowerLegs[foot] = new THREE.Mesh(unitLimbGeometry(0.052, 0.38, 4, 8), skinMaterial);
      upperLegs[foot].name = `${foot}-upper-leg`;
      lowerLegs[foot].name = `${foot}-lower-leg`;
      boots[foot] = new THREE.Mesh(
        new THREE.CapsuleGeometry(PLAYER_VISUAL_LAYOUT.footHeight * 0.48, PLAYER_VISUAL_LAYOUT.footLength * 0.62, 3, 8),
        bootMaterial,
      );
      boots[foot].geometry.rotateX(Math.PI / 2);
      boots[foot].scale.x = PLAYER_VISUAL_LAYOUT.footWidth / (PLAYER_VISUAL_LAYOUT.footHeight * 0.96);
      socks[foot] = new THREE.Mesh(new THREE.CapsuleGeometry(0.057, 0.20, 4, 8), sockMaterial);
      socks[foot].name = `${foot}-sock`;
      shoulders[foot] = new THREE.Mesh(new THREE.SphereGeometry(0.115, 14, 12), this.bodyMaterial);
      shoulders[foot].name = `${foot}-shoulder`;
      elbows[foot] = new THREE.Mesh(new THREE.SphereGeometry(0.052, 10, 8), skinMaterial);
      elbows[foot].name = `${foot}-elbow`;
      hands[foot] = new THREE.Mesh(new THREE.SphereGeometry(0.065, 12, 10), skinMaterial);
      hands[foot].name = `${foot}-hand`;
      upperLegs[foot].castShadow = true;
      lowerLegs[foot].castShadow = true;
      boots[foot].castShadow = true;
      upperArms[foot] = new THREE.Mesh(unitLimbGeometry(0.062, 0.31, 5, 12), this.bodyMaterial);
      lowerArms[foot] = new THREE.Mesh(unitLimbGeometry(0.038, 0.29, 4, 8), skinMaterial);
      upperArms[foot].name = `${foot}-upper-arm`;
      lowerArms[foot].name = `${foot}-lower-arm`;
      upperArms[foot].castShadow = true;
      lowerArms[foot].castShadow = true;
      this.group.add(upperLegs[foot], lowerLegs[foot], socks[foot], boots[foot], upperArms[foot], lowerArms[foot], shoulders[foot], elbows[foot], hands[foot]);
    }
    this.#upperLegs = upperLegs;
    this.#lowerLegs = lowerLegs;
    this.#upperArms = upperArms;
    this.#lowerArms = lowerArms;
    this.#boots = boots;
    this.#shoulders = shoulders;
    this.#elbows = elbows;
    this.#hands = hands;
    this.#socks = socks;
    scene.add(this.group);
  }

  update(input: Readonly<ProceduralAthleteInput>): ProceduralAthletePose {
    const { player, plan } = input;
    const alpha = clamp(input.interpolationAlpha, 0, 1);
    const targetDisplayYaw = presentationFacingYaw(player);
    if (!this.#yawInitialized) {
      this.#yawInitialized = true;
      this.#yawFrom = targetDisplayYaw;
      this.#yawTo = targetDisplayYaw;
      this.#lastSimulationTick = input.simulationTick;
    } else if (input.simulationTick !== this.#lastSimulationTick) {
      this.#yawFrom = this.#yawTo;
      if (player.athleticMotion.strikePreparation) {
        const elapsedTicks = clamp(input.simulationTick - this.#lastSimulationTick, 1, 6);
        const speed = Math.hypot(player.velocity.x, player.velocity.z);
        const turnRateLimit = 7.6
          - clamp(speed / 8.8, 0, 1) * 2.8
          + clamp(player.athleticMotion.plantIntensity, 0, 1) * 0.8;
        for (let tick = 0; tick < elapsedTicks; tick += 1) {
          const error = angleDelta(this.#yawTo, targetDisplayYaw);
          const stoppingLimitedRate = Math.sqrt(2 * BODY_TURN_ANGULAR_ACCELERATION * Math.abs(error));
          const desiredRate = Math.sign(error) * Math.min(turnRateLimit, stoppingLimitedRate);
          this.#yawRate = moveToward(
            this.#yawRate,
            desiredRate,
            BODY_TURN_ANGULAR_ACCELERATION * PRESENTATION_TICK_SECONDS,
          );
          const yawStep = this.#yawRate * PRESENTATION_TICK_SECONDS;
          if (Math.sign(yawStep) === Math.sign(error) && Math.abs(yawStep) >= Math.abs(error)) {
            this.#yawTo = targetDisplayYaw;
            this.#yawRate = 0;
          } else {
            this.#yawTo += yawStep;
          }
        }
      } else {
        this.#yawFrom = targetDisplayYaw;
        this.#yawTo = targetDisplayYaw;
        this.#yawRate = player.athleticMotion.bodyYawRate;
      }
      this.#lastSimulationTick = input.simulationTick;
    }
    const displayYaw = player.athleticMotion.strikePreparation
      ? interpolateYaw(this.#yawFrom, this.#yawTo, alpha)
      : targetDisplayYaw;

    this.group.position.set(player.position.x, player.position.y, player.position.z);
    this.group.rotation.y = displayYaw;
    this.group.updateMatrixWorld(true);
    const playerPosition = new THREE.Vector3(player.position.x, player.position.y, player.position.z);
    const rootTranslation = this.#lastPlayerPosition
      ? playerPosition.clone().sub(this.#lastPlayerPosition)
      : new THREE.Vector3();
    this.#lastPlayerPosition = playerPosition;

    this.#trunk.rotation.x = clamp(player.athleticMotion.bodyLean.forward, -1, 1) * 0.16;
    const stepOverElapsed = input.stepOver
      ? input.simulationTick + alpha - input.stepOver.startTick
      : -1;
    const stepOverDuration = input.stepOver ? Math.max(1, input.stepOver.contactTick - input.stepOver.startTick) : 1;
    const feintProgress = input.stepOver ? clamp(stepOverElapsed / stepOverDuration, 0, 1) : 0;
    const exitDuration = input.stepOver ? Math.max(1, input.stepOver.endTick - input.stepOver.contactTick) : 1;
    const exitProgress = input.stepOver
      ? clamp((stepOverElapsed - stepOverDuration) / exitDuration, 0, 1)
      : 0;
    const wholeMoveProgress = input.stepOver
      ? clamp(stepOverElapsed / Math.max(1, input.stepOver.contactTick - input.stepOver.startTick), 0, 1)
      : 0;
    const feintWeight = input.stepOver && stepOverElapsed >= 0 && stepOverElapsed <= stepOverDuration
      ? Math.sin(Math.PI * feintProgress) ** 2
      : 0;
    const exitWeight = input.stepOver && stepOverElapsed > stepOverDuration
      ? Math.sin(Math.PI * exitProgress) ** 2
      : 0;
    const bodyFeint = !input.stepOver || stepOverElapsed < 0 || stepOverElapsed > input.stepOver.endTick - input.stepOver.startTick
      ? 0
      : wholeMoveProgress < 0.34
        ? smoothstep(wholeMoveProgress / 0.34)
        : wholeMoveProgress < 0.72
          ? 1 - 1.7 * smoothstep((wholeMoveProgress - 0.34) / 0.38)
          : -0.7 * (1 - smoothstep((wholeMoveProgress - 0.72) / 0.28));
    const feintSide = input.stepOver?.feintFoot === 'left' ? -1 : 1;
    const motion = player.athleticMotion;
    const turnCounter = clamp(motion.bodyYawRate * 0.018, -0.12, 0.12);
    this.#trunk.rotation.z = -clamp(motion.bodyLean.lateral, -1, 1) * 0.14
      + clamp(motion.turnDemand, -1, 1) * motion.plantIntensity * 0.06
      - feintSide * bodyFeint * 0.30;
    this.#trunk.rotation.y = -turnCounter + feintSide * (bodyFeint * 0.18);
    this.#pelvis.rotation.y = turnCounter * 0.68;
    this.#pelvis.rotation.z = clamp(motion.bodyLean.lateral, -1, 1) * 0.035;
    this.#pelvis.rotation.x = clamp(motion.bodyLean.forward, -1, 1) * 0.025;
    this.#trunk.position.y = -player.athleticMotion.plantIntensity * 0.055 - Math.abs(bodyFeint) * 0.075
      + (input.stepOver?.kind === 'elastico' ? 0 : exitWeight * 0.02);
    this.#head.rotation.x = -this.#trunk.rotation.x * 0.42;
    this.#head.rotation.y = -this.#trunk.rotation.y * 0.58;
    this.#head.rotation.z = -this.#trunk.rotation.z * 0.46;

    const feet = this.#buildFootPositions(input, alpha, displayYaw);
    const elapsedFootTicks = this.#lastFootTick < 0
      ? 6
      : clamp(input.simulationTick - this.#lastFootTick, 1, 6);
    if (!this.#footPoseInitialized) {
      this.#footPoseInitialized = true;
      this.#footPositions = { left: feet.left.clone(), right: feet.right.clone() };
    } else {
      for (const foot of FEET) {
        // Foot positions live in world space. Carry a swing foot along with
        // the translating pelvis before limiting its gait-relative stride;
        // otherwise the per-tick foot cap is lower than sprint root speed and
        // the boot visibly drags behind the runner.
        this.#footPositions[foot]!.add(rootTranslation);
        const skillFoot = input.stepOver?.feintFoot === foot;
        const maxStep = skillFoot ? MAX_SKILL_FOOT_STEP_PER_TICK : MAX_FOOT_STEP_PER_TICK;
        feet[foot] = this.#moveFootToward(foot, feet[foot]!, maxStep * elapsedFootTicks);
      }
    }
    let supportFoot = player.athleticMotion.gait !== 'idle'
      && player.athleticMotion.supportFoot !== 'both'
      ? player.athleticMotion.supportFoot
      : null;
    if (input.stepOver && stepOverElapsed >= 0 && stepOverElapsed <= input.stepOver.endTick - input.stepOver.startTick) {
      // The supporting leg is explicit even from a dead stop. Without this,
      // an idle gait leaves both feet free and the whole trick reads as a
      // floating mannequin swing instead of a planted football action.
      supportFoot = wholeMoveProgress < 0.78 ? input.stepOver.exitFoot : input.stepOver.feintFoot;
    }
    let plantedFootSlideMeters = 0;
    if (supportFoot) {
      const natural = feet[supportFoot]!;
      if (!this.#plantLock || this.#plantLock.foot !== supportFoot) {
        // A foot entering stance must land on the turf. Gait phase can cross
        // into stance while its unconstrained swing arc is still elevated.
        natural.y = player.position.y + PLAYER_VISUAL_LAYOUT.footCenterY;
        this.#plantLock = { foot: supportFoot, worldPosition: natural.clone() };
      } else if (natural.distanceTo(this.#plantLock.worldPosition) > MAX_STANCE_STRETCH) {
        // Release a strained stance progressively. Snapping straight to the
        // unconstrained swing pose makes the boot jump across the turf on cuts.
        const release = natural.clone().sub(this.#plantLock.worldPosition);
        this.#plantLock.worldPosition.add(release.setLength(Math.min(MAX_REPLANT_STEP, release.length())));
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
    let contactTargetReachable = false;
    let contactTarget: THREE.Vector3 | null = null;
    if (plan) {
      const contactFoot = plan.foot;
      const base = feet[contactFoot]!;
      const target = new THREE.Vector3(
        plan.expectedFootPoint.x,
        plan.expectedFootPoint.y,
        plan.expectedFootPoint.z,
      );
      contactTarget = target;
      const targetBootCenter = target.clone().add(FOOT_CENTER_FROM_CONTACT.clone().applyAxisAngle(UP, displayYaw));
      const reach = base.distanceTo(targetBootCenter);
      const side = contactFoot === 'left' ? -1 : 1;
      const hipWorld = this.#trunk.localToWorld(new THREE.Vector3(side * PLAYER_VISUAL_LAYOUT.legOffsetX, 0.91, 0));
      const hip = this.group.worldToLocal(hipWorld);
      const targetAnkle = this.group.worldToLocal(targetBootCenter.clone()).add(ANKLE_FROM_FOOT_CENTER);
      const targetLegDistance = targetAnkle.distanceTo(hip);
      contactTargetReachable = targetLegDistance <= MAX_LEG_REACH && targetLegDistance >= Math.abs(UPPER_LEG_LENGTH - LOWER_LEG_LENGTH);
      const approachStart = Math.min(plan.prepareTick, plan.contactTick - VISUAL_CONTACT_APPROACH_TICKS);
      const contactProgress = plan.contactTick <= approachStart
        ? 1
        : clamp((input.simulationTick + alpha - approachStart) / (plan.contactTick - approachStart), 0, 1);
      const smoothProgress = contactProgress * contactProgress * (3 - 2 * contactProgress);
      contactErrorMeters = reach;
      if (contactTargetReachable
        && reach <= PRESENTATION_WARP_REACH
        && input.simulationTick <= plan.contactTick + plan.timingWindowTicks) {
        const contactApproach = base.clone().lerp(targetBootCenter, smoothProgress);
        feet[contactFoot] = this.#moveFootToward(contactFoot, contactApproach, MAX_FOOT_STEP_PER_TICK * elapsedFootTicks);
      }
      this.pose.contactFoot = contactFoot;
      this.pose.contactTick = plan.contactTick;
    } else {
      this.pose.contactFoot = null;
      this.pose.contactTick = null;
    }

    this.#footPositions = feet;
    this.#syncLegsAndBoots(feet, input, displayYaw);
    if (plan && contactTarget) {
      contactErrorMeters = this.getFootContactWorldPosition(plan.foot).distanceTo(contactTarget);
      contactVisible = contactTargetReachable
        && input.simulationTick <= plan.contactTick + plan.timingWindowTicks
        && contactErrorMeters <= plan.geometryTolerance;
    }
    this.#footPositions = feet;
    this.pose.contactVisible = contactVisible;
    this.pose.contactErrorMeters = contactErrorMeters;
    this.pose.supportFoot = supportFoot;
    this.pose.plantedFootSlideMeters = plantedFootSlideMeters;
    this.#lastFootTick = input.simulationTick;
    return this.pose;
  }

  #moveFootToward(foot: PlayerFoot, target: THREE.Vector3, maxDistance: number): THREE.Vector3 {
    const previous = this.#footPositions[foot]!;
    const delta = target.clone().sub(previous);
    if (delta.length() <= maxDistance) return target.clone();
    return previous.clone().add(delta.setLength(maxDistance));
  }

  getFootWorldPosition(foot: Exclude<FootballFoot, 'both'>): THREE.Vector3 {
    return this.#footPositions[foot]!.clone();
  }

  getFootContactWorldPosition(foot: Exclude<FootballFoot, 'both'>): THREE.Vector3 {
    return this.#footPositions[foot]!.clone().add(
      new THREE.Vector3(0, 0, PLAYER_VISUAL_LAYOUT.footLength / 2).applyAxisAngle(UP, this.group.rotation.y),
    );
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
    const speed = Math.hypot(player.velocity.x, player.velocity.z);
    const strideLength = clamp(speed * motion.strideSeconds * 0.62, 0.08, 0.72);
    const phase = (motion.gaitPhase + alpha / 60 / Math.max(0.2, motion.strideSeconds)) % 1;
    const travelYaw = speed > 0.18 ? Math.atan2(player.velocity.x, player.velocity.z) : displayYaw;
    const travelRelativeYaw = angleDelta(displayYaw, travelYaw);
    const forwardStride = Math.cos(travelRelativeYaw);
    const lateralStride = Math.sin(travelRelativeYaw);
    const positions = {} as FootPositions;
    const localPositions = {} as Record<PlayerFoot, THREE.Vector3>;
    for (const foot of FEET) {
      const footPhase = (phase + (foot === 'left' ? 0.5 : 0)) % 1;
      const swing = Math.sin(footPhase * Math.PI * 2);
      const local = new THREE.Vector3(
        (foot === 'left' ? -PLAYER_VISUAL_LAYOUT.legOffsetX : PLAYER_VISUAL_LAYOUT.legOffsetX)
          + swing * strideLength * 0.20 * lateralStride,
        PLAYER_VISUAL_LAYOUT.footCenterY + Math.max(0, swing) * 0.14,
        PLAYER_VISUAL_LAYOUT.footForward + swing * strideLength * 0.32 * forwardStride,
      );
      localPositions[foot] = local;
      positions[foot] = localToWorld(
        new THREE.Vector3(player.position.x, player.position.y, player.position.z),
        local,
        displayYaw,
      );
    }

    const cue = input.stepOver;
    if (cue) {
      const elapsed = input.simulationTick + alpha - cue.startTick;
      const duration = Math.max(1, cue.contactTick - cue.startTick);
      const contactDuration = Math.max(1, cue.contactTick - cue.startTick);
      const progress = clamp(elapsed / contactDuration, 0, 1);
      const side = cue.feintFoot === 'left' ? -1 : 1;
      const base = localPositions[cue.feintFoot];
      const points = cue.kind === 'stepover'
        ? [
          base.clone(),
          new THREE.Vector3(-side * 0.25, base.y, 0.40),
          new THREE.Vector3(-side * 0.30, base.y, 0.55),
          new THREE.Vector3(side * 0.32, base.y, 0.55),
          new THREE.Vector3(side * 0.28, base.y, 0.40),
        ]
        : [
          base.clone(),
          new THREE.Vector3(side * 0.22, base.y, 0.25),
          new THREE.Vector3(side * 0.28, base.y, 0.36),
          new THREE.Vector3(-side * 0.28, base.y, 0.38),
          new THREE.Vector3(-side * 0.22, base.y, 0.18),
        ];
      const feint = catmullRom(points, progress);
      // A low, compact knee lift over the ball: the move reads from the ankle
      // path and hip turn, without the exaggerated high-step that looks staged.
      feint.y += Math.sin(Math.PI * progress) * (cue.kind === 'stepover' ? 0.18 : 0.11);
      positions[cue.feintFoot] = localToWorld(
        new THREE.Vector3(input.player.position.x, input.player.position.y, input.player.position.z),
        feint,
        displayYaw,
      );
    }

    return positions;
  }

  #syncLegsAndBoots(feet: FootPositions, input: Readonly<ProceduralAthleteInput>, displayYaw: number): void {
    this.group.updateMatrixWorld(true);
    const motion = input.player.athleticMotion;
    const armSwing = Math.sin(motion.gaitPhase * TAU) * clamp(
      Math.hypot(input.player.velocity.x, input.player.velocity.z) / 6.5,
      0,
      1,
    );
    const cue = input.stepOver;
    const cueElapsed = cue ? input.simulationTick - cue.startTick : -1;
    const cueDuration = cue ? Math.max(1, cue.contactTick - cue.startTick) : 1;
    const feintWeight = cue && cueElapsed >= 0 && cueElapsed <= cueDuration
      ? Math.sin(Math.PI * clamp(cueElapsed / cueDuration, 0, 1)) ** 2
      : 0;
    const exitWeight = cue && cueElapsed > cueDuration
      ? Math.sin(Math.PI * clamp((cueElapsed - cueDuration) / Math.max(1, cue.endTick - cue.contactTick), 0, 1))
      : 0;
    const skillBrace = cue && cueElapsed >= 0 && cueElapsed <= cue.endTick - cue.startTick
      ? Math.sin(Math.PI * clamp(cueElapsed / Math.max(1, cue.endTick - cue.startTick), 0, 1))
      : 0;
    for (const foot of FEET) {
      const side = foot === 'left' ? -1 : 1;
      // Attach the leg to the actual animated pelvis. Keeping this anchor in
      // group space made the torso bob/tilt away from the leg roots during a
      // plant, so the body appeared to stretch its legs to recover the gap.
      const hip = this.group.worldToLocal(this.#trunk.localToWorld(
        new THREE.Vector3(side * PLAYER_VISUAL_LAYOUT.legOffsetX, 0.91 - skillBrace * 0.10, 0),
      ));
      const bootWorld = feet[foot]!;
      const hipLocal = hip;
      const bootLocal = this.group.worldToLocal(bootWorld.clone());
      let ankleLocal = bootLocal.clone().add(ANKLE_FROM_FOOT_CENTER);
      let hipToAnkle = ankleLocal.clone().sub(hipLocal);
      let reach = hipToAnkle.length();
      const minimumReach = Math.abs(UPPER_LEG_LENGTH - LOWER_LEG_LENGTH) + 0.001;
      const clampedReach = clamp(reach, minimumReach, MAX_LEG_REACH - 0.001);
      if (Math.abs(reach - clampedReach) > 1e-6) {
        // Preserve turf height and shorten the stride across the ground. Scaling
        // the full hip-to-ankle vector also scaled its vertical component, which
        // lifted the boot by tens of centimetres whenever a stride overreached.
        const verticalReach = ankleLocal.y - hipLocal.y;
        const maxHorizontalReach = Math.sqrt(Math.max(0, clampedReach ** 2 - verticalReach ** 2));
        const horizontal = new THREE.Vector3(ankleLocal.x - hipLocal.x, 0, ankleLocal.z - hipLocal.z);
        if (horizontal.length() > maxHorizontalReach) horizontal.setLength(maxHorizontalReach);
        ankleLocal.set(hipLocal.x + horizontal.x, ankleLocal.y, hipLocal.z + horizontal.z);
        const clampedBootLocal = ankleLocal.clone().sub(ANKLE_FROM_FOOT_CENTER);
        feet[foot] = this.group.localToWorld(clampedBootLocal.clone());
        bootLocal.copy(clampedBootLocal);
        hipToAnkle = ankleLocal.clone().sub(hipLocal);
        reach = clampedReach;
      }
      const axis = hipToAnkle.clone().multiplyScalar(1 / Math.max(1e-6, reach));
      const along = (UPPER_LEG_LENGTH ** 2 - LOWER_LEG_LENGTH ** 2 + reach ** 2) / (2 * reach);
      const bend = new THREE.Vector3(0, 0, 1).addScaledVector(axis, -axis.z);
      if (bend.lengthSq() < 1e-6) bend.set(1, 0, 0).addScaledVector(axis, -axis.x);
      bend.normalize();
      const kneeLocal = hipLocal.clone()
        .addScaledVector(axis, along)
        .addScaledVector(bend, Math.sqrt(Math.max(0, UPPER_LEG_LENGTH ** 2 - along ** 2)));
      segmentBetween(this.#upperLegs[foot], hipLocal, kneeLocal);
      segmentBetween(this.#lowerLegs[foot], kneeLocal, ankleLocal);
      this.#boots[foot].position.copy(bootLocal);
      this.#boots[foot].rotation.y = 0;
      this.#socks[foot].position.copy(kneeLocal.clone().lerp(ankleLocal, 0.78));

      // Arms swing opposite the same-side leg and stay flexed while running.
      // Even this lightweight proxy reads materially less like a rigid torso.
      const armDirection = foot === 'left' ? 1 : -1;
      const feintCounter = cue && foot === cue.feintFoot ? -feintWeight * 0.9 : 0;
      const exitCounter = cue?.kind === 'elastico'
        ? 0
        : cue && foot === cue.exitFoot ? exitWeight * 0.7 : -exitWeight * 0.35;
      const armPhase = armSwing * armDirection + feintCounter + exitCounter;
      const balanceReach = clamp(-motion.bodyLean.lateral * 0.16, -0.04, 0.04);
      const shoulder = new THREE.Vector3(side * 0.29 + armPhase * 0.018 + balanceReach * 0.35, 1.40, 0.015);
      const elbow = new THREE.Vector3(side * 0.37 + armPhase * 0.035 + balanceReach * 0.7, 1.16, armPhase * 0.19);
      const wrist = new THREE.Vector3(side * 0.34 + armPhase * 0.028 + balanceReach, 0.98, armPhase * 0.31);
      segmentBetween(this.#upperArms[foot], shoulder, elbow);
      segmentBetween(this.#lowerArms[foot], elbow, wrist);
      this.#shoulders[foot].position.copy(shoulder);
      this.#elbows[foot].position.copy(elbow);
      this.#hands[foot].position.copy(wrist);
    }
  }
}
