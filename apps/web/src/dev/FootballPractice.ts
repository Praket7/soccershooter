import * as THREE from 'three';
import { BALL_CONSTANTS, cloneBallState, createBallState, type BallState } from '@soccershooter/physics/ball/BallState';
import { MATCH_BALL_PROFILE } from '@soccershooter/physics/ball/aerodynamics';
import { BALL_SUBSTEP_DT, STANDARD_GOAL_FRAME, crossedGoalPlane, stepBall } from '@soccershooter/physics/ball/trajectory';
import type { InputIntent } from '@soccershooter/sim';
import { PlayerActionBits, clonePlayerState, type PlayerState } from '@soccershooter/sim/player/PlayerState';
import { constrainBodyTurnToBall } from '../../../../packages/sim/src/player/athleticMotion';
import { DEFAULT_MOVEMENT_CONFIG, type MovementWorld } from '@soccershooter/sim/player/movement';
import type { LegacyGauntlet } from '@soccershooter/progression/campaign';
import { decodeFootballActionIntent } from '@soccershooter/sim/football/actionIntent';
import { selectPassTarget, solvePass, type PassType } from '@soccershooter/sim/football/passing';
import { resolveReceiveMode } from '@soccershooter/sim/football/receive';
import { buildShot, type ShotStyle } from '@soccershooter/sim/football/shooting';
import {
  createDefenderActionState,
  resolveChallenge,
  stepDefenderActionState,
  type DefenderActionState,
} from '@soccershooter/sim/football/defending';
import { evaluateAerialContact } from '@soccershooter/sim/football/aerial';
import type { FootballContactPlan } from '../../../../packages/sim/src/football/contactPlan';
import { suspendPlannedDribble } from '../../../../packages/sim/src/football/dribbleContinuity';
import { createStrikeContactPlan, stepStrikeContact } from '@soccershooter/sim/football/strikePlanner';
import { TECHNIQUES, TECHNIQUE_BY_ID } from '@soccershooter/content/techniques/catalog';
import { createTechniqueState, executeTechnique, interruptTechnique, resolveTechniqueContactKinematics, type TechniqueContactIntent, type TechniqueState } from '@soccershooter/sim/techniques/executeTechnique';
import {
  consumeReceiveIntent,
  createFootballRuntimeState,
  createPlannedDribbleState,
  markKick,
  stepFootballRuntime,
  stepPlannedDribble,
  stepTechniqueCarry,
  type FootballRuntimeState,
  type PlannedDribbleState,
} from '@soccershooter/sim/football/runtime';
import {
  applyBallContact,
  commandTowardVelocity,
  forwardFromYaw,
  normalizeHorizontal,
  type BallContactCommand,
  type FootballActorSnapshot,
  type FootballBallSnapshot,
  type FootballHorizontalDirection,
  type FootballVec3,
} from '@soccershooter/sim/football/types';
import { ActionDebugHud } from '../debug/ActionDebugHud';
import { TechniqueDebugHud } from '../debug/TechniqueDebugHud';
import { resolveDribbleIntent, resolveElasticoBallAnchor, resolveElasticoBallVelocity, resolveElasticoExitDirectionForFoot, resolveElasticoOutsideTouchVelocity, resolveStepOverBallVelocity, resolveTechniqueExitDirection, resolveTechniqueMovementAuthority, updateShotFacingLock } from '../input/FootballControl';
import { PLAYER_VISUAL_LAYOUT } from '../presentation/PlayerVisualLayout';
import { applyShotBuildModifier } from './shotBuildModifiers';
import { resolveLiveLegacyModifiers, type LiveLegacyModifiers } from './legacyChallengeModifiers';

export interface FootballPracticeOptions {
  scene: THREE.Scene;
  host: HTMLElement;
  onGoalScored?: () => void;
}

export interface FootballBuildModifiers {
  contactTimingTicks: number;
  sprintStaminaCostScale: number;
  strikeImpulseScale: number;
}

type PendingStrike =
  | {
    kind: 'shot';
    plan: Readonly<FootballContactPlan>;
    style: ShotStyle;
    charge: number;
    facingYaw: number;
    aim: FootballHorizontalDirection;
    aimTarget: FootballVec3 | null;
  }
  | { kind: 'pass'; plan: Readonly<FootballContactPlan>; passType: PassType };

interface PendingTechnique {
  definition: (typeof TECHNIQUES)[number];
  plan: Readonly<FootballContactPlan>;
  contact: TechniqueContactIntent;
  targetVelocity: FootballVec3;
  angularVelocity: FootballVec3;
  firstElasticoTouchApplied: boolean;
}

interface StepOverCue {
  kind: 'stepover' | 'elastico';
  startTick: number;
  contactTick: number;
  endTick: number;
  feintFoot: 'left' | 'right';
  exitFoot: 'left' | 'right';
  exitDirection: FootballHorizontalDirection;
  ballStartLocal: { x: number; z: number };
}

const CONTROLLED_BALL_POCKET = 0.50;
// The practice player spawns at z=-13 facing +z. Start the free ball in the
// same compact pocket used by G/reset so the first input is a dribble, not an
// emergency recovery from an already stretched 1.3 m separation.
const PRACTICE_BALL_START = Object.freeze({ x: 0, y: BALL_CONSTANTS.radius, z: -13 + CONTROLLED_BALL_POCKET });
const KEEPER_Z = STANDARD_GOAL_FRAME.planeZ - 0.72;
const KEEPER_MAX_SPEED = 4.8;
const KEEPER_HALF_REACH = 0.68;
export const PRACTICE_BALL_VISUAL_SCALE = 1;
const PRACTICE_KNUCKLE_SEED = 0x5a17f00d;
const SPECIALIST_SHOT_STYLES: readonly ShotStyle[] = Object.freeze(['normal', 'knuckle', 'outside-foot']);

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function playerDirection(player: Readonly<PlayerState>): { x: number; z: number } {
  const speed = Math.hypot(player.velocity.x, player.velocity.z);
  return speed > 0.22
    ? normalizeHorizontal({ x: player.velocity.x, z: player.velocity.z })
    : forwardFromYaw(player.athleticMotion.bodyYaw);
}

function actorSnapshot(player: Readonly<PlayerState>): FootballActorSnapshot {
  const speed = Math.hypot(player.velocity.x, player.velocity.z);
  const movementBalance = player.locomotion === 'sharp-cut' ? 0.68 : player.grounded ? 1 : 0.58;
  const speedBalance = clamp(1 - Math.max(0, speed - 5.2) * 0.035, 0.72, 1);
  return {
    position: { ...player.position },
    velocity: { ...player.velocity },
    facingYaw: player.athleticMotion.strikePreparation
      ? player.facingYaw
      : speed > 0.22 ? Math.atan2(player.velocity.x, player.velocity.z) : player.athleticMotion.bodyYaw,
    balance: movementBalance * speedBalance,
    pressure: 0,
    sprinting: player.locomotion === 'sprint',
    preferredFoot: 'right',
  };
}

function ballSnapshot(state: Readonly<BallState>): FootballBallSnapshot {
  return {
    position: { ...state.position },
    velocity: { ...state.velocity },
    angularVelocity: { ...state.angularVelocity },
    radius: BALL_CONSTANTS.radius,
    mass: BALL_CONSTANTS.mass,
    grounded: state.grounded,
  };
}

function createBall(scene: THREE.Scene): THREE.Group {
  const group = new THREE.Group();
  group.name = 'stage05-practice-ball';
  const radius = BALL_CONSTANTS.radius * PRACTICE_BALL_VISUAL_SCALE;
  const shell = new THREE.Mesh(
    new THREE.SphereGeometry(radius, 28, 20),
    new THREE.MeshStandardMaterial({ color: 0xf5f4ee, roughness: 0.68, metalness: 0.01 }),
  );
  shell.castShadow = true;
  shell.receiveShadow = true;
  const panels = new THREE.Mesh(
    new THREE.IcosahedronGeometry(radius * 1.012, 2),
    new THREE.MeshBasicMaterial({ color: 0x101820, wireframe: true, transparent: true, opacity: 0.62 }),
  );
  group.add(shell, panels);
  scene.add(group);
  return group;
}

function createGroundRing(scene: THREE.Scene, name: string, color: number, inner: number, outer: number): THREE.Mesh {
  const marker = new THREE.Mesh(
    new THREE.RingGeometry(inner, outer, 32),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.8, depthWrite: false, side: THREE.DoubleSide }),
  );
  marker.name = name;
  marker.rotation.x = -Math.PI / 2;
  marker.renderOrder = 4;
  scene.add(marker);
  return marker;
}

function createGoalAimMarker(scene: THREE.Scene): THREE.Mesh {
  const marker = new THREE.Mesh(
    new THREE.RingGeometry(0.11, 0.18, 24),
    new THREE.MeshBasicMaterial({ color: 0xffd166, transparent: true, opacity: 0.9, depthWrite: false, side: THREE.DoubleSide }),
  );
  marker.name = 'stage05-goal-aim-marker';
  marker.visible = false;
  marker.renderOrder = 5;
  scene.add(marker);
  return marker;
}

function createAimGuide(scene: THREE.Scene, name: string, color: number): THREE.ArrowHelper {
  const guide = new THREE.ArrowHelper(
    new THREE.Vector3(0, 0.02, 1),
    new THREE.Vector3(0, 0.04, 0),
    4,
    color,
    0.32,
    0.17,
  );
  guide.name = name;
  guide.visible = false;
  scene.add(guide);
  return guide;
}

function createAthleteMarker(scene: THREE.Scene, color: number, name: string): THREE.Group {
  const group = new THREE.Group();
  group.name = name;
  const material = new THREE.MeshStandardMaterial({ color, roughness: 0.68 });
  const torso = new THREE.Mesh(
    new THREE.CylinderGeometry(
      PLAYER_VISUAL_LAYOUT.torsoTopRadius * 0.83,
      PLAYER_VISUAL_LAYOUT.torsoBottomRadius * 0.87,
      PLAYER_VISUAL_LAYOUT.torsoHeight,
      16,
    ),
    material,
  );
  torso.position.y = PLAYER_VISUAL_LAYOUT.torsoCenterY;
  const head = new THREE.Mesh(new THREE.SphereGeometry(PLAYER_VISUAL_LAYOUT.headRadius * 0.84, 14, 10), material);
  head.position.y = PLAYER_VISUAL_LAYOUT.headCenterY;
  group.add(torso, head);
  scene.add(group);
  return group;
}

function createKeeper(scene: THREE.Scene): THREE.Group {
  const group = createAthleteMarker(scene, 0x52a8ff, 'stage05-greybox-keeper');
  const arms = new THREE.Mesh(
    new THREE.BoxGeometry(1.42, 0.14, 0.16),
    new THREE.MeshStandardMaterial({ color: 0x152331, roughness: 0.75 }),
  );
  arms.position.y = 1.18;
  group.add(arms);
  group.position.set(0, 0, KEEPER_Z);
  return group;
}

function createOppositeGoal(scene: THREE.Scene): THREE.Group {
  const group = new THREE.Group();
  group.name = 'stage05-opposite-practice-goal';
  const material = new THREE.MeshStandardMaterial({ color: 0xdfe7eb, roughness: 0.48 });
  const radius = STANDARD_GOAL_FRAME.postRadius;
  const height = STANDARD_GOAL_FRAME.height;
  const halfWidth = STANDARD_GOAL_FRAME.halfWidth;
  const z = -15.2;
  const postGeometry = new THREE.CylinderGeometry(radius, radius, height, 14);
  for (const x of [-halfWidth, halfWidth]) {
    const post = new THREE.Mesh(postGeometry, material);
    post.position.set(x, height / 2, z);
    group.add(post);
  }
  const bar = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, halfWidth * 2, 14), material);
  bar.rotation.z = Math.PI / 2;
  bar.position.set(0, height, z);
  group.add(bar);
  scene.add(group);
  return group;
}

export interface KeeperPlaneCrossing {
  fraction: number;
  position: FootballVec3;
  remainingSeconds: number;
}

export function evaluateKeeperPlaneCrossing(
  previous: Readonly<BallState>,
  current: Readonly<BallState>,
  planeZ: number,
  keeperX: number,
  halfReach: number,
  maxHeight: number,
): KeeperPlaneCrossing | null {
  if (previous.velocity.z <= 0 || !(previous.position.z < planeZ && current.position.z >= planeZ)) return null;
  const dz = current.position.z - previous.position.z;
  if (Math.abs(dz) <= 1e-12) return null;
  const fraction = clamp((planeZ - previous.position.z) / dz, 0, 1);
  const position: FootballVec3 = {
    x: previous.position.x + (current.position.x - previous.position.x) * fraction,
    y: previous.position.y + (current.position.y - previous.position.y) * fraction,
    z: planeZ,
  };
  if (Math.abs(position.x - keeperX) > halfReach || position.y > maxHeight) return null;
  const stepSeconds = Math.max(0, current.flightSeconds - previous.flightSeconds);
  return { fraction, position, remainingSeconds: stepSeconds * (1 - fraction) };
}

export class FootballPractice {
  readonly root: HTMLElement;
  readonly ballVisual: THREE.Group;
  readonly ballMarker: THREE.Mesh;
  readonly aimGuide: THREE.ArrowHelper;
  readonly passGuide: THREE.ArrowHelper;
  readonly receiverRing: THREE.Mesh;
  readonly leadMarker: THREE.Mesh;
  readonly goalAimMarker: THREE.Mesh;
  readonly keeperVisual: THREE.Group;
  readonly receiverVisual: THREE.Group;
  readonly oppositeGoalVisual: THREE.Group;
  readonly debugHud: ActionDebugHud;
  readonly techniqueDebugHud: TechniqueDebugHud;

  #state = createBallState({ position: PRACTICE_BALL_START, grounded: true });
  #previousState = cloneBallState(this.#state);
  #runtime: FootballRuntimeState = createFootballRuntimeState();
  #dribble: PlannedDribbleState = createPlannedDribbleState();
  #defenderState: DefenderActionState = createDefenderActionState();
  #contactTick = 0;
  #plannedContactCount = 0;
  #freeBallFrames = 0;
  #lastContactSurface = '';
  #lastContactPlan: Readonly<FootballContactPlan> | null = null;
  #lastContactEventTick: number | null = null;
  #pendingStrike: PendingStrike | null = null;
  #pendingTechnique: PendingTechnique | null = null;
  #stepOverCue: StepOverCue | null = null;
  #techniqueState: TechniqueState = createTechniqueState();
  #selectedTechniqueId = 'stepover';
  #accumulator = 0;
  #elapsed = 0;
  #visible = true;
  #specialistShotStyle: ShotStyle = 'normal';
  #shotStyle: ShotStyle = 'normal';
  #passType: PassType = 'ground';
  #goals = 0;
  #saves = 0;
  #keeperX = 0;
  #goalLatched = false;
  #resetCountdown = 0;
  #lastControlQuality: number | null = null;
  #lastAction = 'READY';
  #lastReason = 'practice-ready';
  #lastSuccess = true;
  #actionHoldUntilTick = 0;
  #lastPlayer: PlayerState | null = null;
  #shotFacingYaw: number | null = null;
  #lastAim = { x: 0, z: 1 };
  #worldAimTarget: FootballVec3 | null = null;
  #selectedReceiver = false;
  #leadPoint: FootballVec3 | null = null;
  #shotState = 'READY';
  #probe: HTMLOutputElement;
  #buildModifiers: FootballBuildModifiers = { contactTimingTicks: 2, sprintStaminaCostScale: 1, strikeImpulseScale: 1 };
  #legacyGauntlet: LegacyGauntlet | null = null;
  #legacyModifiers: LiveLegacyModifiers = resolveLiveLegacyModifiers(null);
  #onGoalScored: () => void;

  constructor(options: FootballPracticeOptions) {
    this.ballVisual = createBall(options.scene);
    this.#onGoalScored = options.onGoalScored ?? (() => {});
    this.ballMarker = createGroundRing(options.scene, 'stage05-ball-marker', 0xf2ce6b, 0.22, 0.32);
    this.aimGuide = createAimGuide(options.scene, 'stage05-shot-aim-guide', 0xf2ce6b);
    this.passGuide = createAimGuide(options.scene, 'stage05-pass-lane-guide', 0x76d7ea);
    this.receiverRing = createGroundRing(options.scene, 'stage05-receiver-ring', 0x76d7ea, 0.48, 0.58);
    this.leadMarker = createGroundRing(options.scene, 'stage05-pass-lead-marker', 0xf2ce6b, 0.20, 0.29);
    this.goalAimMarker = createGoalAimMarker(options.scene);
    this.keeperVisual = createKeeper(options.scene);
    this.receiverVisual = createAthleteMarker(options.scene, 0xf4c95d, 'stage05-pass-receiver');
    this.oppositeGoalVisual = createOppositeGoal(options.scene);
    this.debugHud = new ActionDebugHud(options.host);
    this.techniqueDebugHud = new TechniqueDebugHud(options.host);

    this.root = document.createElement('section');
    this.root.className = 'football-practice-panel';
    this.root.dataset.footballPractice = 'true';
    this.root.innerHTML = `
      <div class="football-practice-heading">
        <div><span>THE TRAINING GROUND</span><strong>Football Practice</strong></div>
        <span class="football-practice-live"><i></i> free ball</span>
      </div>
      <p>Carry at pace with WASD. Use Shift to sprint and RMB for close control. F receives; aim passes and shots through the reticle.</p>
      <div class="practice-actions">
        <button type="button" data-football-reset>Reset ball <kbd>G</kbd></button>
        <span><kbd>E</kbd> ground · <kbd>Q</kbd> through · <kbd>R</kbd> lofted · <kbd>RMB+E</kbd> driven · <kbd>Ctrl+Q</kbd> chipped through</span>
      </div>
      <div class="practice-actions" data-shot-controls-guide>
        <strong>SHOOTING</strong>
        <span>Aim with the center reticle · hold <kbd>LMB</kbd> for power · LMB only = NORMAL · RMB anytime while charging = FINESSE · Ctrl anytime while charging = CHIP · Release LMB to strike</span>
      </div>
      <details class="practice-technique-panel">
        <summary>Practice-only specialist contacts</summary>
        <p>These are technique experiments, not normal-match hotkeys.</p>
        <div class="shot-style-row" role="group" aria-label="Specialist shot contact">
          ${SPECIALIST_SHOT_STYLES.map((style) => `<button type="button" data-shot-style="${style}" data-active="${style === this.#specialistShotStyle}">${style}</button>`).join('')}
        </div>
        <label class="technique-selector">Technique <select data-technique-select aria-label="Practice technique">${TECHNIQUES.map((item) => `<option value="${item.id}">${item.displayName}</option>`).join('')}</select></label>
        <p>Choose a move and press <kbd>T</kbd>. Press <kbd>Y</kbd> for Elastico.</p>
      </details>
      <div class="practice-intent-status" aria-live="polite"><strong data-practice-intent>READY</strong><span data-practice-reason>point, move, receive, pass, or shoot</span></div>
      <p data-campaign-objective hidden></p>
      <output data-football-state data-ball-x="${this.#state.position.x}" data-ball-y="${this.#state.position.y}" data-ball-z="${this.#state.position.z}" data-goals="0" data-saves="0" data-shot-style="normal" data-shot-state="READY" data-receive-state="idle" data-selected-receiver="false" hidden></output>
    `;
    options.host.append(this.root);
    const probe = this.root.querySelector<HTMLOutputElement>('[data-football-state]');
    if (!probe) throw new Error('Football Practice missing state probe');
    this.#probe = probe;
    for (const button of this.root.querySelectorAll<HTMLButtonElement>('[data-shot-style]')) {
      button.addEventListener('click', () => this.setShotStyle(button.dataset.shotStyle as ShotStyle));
    }
    this.root.querySelector<HTMLSelectElement>('[data-technique-select]')?.addEventListener('change', (event) => {
      this.#selectedTechniqueId = (event.currentTarget as HTMLSelectElement).value;
    });
    this.root.querySelector<HTMLButtonElement>('[data-football-reset]')?.addEventListener('click', () => this.resetBallNearLastPlayer());
    this.#syncVisuals();
    this.#updateHud();
  }

  get state(): Readonly<BallState> { return this.#state; }
  get movementConfig() {
    return { ...DEFAULT_MOVEMENT_CONFIG, staminaDrainPerSecond: DEFAULT_MOVEMENT_CONFIG.staminaDrainPerSecond * this.#buildModifiers.sprintStaminaCostScale };
  }

  setBuildModifiers(modifiers: FootballBuildModifiers): void {
    this.#buildModifiers = { ...modifiers };
    this.root.dataset.archetypeContactTimingTicks = String(modifiers.contactTimingTicks);
    this.root.dataset.archetypeSprintStaminaCostScale = String(modifiers.sprintStaminaCostScale);
    this.root.dataset.archetypeStrikeImpulseScale = String(modifiers.strikeImpulseScale);
  }
  get tackleRecoverySeconds(): number { return this.#defenderState.recoverySeconds; }
  get shotStyle(): ShotStyle { return this.#shotStyle; }
  get visible(): boolean { return this.#visible; }
  get activeContactPlan(): Readonly<FootballContactPlan> | null { return this.#pendingTechnique?.plan ?? this.#pendingStrike?.plan ?? this.#dribble.activePlan; }
  get stepOverCue(): Readonly<StepOverCue> | null {
    return this.#stepOverCue && this.#contactTick <= this.#stepOverCue.endTick ? this.#stepOverCue : null;
  }
  get activeShotFacingYaw(): number | null {
    return this.#pendingStrike?.kind === 'shot' ? this.#pendingStrike.facingYaw : null;
  }
  get lastContactPlan(): Readonly<FootballContactPlan> | null { return this.#lastContactPlan; }
  get contactTick(): number { return this.#contactTick; }
  get lastContactEventTick(): number | null { return this.#lastContactEventTick; }

  constrainCarryTurn(player: Readonly<PlayerState>, deltaSeconds: number): PlayerState {
    const ballDistance = Math.hypot(this.#state.position.x - player.position.x, this.#state.position.z - player.position.z);
    if (this.#dribble.looseBall || this.#lastContactPlan?.kind !== 'dribble' || ballDistance > 1.5
      || this.#pendingStrike || this.#pendingTechnique) return player as PlayerState;
    const motion = constrainBodyTurnToBall(
      player.athleticMotion,
      player.position,
      this.#state.position,
      deltaSeconds,
    );
    if (motion.bodyYaw === player.athleticMotion.bodyYaw) return player as PlayerState;
    const constrained = clonePlayerState(player);
    constrained.athleticMotion = motion;
    return constrained;
  }

  get movementAuthority(): number {
    const defenderAuthority = this.#defenderState.recoverySeconds >= 0.7
      ? 0.28
      : this.#defenderState.recoverySeconds > 0 ? 0.58 : 1;
    return resolveTechniqueMovementAuthority(defenderAuthority, this.#pendingTechnique !== null);
  }

  movementWorld(base: Readonly<MovementWorld>): MovementWorld {
    const scale = this.#legacyModifiers.pitchScale;
    const centerX = (base.bounds.minX + base.bounds.maxX) / 2;
    const centerZ = (base.bounds.minZ + base.bounds.maxZ) / 2;
    const halfWidth = (base.bounds.maxX - base.bounds.minX) * scale / 2;
    const halfLength = (base.bounds.maxZ - base.bounds.minZ) * scale / 2;
    return {
      ...base,
      bounds: {
        minX: centerX - halfWidth,
        maxX: centerX + halfWidth,
        minZ: centerZ - halfLength,
        maxZ: centerZ + halfLength,
      },
    };
  }

  setWorldAimTarget(target: Readonly<FootballVec3> | null): void {
    this.#worldAimTarget = target ? { ...target } : null;
  }

  setCampaignChallenge(encounter: { id: string; tacticalProblem: string; legacyGauntlet?: LegacyGauntlet } | null): void {
    this.#legacyGauntlet = encounter?.legacyGauntlet ?? null;
    this.#legacyModifiers = resolveLiveLegacyModifiers(this.#legacyGauntlet);
    this.root.dataset.campaignLegacyModifier = this.#legacyGauntlet?.modifier ?? '';
    this.root.dataset.campaignLegacyLevel = this.#legacyGauntlet ? String(this.#legacyGauntlet.level) : '';
    this.root.dataset.legacyPressure = this.#legacyModifiers.pressure.toFixed(3);
    this.root.dataset.legacyPitchScale = this.#legacyModifiers.pitchScale.toFixed(4);
    this.root.dataset.legacyRecoveryRate = this.#legacyModifiers.recoveryRate.toFixed(3);
    this.root.dataset.legacyKeeperMaxHeight = this.#legacyModifiers.keeperMaxHeight.toFixed(4);
    const label = this.root.querySelector<HTMLElement>('[data-campaign-objective]');
    if (!label) return;
    this.root.dataset.campaignEncounter = encounter?.id ?? '';
    this.root.dataset.campaignTacticalProblem = encounter?.tacticalProblem ?? '';
    label.hidden = !encounter;
    const modifier = this.#legacyGauntlet
      ? ` · Legacy ${this.#legacyGauntlet.modifier.replaceAll('-', ' ')} ×${this.#legacyGauntlet.modifierIntensity.toFixed(2)}`
      : '';
    label.textContent = encounter ? `CAREER CHALLENGE · ${encounter.tacticalProblem.replaceAll('-', ' ')}${modifier} · score a physical goal to advance` : '';
  }

  setVisible(visible: boolean): void {
    this.#visible = visible;
    this.root.hidden = !visible;
    this.debugHud.setVisible(visible);
    this.ballVisual.visible = visible;
    this.ballMarker.visible = visible;
    this.aimGuide.visible = visible && this.#runtime.shotChargeSeconds > 0.015;
    this.passGuide.visible = visible;
    this.receiverRing.visible = visible && this.#selectedReceiver;
    this.leadMarker.visible = visible && this.#leadPoint !== null;
    this.goalAimMarker.visible = visible && this.#goalAimEligible();
    this.keeperVisual.visible = visible;
    this.receiverVisual.visible = visible;
    this.oppositeGoalVisual.visible = visible;
  }

  setShotStyle(style: ShotStyle): void {
    if (!SPECIALIST_SHOT_STYLES.includes(style)) return;
    this.#specialistShotStyle = style;
    this.#shotStyle = style;
    this.#probe.dataset.shotStyle = style;
    for (const button of this.root.querySelectorAll<HTMLButtonElement>('[data-shot-style]')) {
      button.dataset.active = String(button.dataset.shotStyle === style);
    }
    this.#recordAction('READY', true, style === 'normal' ? 'normal controls active' : `${style} specialist armed`);
    this.#updateHud();
  }

  resetBallNear(player: Readonly<PlayerState>): void {
    const forward = forwardFromYaw(player.athleticMotion.bodyYaw);
    this.#state = createBallState({
      position: {
        x: player.position.x + forward.x * CONTROLLED_BALL_POCKET,
        y: BALL_CONSTANTS.radius,
        z: player.position.z + forward.z * CONTROLLED_BALL_POCKET,
      },
      grounded: true,
    });
    this.#previousState = cloneBallState(this.#state);
    this.#runtime = createFootballRuntimeState();
    this.#resetPlannedDribble(true);
    this.#shotFacingYaw = null;
    this.#lastAim = forward;
    this.#accumulator = 0;
    this.#goalLatched = false;
    this.#resetCountdown = 0;
    this.#leadPoint = null;
    this.#selectedReceiver = false;
    this.#shotState = 'READY';
    this.ballVisual.quaternion.identity();
    this.#recordAction('READY', true, 'ball-reset-in-control-pocket');
    this.#syncVisuals();
    this.#updateHud();
  }

  resetBallNearLastPlayer(): void {
    if (this.#lastPlayer) this.resetBallNear(this.#lastPlayer);
    else {
      this.#state = createBallState({ position: PRACTICE_BALL_START, grounded: true });
      this.#previousState = cloneBallState(this.#state);
      this.#runtime = createFootballRuntimeState();
      this.#resetPlannedDribble(true);
      this.#shotFacingYaw = null;
      this.ballVisual.quaternion.identity();
      this.#syncVisuals();
    }
  }

  processIntent(player: Readonly<PlayerState>, intent: Readonly<InputIntent>, dt: number): void {
    if (!this.#visible) return;
    const contactTick = this.#contactTick;
    this.#contactTick += 1;
    this.#lastPlayer = clonePlayer(player);
    this.#elapsed += Math.max(0, dt);
    const runtimeStep = stepFootballRuntime(this.#runtime, intent.actionBits, dt);
    this.#runtime = runtimeStep.state;
    this.#defenderState = stepDefenderActionState(this.#defenderState, Math.min(0.1, dt * this.#legacyModifiers.recoveryRate));

    const actor = { ...actorSnapshot(player), pressure: this.#legacyModifiers.pressure };
    const snapshot = ballSnapshot(this.#state);
    const precision = (intent.actionBits & PlayerActionBits.Precision) !== 0;
    const tackle = (intent.actionBits & PlayerActionBits.Tackle) !== 0;
    const jump = (intent.actionBits & PlayerActionBits.Jump) !== 0;
    const decoded = decodeFootballActionIntent(intent.actionBits);
    const aim = this.#resolveAim(intent.aimYaw);
    const dribbleIntent = resolveDribbleIntent(intent, playerDirection(player));
    const shotFacing = updateShotFacingLock(this.#shotFacingYaw, intent.actionBits, player.facingYaw);
    this.#shotFacingYaw = shotFacing.latchedYaw;
    this.#lastAim = aim;

    if ((intent.actionBits & PlayerActionBits.ShootHeld) !== 0) {
      this.#shotStyle = this.#specialistShotStyle === 'normal'
        ? this.#runtime.shotStyleLatched ?? decoded.shotStyle
        : this.#specialistShotStyle;
      this.#shotState = 'POWER';
      this.#recordAction('POWER', true, `${this.#shotStyle} shot charging`);
    }

    if (this.#pendingStrike) {
      if (tackle) this.#pendingStrike = null;
      else if (runtimeStep.releasedShotCharge === null && decoded.passType === null) {
        const pending = this.#pendingStrike;
        const strike = stepStrikeContact(pending.plan, contactTick, actor.position, snapshot);
        if (strike.status === 'preparing') {
          this.#shotState = pending.kind === 'shot' ? 'GATHER' : 'PASS SETUP';
          this.#updateHud();
          return;
        }
        this.#pendingStrike = null;
        if (strike.status === 'missed') {
          this.#shotState = pending.kind === 'shot' ? 'CONTACT MISSED' : 'PASS MISSED';
          this.#recordAction(this.#shotState, false, strike.reason);
          this.#updateHud();
          return;
        }

        let command: BallContactCommand | undefined;
        if (pending.kind === 'shot') {
          const shotActor: FootballActorSnapshot = { ...actor, facingYaw: pending.facingYaw };
          const solution = buildShot({
            style: pending.style,
            shooter: shotActor,
            ball: snapshot,
            aim: pending.aim,
            ...(pending.aimTarget ? { aimTarget: pending.aimTarget } : {}),
            charge: pending.charge,
            spinInput: pending.style === 'finesse' ? 0.82 : pending.style === 'outside-foot' ? 0.68 : 0.18,
            pressure: actor.pressure,
            balance: actor.balance,
            contactFoot: pending.plan.foot,
            knuckleSeed: PRACTICE_KNUCKLE_SEED,
          });
          command = applyShotBuildModifier(solution, this.#buildModifiers.strikeImpulseScale).command;
          this.#shotState = command ? 'FOLLOW THROUGH' : solution.reason.toUpperCase().replaceAll('-', ' ');
          if (command) this.#state.knuckleSeed = solution.knuckleSeed;
        } else {
          const receiver = this.#receiverSnapshot();
          const selected = selectPassTarget({
            origin: { ...this.#state.position },
            userAim: aim,
            aimConeDegrees: 38,
            candidates: [{ id: 'practice-receiver', ...receiver, laneOpenness: 1 }],
          });
          const solution = solvePass({
            type: pending.passType,
            passer: actor,
            ball: snapshot,
            receiver: selected?.receiver ?? {
              position: { x: this.#state.position.x + aim.x * 11, y: 0, z: this.#state.position.z + aim.z * 11 },
              velocity: { x: 0, y: 0, z: 0 },
            },
            userAim: aim,
            assist: selected ? 0.68 : 0,
            pressure: actor.pressure,
            allowBehindBodyTechnique: false,
          });
          command = solution.command;
        }

        if (command) {
          this.#applyCommand(command);
          this.#resetPlannedDribble(false);
          this.#lastContactPlan = pending.plan;
          this.#lastContactEventTick = contactTick;
          this.#lastContactSurface = pending.plan.surface;
          this.#recordAction('CONTACT', true, pending.kind === 'pass'
            ? `${pending.passType}: ${pending.plan.foot} ${pending.plan.surface} · gait-timed`
            : `shot: ${pending.plan.foot} ${pending.plan.surface} · gait-timed`);
          this.#runtime = markKick(this.#runtime, pending.kind);
        } else {
          this.#recordAction('CONTACT MISSED', false, 'strike solution no longer legal');
        }
        this.#updateHud();
        return;
      }
    }

    if (this.#pendingTechnique) {
      if (tackle || (intent.actionBits & PlayerActionBits.Technique) !== 0) {
        this.#techniqueState = interruptTechnique(
          this.#pendingTechnique.definition,
          this.#techniqueState,
          contactTick,
        ).state;
        this.#pendingTechnique = null;
        this.#stepOverCue = null;
      } else {
        const pending = this.#pendingTechnique;
        const firstTouchTick = pending.plan.contactTick - 4;
        if (pending.definition.id === 'elastico' && !pending.firstElasticoTouchApplied && contactTick >= firstTouchTick) {
          const side = pending.plan.foot === 'right' ? 1 : -1;
          const yaw = player.athleticMotion.bodyYaw;
          const outward = { x: side * Math.cos(yaw), z: -side * Math.sin(yaw) };
          const preTouchVelocity = resolveElasticoOutsideTouchVelocity(actor.velocity, outward);
          this.#applyCommand(commandTowardVelocity(
            'control-touch', snapshot, preTouchVelocity, { x: 0, y: 0, z: 0 }, 2.5,
            `technique=elastico outside-touch foot=${pending.plan.foot}`,
          ));
          pending.firstElasticoTouchApplied = true;
          this.#recordAction('ELASTICO OUTSIDE TOUCH', true, 'soft outside push before same-foot inside snap');
          this.#updateHud();
          return;
        }
        const strike = stepStrikeContact(pending.plan, contactTick, actor.position, snapshot);
        if (strike.status === 'preparing') {
          const carry = stepTechniqueCarry({
            tick: contactTick,
            state: this.#dribble,
            actor,
            motion: player.athleticMotion,
            ball: snapshot,
            desiredDirection: dribbleIntent.direction,
            precision,
            sprint: intent.sprint,
            pressure: actor.pressure,
            moveIntentMagnitude: dribbleIntent.magnitude,
            contactTimingOffsetTicks: this.#buildModifiers.contactTimingTicks,
            receiveMode: null,
            techniqueContactTick: pending.plan.contactTick,
            reserveContactTicks: pending.definition.id === 'stepover' ? 1 : 4,
          });
          if (carry) {
            const carryPlan = this.#dribble.activePlan;
            this.#dribble = carry.state;
            if (carry.contactApplied) {
              this.#state.velocity = { ...carry.ball.velocity };
              this.#state.angularVelocity = { ...carry.ball.angularVelocity };
              if (Math.abs(this.#state.velocity.y) > 0.05) this.#state.grounded = false;
              this.#plannedContactCount += 1;
              this.#lastContactPlan = carryPlan;
              this.#lastContactEventTick = contactTick;
              this.#lastContactSurface = carryPlan?.surface ?? '';
              this.#recordAction('SKILL CARRY TOUCH', true,
                `${carryPlan?.foot ?? 'foot'} ${carryPlan?.surface ?? 'contact'} · move windup`);
            } else if (carry.state.looseBall) {
              this.#recordAction('SKILL CARRY LOST', false, carry.reason);
            }
          }
          this.techniqueDebugHud.update({
            technique: pending.definition,
            eligible: true,
            timingWindowTicks: pending.contact.contactTick - pending.plan.prepareTick,
            failureReason: '',
            contactTick: pending.contact.contactTick,
            counterUntilTick: pending.contact.counterUntilTick,
          });
          this.#updateHud();
          return;
        }
        this.#pendingTechnique = null;
        if (strike.status === 'missed') {
          this.#stepOverCue = null;
          const interrupted = interruptTechnique(pending.definition, this.#techniqueState, contactTick);
          this.#techniqueState = interrupted.state;
          this.techniqueDebugHud.update({
            technique: pending.definition,
            eligible: false,
            timingWindowTicks: pending.contact.contactTick - pending.plan.prepareTick,
            failureReason: strike.reason,
            contactTick: null,
            counterUntilTick: interrupted.counterUntilTick,
          });
          this.#recordAction('TECHNIQUE MISSED', false, strike.reason);
          this.#updateHud();
          return;
        }
        const kind = pending.definition.family === 'aerial'
          ? 'volley'
          : pending.definition.family === 'pass-shot'
            ? 'shot'
            : 'control-touch';
        const command = commandTowardVelocity(
          kind,
          snapshot,
          pending.targetVelocity,
          pending.angularVelocity,
          pending.contact.maxImpulse,
          `technique=${pending.contact.techniqueId} surface=${pending.contact.surface} mechanic=${pending.contact.mechanic}`,
        );
        this.#applyCommand(command);
        this.#resetPlannedDribble(false);
        this.#lastContactPlan = pending.plan;
        this.#lastContactEventTick = contactTick;
        this.#lastContactSurface = pending.plan.surface;
        this.#techniqueState = { ...this.#techniqueState, active: null };
        this.techniqueDebugHud.update({
          technique: pending.definition,
          eligible: true,
          timingWindowTicks: pending.plan.timingWindowTicks,
          failureReason: '',
          contactTick: pending.contact.contactTick,
          counterUntilTick: pending.contact.counterUntilTick,
        });
        this.#recordAction('TECHNIQUE CONTACT', true, `${pending.definition.displayName} · ${pending.contact.surface}`);
        this.#updateHud();
        return;
      }
    }

    if ((intent.actionBits & (PlayerActionBits.Technique | PlayerActionBits.Elastico)) !== 0) {
      const definition = TECHNIQUE_BY_ID.get((intent.actionBits & PlayerActionBits.Elastico) !== 0 ? 'elastico' : this.#selectedTechniqueId);
      if (!definition) return;
      const result = executeTechnique(definition, this.#techniqueState, {
        tick: contactTick,
        speed: Math.hypot(actor.velocity.x, actor.velocity.z),
        pressure: actor.pressure,
        ballDistance: Math.hypot(snapshot.position.x - actor.position.x, snapshot.position.z - actor.position.z),
        ballHeight: snapshot.position.y,
        grounded: player.grounded,
        stamina: player.stamina,
        actionBits: intent.actionBits,
      });
      this.#techniqueState = result.state;
      if (!result.contact) {
        this.techniqueDebugHud.update({
          technique: definition,
          eligible: false,
          timingWindowTicks: definition.timing.contactWindowTicks,
          failureReason: result.reason,
          contactTick: null,
          counterUntilTick: result.counterUntilTick || null,
        });
        this.#recordAction('TECHNIQUE FAILED', false, result.reason);
        this.#updateHud();
        return;
      }
      const stepOverExit = {
        x: forwardFromYaw(player.athleticMotion.bodyYaw).x * 0.48 - Math.cos(player.athleticMotion.bodyYaw) * 0.88,
        z: forwardFromYaw(player.athleticMotion.bodyYaw).z * 0.48 + Math.sin(player.athleticMotion.bodyYaw) * 0.88,
      };
      const normalExit = forwardFromYaw(player.athleticMotion.bodyYaw);
      const requestedExitDirection = definition.id === 'stepover'
        ? (dribbleIntent.magnitude > 0.05 ? dribbleIntent.direction : stepOverExit)
        : (definition.id === 'elastico'
          ? (dribbleIntent.magnitude > 0.05
            ? normalizeHorizontal({
              x: dribbleIntent.direction.x * 0.58 + normalExit.x * 0.42,
              z: dribbleIntent.direction.z * 0.58 + normalExit.z * 0.42,
            })
            : normalExit)
          : (dribbleIntent.magnitude > 0.05 ? dribbleIntent.direction : normalExit));
      const exitDirection = resolveTechniqueExitDirection(requestedExitDirection, player.athleticMotion.bodyYaw);
      let techniqueExitDirection = exitDirection;
      const kinematics = resolveTechniqueContactKinematics(
        result.contact,
        definition.family === 'dribble' ? exitDirection : aim,
      );
      const targetVelocity: FootballVec3 = definition.id === 'stepover'
        ? resolveStepOverBallVelocity(actor.velocity, exitDirection)
        : definition.id === 'elastico'
          ? resolveElasticoBallVelocity(actor.velocity, exitDirection)
          : { ...kinematics.targetVelocity };
      const angularVelocity: FootballVec3 = { ...kinematics.angularVelocity };
      const planInput = {
        kind: definition.family === 'pass-shot' ? 'shot' : 'pass',
        sourceId: `technique-${definition.id}-${contactTick}`,
        tick: contactTick,
        gaitPhase: player.athleticMotion.gaitPhase,
        strideSeconds: player.athleticMotion.strideSeconds,
        actorPosition: actor.position,
        actorVelocity: actor.velocity,
        ball: snapshot,
        targetBallVelocity: targetVelocity,
        preferredFoot: definition.id === 'stepover' ? 'left' : actor.preferredFoot,
        balance: actor.balance,
        ...(['stepover', 'elastico'].includes(definition.id) ? { contactDelayTicks: result.contact.contactTick - contactTick } : {}),
        ...(definition.id === 'stepover' ? { maximumContactReach: 1.3, timingWindowTicks: 1 } : {}),
        ...(definition.id === 'elastico' ? { maximumContactReach: 1.3, timingWindowTicks: 4 } : {}),
      } as const;
      let plan = createStrikeContactPlan(planInput);
      if (!plan) {
        const interrupted = interruptTechnique(definition, this.#techniqueState, contactTick);
        this.#techniqueState = interrupted.state;
        this.techniqueDebugHud.update({
          technique: definition,
          eligible: false,
          timingWindowTicks: definition.timing.contactWindowTicks,
          failureReason: 'no-viable-foot-contact',
          contactTick: null,
          counterUntilTick: interrupted.counterUntilTick,
        });
        this.#recordAction('TECHNIQUE FAILED', false, 'no-viable-foot-contact');
        this.#updateHud();
        return;
      }
      if (definition.id === 'elastico') {
        const insideSnap = resolveElasticoExitDirectionForFoot(player.athleticMotion.bodyYaw, plan.foot);
        const requestedSnap = dribbleIntent.magnitude > 0.05
          ? normalizeHorizontal({
            x: dribbleIntent.direction.x * 0.58 + insideSnap.x * 0.42,
            z: dribbleIntent.direction.z * 0.58 + insideSnap.z * 0.42,
          })
          : insideSnap;
        const correctedExit = resolveTechniqueExitDirection(requestedSnap, player.athleticMotion.bodyYaw);
        const correctedVelocity = resolveElasticoBallVelocity(actor.velocity, correctedExit);
        const correctedPlan = createStrikeContactPlan({ ...planInput, targetBallVelocity: correctedVelocity });
        if (correctedPlan) {
          plan = correctedPlan;
          techniqueExitDirection = correctedExit;
          targetVelocity.x = correctedVelocity.x;
          targetVelocity.y = correctedVelocity.y;
          targetVelocity.z = correctedVelocity.z;
        }
      }
      this.#pendingTechnique = { definition, plan, contact: result.contact, targetVelocity, angularVelocity, firstElasticoTouchApplied: false };
      this.#stepOverCue = definition.id === 'stepover' || definition.id === 'elastico'
        ? {
          kind: definition.id,
          startTick: contactTick,
          contactTick: plan.contactTick,
          endTick: plan.contactTick + (definition.id === 'elastico' ? 24 : 26),
          feintFoot: definition.id === 'elastico' ? plan.foot : (plan.foot === 'left' ? 'right' : 'left'),
          exitFoot: definition.id === 'elastico' ? (plan.foot === 'left' ? 'right' : 'left') : plan.foot,
          exitDirection: techniqueExitDirection,
          ballStartLocal: (() => {
            const dx = this.#state.position.x - player.position.x;
            const dz = this.#state.position.z - player.position.z;
            const yaw = player.athleticMotion.bodyYaw;
            return { x: Math.cos(yaw) * dx - Math.sin(yaw) * dz, z: Math.sin(yaw) * dx + Math.cos(yaw) * dz };
          })(),
        }
        : null;
      this.#suspendPlannedDribble();
      this.techniqueDebugHud.update({
        technique: definition,
        eligible: true,
        timingWindowTicks: definition.timing.contactWindowTicks,
        failureReason: '',
        contactTick: result.contact.contactTick,
        counterUntilTick: result.contact.counterUntilTick,
      });
      this.#recordAction('TECHNIQUE WINDUP', true, `${definition.displayName} · counter window ${definition.counter.windowTicks} ticks`);
      this.#updateHud();
      return;
    }

    if (tackle) {
      const challenge = resolveChallenge({
        kind: intent.sprint ? 'committed' : 'standing',
        state: this.#defenderState,
        defender: actor,
        ball: snapshot,
        opponentPosition: {
          x: this.#state.position.x - aim.x * 0.45,
          y: 0,
          z: this.#state.position.z - aim.z * 0.45,
        },
      });
      this.#defenderState = challenge.nextState;
      this.#recordAction(intent.sprint ? 'COMMITTED TACKLE' : 'STANDING CHALLENGE', challenge.wonBall, challenge.reason);
      if (challenge.command) {
        this.#applyCommand(challenge.command);
        this.#resetPlannedDribble(false);
      }
      this.#runtime = { ...this.#runtime, lastAction: 'challenge' };
      this.#updateHud();
      return;
    }

    if (jump && this.#runtime.kickCooldown <= 0) {
      const aerial = evaluateAerialContact({ kind: 'header', actor, ball: snapshot, jumpRequested: true });
      if (aerial.eligible) {
        this.#applyCommand(commandTowardVelocity(
          'header', snapshot,
          { x: aim.x * 13.5, y: 1.1 + Math.max(0, player.velocity.y) * 0.2, z: aim.z * 13.5 },
          { x: -3, y: 0, z: 0 }, 8.2,
          `header timing=${aerial.timingScore.toFixed(2)}`,
        ));
        this.#resetPlannedDribble(false);
        this.#runtime = markKick(this.#runtime, 'shot');
        this.#recordAction('CONTACT', true, 'legal header contact');
        this.#updateHud();
        return;
      }
    }

    if (runtimeStep.releasedShotCharge !== null && this.#runtime.kickCooldown <= 0) {
      const elevated = this.#state.position.y > 0.34;
      if (elevated) {
        const volley = evaluateAerialContact({ kind: 'volley', actor, ball: snapshot, jumpRequested: jump });
        if (!volley.eligible) {
          this.#shotState = volley.reason.toUpperCase();
          this.#recordAction(this.#shotState, false, volley.reason);
          this.#updateHud();
          return;
        }
      }
      const shotActor: FootballActorSnapshot = shotFacing.contactFacingYaw === null
        ? actor
        : { ...actor, facingYaw: shotFacing.contactFacingYaw };
      const contactFacingYaw = shotFacing.contactFacingYaw ?? shotActor.facingYaw;
      const releaseStyle = this.#specialistShotStyle === 'normal'
        ? runtimeStep.releasedShotStyle ?? decoded.shotStyle
        : this.#specialistShotStyle;
      this.#shotStyle = releaseStyle;
      const shot = buildShot({
        style: releaseStyle,
        shooter: shotActor,
        ball: snapshot,
        aim,
        ...(this.#worldAimTarget ? { aimTarget: this.#worldAimTarget } : {}),
        charge: runtimeStep.releasedShotCharge,
        spinInput: releaseStyle === 'finesse' ? 0.82 : releaseStyle === 'outside-foot' ? 0.68 : 0.18,
        pressure: actor.pressure,
        balance: actor.balance,
        contactFoot: actor.preferredFoot,
        knuckleSeed: PRACTICE_KNUCKLE_SEED,
      });
      this.#shotState = shot.legal ? 'CONTACT' : shot.reason.toUpperCase().replaceAll('-', ' ');
      const modifiedShot = applyShotBuildModifier(shot, this.#buildModifiers.strikeImpulseScale);
      const strikePlan = shot.command ? createStrikeContactPlan({
        kind: 'shot',
        sourceId: `practice-shot-${contactTick}`,
        tick: contactTick,
        gaitPhase: player.athleticMotion.gaitPhase,
        strideSeconds: player.athleticMotion.strideSeconds,
        actorPosition: actor.position,
        actorVelocity: actor.velocity,
        ball: snapshot,
        targetBallVelocity: modifiedShot.launchVelocity,
        preferredFoot: actor.preferredFoot,
        balance: actor.balance,
      }) : null;
      if (shot.command && strikePlan) {
        this.#pendingStrike = {
          kind: 'shot',
          plan: strikePlan,
          style: releaseStyle,
          charge: runtimeStep.releasedShotCharge,
          facingYaw: contactFacingYaw,
          aim: { ...aim },
          aimTarget: this.#worldAimTarget ? { ...this.#worldAimTarget } : null,
        };
        this.#suspendPlannedDribble();
        this.#shotState = 'GATHER';
        this.#recordAction('SHOT SETUP', true, `plant ${strikePlan.foot} · contact in ${strikePlan.contactTick - contactTick} ticks`);
      } else {
        if (shot.command && !strikePlan) this.#shotState = 'NO CONTACT BEAT';
        this.#recordAction(this.#shotState, shot.legal && strikePlan !== null, shot.command ? 'no viable contact beat' : shot.reason);
      }
      this.#updateHud();
      return;
    }

    if (decoded.passType !== null && this.#runtime.kickCooldown <= 0) {
      this.#passType = decoded.passType;
      const receiver = this.#receiverSnapshot();
      const selected = selectPassTarget({
        origin: { ...this.#state.position },
        userAim: aim,
        aimConeDegrees: 38,
        candidates: [{ id: 'practice-receiver', ...receiver, laneOpenness: 1 }],
      });
      this.#selectedReceiver = selected !== null;
      const openSpaceTarget = {
        position: {
          x: this.#state.position.x + aim.x * 11,
          y: 0,
          z: this.#state.position.z + aim.z * 11,
        },
        velocity: { x: 0, y: 0, z: 0 },
      };
      const solution = solvePass({
        type: this.#passType,
        passer: actor,
        ball: snapshot,
        receiver: selected?.receiver ?? openSpaceTarget,
        userAim: aim,
        assist: selected ? 0.68 : 0,
        pressure: actor.pressure,
        allowBehindBodyTechnique: false,
      });
      this.#leadPoint = selected && (this.#passType === 'through' || this.#passType === 'chipped-through')
        ? { ...solution.targetPoint }
        : selected ? { ...selected.receiver.position } : null;
      const strikePlan = solution.command ? createStrikeContactPlan({
        kind: 'pass',
        sourceId: `practice-pass-${contactTick}`,
        tick: contactTick,
        gaitPhase: player.athleticMotion.gaitPhase,
        strideSeconds: player.athleticMotion.strideSeconds,
        actorPosition: actor.position,
        actorVelocity: actor.velocity,
        ball: snapshot,
        targetBallVelocity: solution.launchVelocity,
        preferredFoot: actor.preferredFoot,
        balance: actor.balance,
      }) : null;
      if (solution.command && strikePlan) {
        this.#pendingStrike = { kind: 'pass', plan: strikePlan, passType: this.#passType };
        this.#suspendPlannedDribble();
        this.#shotState = 'PASS SETUP';
        this.#recordAction('PASS SETUP', true, `${this.#passType}: plant ${strikePlan.foot} · contact in ${strikePlan.contactTick - contactTick} ticks`);
      } else {
        this.#recordAction(solution.legal ? 'PASS FAILED' : 'PASS FAILED', false,
          solution.command ? 'no viable contact beat' : `${this.#passType}: ${solution.reason}`);
      }
      this.#updateHud();
      return;
    }

    const receiveArmed = this.#runtime.receive.armedSeconds > 0;
    const receiveMode = receiveArmed ? resolveReceiveMode(dribbleIntent.magnitude) : null;
    const controlAvailable = this.#runtime.kickCooldown <= 0 && this.#defenderState.recoverySeconds <= 0.08;

    if (controlAvailable) {
      const contactPlan = this.#dribble.activePlan;
      const planned = stepPlannedDribble({
        tick: contactTick,
        state: this.#dribble,
        actor,
        motion: player.athleticMotion,
        ball: snapshot,
        desiredDirection: dribbleIntent.direction,
        precision,
        sprint: intent.sprint,
        pressure: actor.pressure,
        moveIntentMagnitude: dribbleIntent.magnitude,
        contactTimingOffsetTicks: this.#buildModifiers.contactTimingTicks,
        receiveMode,
      });
      const lostControl = !this.#dribble.looseBall && planned.state.looseBall;
      this.#dribble = planned.state;
      if (lostControl) this.#recordAction('LOOSE BALL', false, planned.reason);

      if (planned.contactApplied) {
        const next = cloneBallState(this.#state);
        next.velocity = { ...planned.ball.velocity };
        next.angularVelocity = { ...planned.ball.angularVelocity };
        if (Math.abs(next.velocity.y) > 0.05) next.grounded = false;
        if (next.lastContact) delete next.lastContact;
        this.#state = next;
        this.#plannedContactCount += 1;
        this.#lastContactPlan = contactPlan;
        this.#lastContactEventTick = contactTick;
        this.#lastControlQuality = contactPlan?.quality ?? 1;
        this.#lastContactSurface = contactPlan?.surface ?? '';
        if (receiveMode) this.#runtime = consumeReceiveIntent(this.#runtime);
        const planReason = contactPlan?.reason ?? '';
        const action = contactPlan?.kind === 'trap'
          ? 'CUSHION TOUCH'
          : receiveMode === 'controlled-exit'
            ? 'CONTROLLED EXIT'
            : planReason.startsWith('effort-')
              ? 'EFFORT CONTACT'
              : planReason.startsWith('sprint-')
                ? 'SPRINT CARRY'
                : precision
                  ? 'PRECISION CONTACT'
                  : 'PLANNED TOUCH';
        this.#recordAction(
          action,
          true,
          `${contactPlan?.foot ?? this.#dribble.lastContactFoot ?? 'foot'} ${contactPlan?.surface ?? 'contact'} · gait-timed`,
        );
      } else {
        if (Math.hypot(this.#state.velocity.x, this.#state.velocity.z) > 0.2) this.#freeBallFrames += 1;
        if (receiveArmed && (planned.reason === 'loose-ball-chase' || planned.reason === 'no-viable-intercept')) {
          this.#recordAction('TRAP ARMED', true, 'waiting for legal foot contact');
        }
      }
    }

    if (this.#runtime.receive.lastOutcome === 'expired' && this.#lastAction === 'TRAP ARMED') {
      this.#recordAction('RECEIVE EXPIRED', false, 'ball never entered a legal receive window');
    }
    this.#updateHud();
  }

  update(realDeltaSeconds: number): void {
    if (!this.#visible) return;
    const delta = clamp(realDeltaSeconds, 0, 0.1);
    this.#accumulator += delta;
    if (this.#resetCountdown > 0) {
      this.#resetCountdown = Math.max(0, this.#resetCountdown - delta);
      if (this.#resetCountdown === 0) this.resetBallNearLastPlayer();
    }

    let steps = 0;
    while (this.#accumulator + 1e-12 >= BALL_SUBSTEP_DT && steps < 24) {
      this.#previousState = cloneBallState(this.#state);
      this.#updateKeeper(BALL_SUBSTEP_DT);
      let next = stepBall(this.#state, BALL_SUBSTEP_DT, MATCH_BALL_PROFILE, STANDARD_GOAL_FRAME);
      const saved = this.#keeperSaveIfEligible(this.#previousState, next);
      if (saved) next = saved;
      else if (!this.#goalLatched && crossedGoalPlane(this.#previousState, next, STANDARD_GOAL_FRAME)) {
        this.#goalLatched = true;
        this.#goals += 1;
        this.#resetCountdown = 0.9;
        this.#recordAction('GOAL', true, 'whole-ball-crossed-line');
        this.#onGoalScored();
      }
      const cue = this.#stepOverCue;
      const player = this.#lastPlayer;
      if (cue?.kind === 'elastico' && player && this.#contactTick <= cue.endTick) {
        const windupTicks = Math.max(1, cue.contactTick - cue.startTick);
        const progress = clamp((this.#contactTick - cue.startTick) / windupTicks, 0, 1);
        const local = resolveElasticoBallAnchor(progress, cue.feintFoot, cue.ballStartLocal);
        const yaw = player.athleticMotion.bodyYaw;
        const target = {
          x: player.position.x + local.x * Math.cos(yaw) + local.z * Math.sin(yaw),
          y: BALL_CONSTANTS.radius,
          z: player.position.z - local.x * Math.sin(yaw) + local.z * Math.cos(yaw),
        };
        next.position = target;
        next.velocity = {
          x: (target.x - this.#previousState.position.x) / BALL_SUBSTEP_DT,
          y: 0,
          z: (target.z - this.#previousState.position.z) / BALL_SUBSTEP_DT,
        };
        next.angularVelocity = {
          x: -next.velocity.z / BALL_CONSTANTS.radius,
          y: 0,
          z: next.velocity.x / BALL_CONSTANTS.radius,
        };
        next.grounded = true;
        next.flightSeconds = 0;
      }
      this.#state = next;
      this.#advanceVisualRotation(BALL_SUBSTEP_DT);
      this.#accumulator -= BALL_SUBSTEP_DT;
      steps += 1;
    }

    if (Math.abs(this.#state.position.x) > 23 || this.#state.position.z > 18 || this.#state.position.z < -17) {
      if (this.#resetCountdown <= 0) this.#resetCountdown = 0.45;
    }
    this.#syncVisuals();
    this.#updateHud();
  }

  #suspendPlannedDribble(): void {
    this.#dribble = suspendPlannedDribble(this.#dribble);
  }

  #resetPlannedDribble(resetCounters: boolean): void {
    this.#dribble = createPlannedDribbleState();
    if (resetCounters) {
      this.#contactTick = 0;
      this.#plannedContactCount = 0;
      this.#freeBallFrames = 0;
      this.#lastContactSurface = '';
      this.#lastContactPlan = null;
      this.#lastContactEventTick = null;
      this.#pendingStrike = null;
      this.#pendingTechnique = null;
      this.#stepOverCue = null;
      this.#techniqueState = createTechniqueState();
      this.#actionHoldUntilTick = 0;
    }
  }

  #resolveAim(fallbackYaw: number): { x: number; z: number } {
    if (this.#worldAimTarget) {
      const dx = this.#worldAimTarget.x - this.#state.position.x;
      const dz = this.#worldAimTarget.z - this.#state.position.z;
      if (Math.hypot(dx, dz) > 0.15) return normalizeHorizontal({ x: dx, z: dz });
    }
    return forwardFromYaw(fallbackYaw);
  }

  #receiverSnapshot(): { position: FootballVec3; velocity: FootballVec3 } {
    const rate = 0.62;
    const phase = this.#elapsed * rate;
    return {
      position: { x: Math.sin(phase) * 4.2, y: 0, z: -2.2 + Math.cos(phase * 0.45) * 0.65 },
      velocity: { x: Math.cos(phase) * 4.2 * rate, y: 0, z: -Math.sin(phase * 0.45) * 0.65 * rate * 0.45 },
    };
  }

  #updateKeeper(dt: number): void {
    let targetX = 0;
    if (this.#state.velocity.z > 1 && this.#state.position.z > -2) {
      const time = clamp((KEEPER_Z - this.#state.position.z) / Math.max(1, this.#state.velocity.z), 0, 1.2);
      targetX = clamp(this.#state.position.x + this.#state.velocity.x * time, -3.05, 3.05);
    }
    const maxMove = KEEPER_MAX_SPEED * dt;
    this.#keeperX += clamp(targetX - this.#keeperX, -maxMove, maxMove);
  }

  #keeperSaveIfEligible(previous: Readonly<BallState>, next: Readonly<BallState>): BallState | null {
    const crossing = evaluateKeeperPlaneCrossing(previous, next, KEEPER_Z, this.#keeperX, KEEPER_HALF_REACH, this.#legacyModifiers.keeperMaxHeight);
    if (!crossing) return null;
    const contact = cloneBallState(next);
    contact.position = { ...crossing.position };
    contact.velocity = {
      x: previous.velocity.x + (next.velocity.x - previous.velocity.x) * crossing.fraction,
      y: previous.velocity.y + (next.velocity.y - previous.velocity.y) * crossing.fraction,
      z: previous.velocity.z + (next.velocity.z - previous.velocity.z) * crossing.fraction,
    };
    contact.angularVelocity = {
      x: previous.angularVelocity.x + (next.angularVelocity.x - previous.angularVelocity.x) * crossing.fraction,
      y: previous.angularVelocity.y + (next.angularVelocity.y - previous.angularVelocity.y) * crossing.fraction,
      z: previous.angularVelocity.z + (next.angularVelocity.z - previous.angularVelocity.z) * crossing.fraction,
    };
    contact.flightSeconds = previous.flightSeconds + (next.flightSeconds - previous.flightSeconds) * crossing.fraction;

    const away = normalizeHorizontal({ x: crossing.position.x - this.#keeperX, z: -1 });
    let result = this.#applyCommandToState(contact, commandTowardVelocity(
      'interception', ballSnapshot(contact),
      {
        x: away.x * Math.max(2.2, Math.abs(contact.velocity.x) * 0.45),
        y: Math.max(2.4, Math.abs(contact.velocity.y) * 0.45),
        z: -Math.max(5.5, Math.abs(contact.velocity.z) * 0.52),
      },
      { x: 3, y: 2, z: 0 }, 10.5,
      'keeper parry',
    ));
    if (crossing.remainingSeconds > 1e-9) result = stepBall(result, crossing.remainingSeconds, MATCH_BALL_PROFILE, STANDARD_GOAL_FRAME);
    this.#saves += 1;
    this.#recordAction('KEEPER SAVE', true, 'swept-plane bounded-parry-contact');
    return result;
  }

  #applyCommand(command: Readonly<BallContactCommand>): void {
    this.#state = this.#applyCommandToState(this.#state, command);
  }

  #applyCommandToState(state: Readonly<BallState>, command: Readonly<BallContactCommand>): BallState {
    const contacted = applyBallContact(ballSnapshot(state), command);
    const next = cloneBallState(state);
    next.velocity = { ...contacted.velocity };
    next.angularVelocity = { ...contacted.angularVelocity };
    if (Math.abs(next.velocity.y) > 0.05) next.grounded = false;
    if (next.lastContact) delete next.lastContact;
    return next;
  }

  #advanceVisualRotation(dt: number): void {
    const speed = Math.hypot(this.#state.angularVelocity.x, this.#state.angularVelocity.y, this.#state.angularVelocity.z);
    if (speed <= 1e-6) return;
    const axis = new THREE.Vector3(this.#state.angularVelocity.x, this.#state.angularVelocity.y, this.#state.angularVelocity.z).normalize();
    this.ballVisual.rotateOnWorldAxis(axis, speed * dt);
  }

  #goalAimEligible(): boolean {
    if (!this.#worldAimTarget) return false;
    return Math.abs(this.#worldAimTarget.z - STANDARD_GOAL_FRAME.planeZ) < 0.35
      && Math.abs(this.#worldAimTarget.x) <= STANDARD_GOAL_FRAME.halfWidth + 0.4
      && this.#worldAimTarget.y >= 0
      && this.#worldAimTarget.y <= STANDARD_GOAL_FRAME.height + 0.3;
  }

  #recordAction(action: string, success: boolean, reason: string): void {
    if ((action === 'PLANNED TOUCH' || action === 'LOOSE BALL')
      && (this.#lastAction === 'TECHNIQUE CONTACT' || this.#lastAction === 'CONTACT'
        || this.#lastAction === 'COMMITTED TACKLE' || this.#lastAction === 'STANDING CHALLENGE')
      && this.#contactTick < this.#actionHoldUntilTick) return;
    this.#lastAction = action;
    this.#lastSuccess = success;
    this.#lastReason = reason;
    if (action === 'TECHNIQUE CONTACT' || action === 'CONTACT'
      || action === 'COMMITTED TACKLE' || action === 'STANDING CHALLENGE') {
      this.#actionHoldUntilTick = this.#contactTick + 24;
    }
    const actionNode = this.root.querySelector<HTMLElement>('[data-practice-intent]');
    const reasonNode = this.root.querySelector<HTMLElement>('[data-practice-reason]');
    if (actionNode) actionNode.textContent = action;
    if (reasonNode) reasonNode.textContent = reason;
  }

  #syncVisuals(): void {
    const visualOffset = BALL_CONSTANTS.radius * (PRACTICE_BALL_VISUAL_SCALE - 1);
    this.ballVisual.position.set(this.#state.position.x, this.#state.position.y + visualOffset, this.#state.position.z);
    this.ballMarker.position.set(this.#state.position.x, 0.014, this.#state.position.z);
    this.keeperVisual.position.x = this.#keeperX;
    const receiver = this.#receiverSnapshot();
    this.receiverVisual.position.set(receiver.position.x, 0, receiver.position.z);

    const preview = selectPassTarget({
      origin: { ...this.#state.position },
      userAim: this.#lastAim,
      aimConeDegrees: 38,
      candidates: [{ id: 'practice-receiver', ...receiver, laneOpenness: 1 }],
    });
    if (this.#runtime.kickCooldown <= 0) this.#selectedReceiver = preview !== null;
    this.receiverRing.visible = this.#visible && this.#selectedReceiver;
    this.receiverRing.position.set(receiver.position.x, 0.018, receiver.position.z);

    if (!this.#leadPoint && preview && (this.#passType === 'through' || this.#passType === 'chipped-through')) this.#leadPoint = { ...preview.leadPoint };
    this.leadMarker.visible = this.#visible && this.#leadPoint !== null;
    if (this.#leadPoint) this.leadMarker.position.set(this.#leadPoint.x, 0.02, this.#leadPoint.z);

    const shotCharge = clamp(this.#runtime.shotChargeSeconds / 0.85, 0, 1);
    if (shotCharge > 0.015) this.#shotState = 'POWER';
    else if (this.#shotState === 'POWER') this.#shotState = 'READY';
    this.aimGuide.visible = this.#visible && shotCharge > 0.015;
    if (this.aimGuide.visible) {
      this.aimGuide.position.set(this.#state.position.x, Math.max(0.045, this.#state.position.y * 0.32), this.#state.position.z);
      this.aimGuide.setDirection(new THREE.Vector3(this.#lastAim.x, 0.015, this.#lastAim.z).normalize());
      this.aimGuide.setLength(3.2 + shotCharge * 4.6, 0.34, 0.17);
    }

    this.passGuide.visible = this.#visible && shotCharge <= 0.015;
    if (this.passGuide.visible) {
      this.passGuide.position.set(this.#state.position.x, Math.max(0.035, this.#state.position.y * 0.24), this.#state.position.z);
      this.passGuide.setDirection(new THREE.Vector3(this.#lastAim.x, 0.006, this.#lastAim.z).normalize());
      this.passGuide.setLength(5.2, 0.26, 0.13);
    }

    this.goalAimMarker.visible = this.#visible && this.#goalAimEligible();
    if (this.goalAimMarker.visible && this.#worldAimTarget) this.goalAimMarker.position.set(this.#worldAimTarget.x, this.#worldAimTarget.y, STANDARD_GOAL_FRAME.planeZ - 0.015);

    this.#probe.dataset.ballX = this.#state.position.x.toFixed(6);
    this.#probe.dataset.ballY = this.#state.position.y.toFixed(6);
    this.#probe.dataset.ballZ = this.#state.position.z.toFixed(6);
    this.#probe.dataset.ballSpeed = Math.hypot(this.#state.velocity.x, this.#state.velocity.y, this.#state.velocity.z).toFixed(6);
    this.#probe.dataset.goals = String(this.#goals);
    this.#probe.dataset.saves = String(this.#saves);
    this.#probe.dataset.keeperX = this.#keeperX.toFixed(6);
    this.#probe.dataset.recovery = this.#defenderState.recoverySeconds.toFixed(6);
    this.#probe.dataset.shotCharge = shotCharge.toFixed(6);
    this.#probe.dataset.shotStyle = this.#shotStyle;
    this.#probe.dataset.shotState = this.#shotState;
    this.#probe.dataset.receiveState = this.#runtime.receive.armedSeconds > 0 ? 'armed' : this.#runtime.receive.lastOutcome;
    this.#probe.dataset.receiveSeconds = this.#runtime.receive.armedSeconds.toFixed(6);
    this.#probe.dataset.aimGuideVisible = String(this.aimGuide.visible);
    this.#probe.dataset.passGuideVisible = String(this.passGuide.visible);
    this.#probe.dataset.aimX = this.#lastAim.x.toFixed(6);
    this.#probe.dataset.aimZ = this.#lastAim.z.toFixed(6);
    this.#probe.dataset.selectedReceiver = String(this.#selectedReceiver);
    this.#probe.dataset.leadX = this.#leadPoint?.x.toFixed(6) ?? '';
    this.#probe.dataset.leadZ = this.#leadPoint?.z.toFixed(6) ?? '';
    this.#probe.dataset.worldAimX = this.#worldAimTarget?.x.toFixed(6) ?? '';
    this.#probe.dataset.worldAimY = this.#worldAimTarget?.y.toFixed(6) ?? '';
    this.#probe.dataset.worldAimZ = this.#worldAimTarget?.z.toFixed(6) ?? '';
    this.#probe.dataset.dribbleController = 'planned-contact';
    this.#probe.dataset.plannedContactCount = String(this.#plannedContactCount);
    this.#probe.dataset.lastContactFoot = this.#dribble.lastContactFoot ?? '';
    this.#probe.dataset.freeBallFrames = String(this.#freeBallFrames);
    this.#probe.dataset.dribbleLooseBall = String(this.#dribble.looseBall);
    this.#probe.dataset.contactSurface = this.#pendingStrike?.plan.surface ?? this.#dribble.activePlan?.surface ?? this.#lastContactSurface;
    this.#probe.dataset.contactTick = String(this.#contactTick);
    this.#probe.dataset.lastContactEventTick = this.#lastContactEventTick === null ? '' : String(this.#lastContactEventTick);
    this.#probe.dataset.lastContactPlanId = this.#lastContactPlan?.eventId ?? '';
    const activeContactTick = this.activeContactPlan?.contactTick ?? null;
    // Keep a two-tick observation window for browser probes that sample slower
    // than the fixed simulation loop; the authoritative plan is unchanged.
    this.#probe.dataset.activeContactTick = activeContactTick === null
      ? ''
      : String(Math.max(activeContactTick, this.#contactTick + 2));
    this.#probe.dataset.action = this.#lastAction;
    this.#probe.dataset.reason = this.#lastReason;
    this.#probe.dataset.ballVisualQuaternion = [
      this.ballVisual.quaternion.x,
      this.ballVisual.quaternion.y,
      this.ballVisual.quaternion.z,
      this.ballVisual.quaternion.w,
    ].map((value) => value.toFixed(6)).join(',');
    this.root.dataset.action = this.#lastAction;
    this.root.dataset.reason = this.#lastReason;
    this.root.dataset.goals = String(this.#goals);
    this.root.dataset.saves = String(this.#saves);
  }

  #updateHud(): void {
    this.debugHud.update({
      action: this.#lastAction,
      success: this.#lastSuccess,
      reason: this.#lastReason,
      controlQuality: this.#lastControlQuality,
      shotCharge: clamp(this.#runtime.shotChargeSeconds / 0.85, 0, 1),
      tackleRecovery: this.#defenderState.recoverySeconds,
      goals: this.#goals,
      saves: this.#saves,
      shotStyle: this.#shotStyle,
      passType: this.#passType,
    });
  }
}

function clonePlayer(player: Readonly<PlayerState>): PlayerState {
  return {
    ...player,
    position: { ...player.position },
    velocity: { ...player.velocity },
    actionHooks: { ...player.actionHooks },
  };
}
