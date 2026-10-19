import * as THREE from 'three';
import { BALL_CONSTANTS, cloneBallState, createBallState, type BallState } from '@soccershooter/physics/ball/BallState';
import { MATCH_BALL_PROFILE } from '@soccershooter/physics/ball/aerodynamics';
import { BALL_SUBSTEP_DT, STANDARD_GOAL_FRAME, crossedGoalPlane, stepBall } from '@soccershooter/physics/ball/trajectory';
import type { InputIntent } from '@soccershooter/sim';
import { PlayerActionBits, type PlayerState } from '@soccershooter/sim/player/PlayerState';
import { decodeFootballActionIntent } from '@soccershooter/sim/football/actionIntent';
import { buildControlTouch } from '@soccershooter/sim/football/controlEnvelope';
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
import {
  consumeReceiveIntent,
  createFootballRuntimeState,
  createPlannedDribbleState,
  markControlTouch,
  markKick,
  stepFootballRuntime,
  stepPlannedDribble,
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
  type FootballVec3,
} from '@soccershooter/sim/football/types';
import { ActionDebugHud } from '../debug/ActionDebugHud';
import { resolveDribbleIntent, resolveTravelFacingYaw, updateShotFacingLock } from '../input/FootballControl';
import { PLAYER_VISUAL_LAYOUT } from '../presentation/PlayerVisualLayout';

export interface FootballPracticeOptions {
  scene: THREE.Scene;
  host: HTMLElement;
}

const CONTROLLED_BALL_POCKET = 0.68;
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
  return speed > 0.35
    ? normalizeHorizontal({ x: player.velocity.x, z: player.velocity.z })
    : forwardFromYaw(player.facingYaw);
}

function actorSnapshot(player: Readonly<PlayerState>): FootballActorSnapshot {
  const speed = Math.hypot(player.velocity.x, player.velocity.z);
  const movementBalance = player.locomotion === 'sharp-cut' ? 0.68 : player.grounded ? 1 : 0.58;
  const speedBalance = clamp(1 - Math.max(0, speed - 5.2) * 0.035, 0.72, 1);
  return {
    position: { ...player.position },
    velocity: { ...player.velocity },
    facingYaw: resolveTravelFacingYaw(player.velocity, player.facingYaw),
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

  #state = createBallState({ position: PRACTICE_BALL_START, grounded: true });
  #previousState = cloneBallState(this.#state);
  #runtime: FootballRuntimeState = createFootballRuntimeState();
  #dribble: PlannedDribbleState = createPlannedDribbleState();
  #defenderState: DefenderActionState = createDefenderActionState();
  #contactTick = 0;
  #plannedContactCount = 0;
  #freeBallFrames = 0;
  #lastContactSurface = '';
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
  #lastPlayer: PlayerState | null = null;
  #shotFacingYaw: number | null = null;
  #lastAim = { x: 0, z: 1 };
  #worldAimTarget: FootballVec3 | null = null;
  #selectedReceiver = false;
  #leadPoint: FootballVec3 | null = null;
  #shotState = 'READY';
  #probe: HTMLOutputElement;

  constructor(options: FootballPracticeOptions) {
    this.ballVisual = createBall(options.scene);
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

    this.root = document.createElement('section');
    this.root.className = 'football-practice-panel';
    this.root.dataset.footballPractice = 'true';
    this.root.innerHTML = `
      <div class="football-practice-heading">
        <div><span>Stage 05R contact slice</span><strong>Football Practice</strong></div>
        <span class="football-practice-live"><i></i> independent physical ball</span>
      </div>
      <p>WASD now drives gait-timed physical foot contacts with a free ball between touches. RMB shortens the stride and lowers exit speed for close control. Sprint remains on the legacy knock-on path until the next owner gate. F is receive/trap: F alone kills the ball; F + WASD takes the first touch out. Aim through the center reticle.</p>
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
      </details>
      <div class="practice-intent-status" aria-live="polite"><strong data-practice-intent>READY</strong><span data-practice-reason>point, move, receive, pass, or shoot</span></div>
      <output data-football-state data-ball-x="${this.#state.position.x}" data-ball-y="${this.#state.position.y}" data-ball-z="${this.#state.position.z}" data-goals="0" data-saves="0" data-shot-style="normal" data-shot-state="READY" data-receive-state="idle" data-selected-receiver="false" hidden></output>
    `;
    options.host.append(this.root);
    const probe = this.root.querySelector<HTMLOutputElement>('[data-football-state]');
    if (!probe) throw new Error('Football Practice missing state probe');
    this.#probe = probe;
    for (const button of this.root.querySelectorAll<HTMLButtonElement>('[data-shot-style]')) {
      button.addEventListener('click', () => this.setShotStyle(button.dataset.shotStyle as ShotStyle));
    }
    this.root.querySelector<HTMLButtonElement>('[data-football-reset]')?.addEventListener('click', () => this.resetBallNearLastPlayer());
    this.#syncVisuals();
    this.#updateHud();
  }

  get state(): Readonly<BallState> { return this.#state; }
  get tackleRecoverySeconds(): number { return this.#defenderState.recoverySeconds; }
  get shotStyle(): ShotStyle { return this.#shotStyle; }
  get visible(): boolean { return this.#visible; }

  get movementAuthority(): number {
    if (this.#defenderState.recoverySeconds >= 0.7) return 0.28;
    if (this.#defenderState.recoverySeconds > 0) return 0.58;
    return 1;
  }

  setWorldAimTarget(target: Readonly<FootballVec3> | null): void {
    this.#worldAimTarget = target ? { ...target } : null;
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
    const forward = forwardFromYaw(resolveTravelFacingYaw(player.velocity, player.facingYaw));
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
    this.#defenderState = stepDefenderActionState(this.#defenderState, dt);

    const actor = actorSnapshot(player);
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
      this.#recordAction(this.#shotState, shot.legal, shot.reason);
      if (shot.command) {
        this.#applyCommand(shot.command);
        this.#resetPlannedDribble(false);
        this.#state.knuckleSeed = shot.knuckleSeed;
        this.#runtime = markKick(this.#runtime, 'shot');
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
      this.#recordAction(solution.legal ? 'CONTACT' : 'PASS FAILED', solution.legal, `${this.#passType}: ${solution.reason}`);
      if (solution.command) {
        this.#applyCommand(solution.command);
        this.#resetPlannedDribble(false);
        this.#runtime = markKick(this.#runtime, 'pass');
      }
      this.#updateHud();
      return;
    }

    const receiveArmed = this.#runtime.receive.armedSeconds > 0;
    const receiveMode = receiveArmed ? resolveReceiveMode(dribbleIntent.magnitude) : null;
    const controlAvailable = this.#runtime.kickCooldown <= 0 && this.#defenderState.recoverySeconds <= 0.08;

    if (!intent.sprint && controlAvailable) {
      const contactPlan = this.#dribble.activePlan;
      const planned = stepPlannedDribble({
        tick: contactTick,
        state: this.#dribble,
        actor,
        motion: player.athleticMotion,
        ball: snapshot,
        desiredDirection: dribbleIntent.direction,
        precision,
        sprint: false,
        pressure: actor.pressure,
        moveIntentMagnitude: dribbleIntent.magnitude,
        receiveMode,
      });
      this.#dribble = planned.state;

      if (planned.contactApplied) {
        const next = cloneBallState(this.#state);
        next.velocity = { ...planned.ball.velocity };
        next.angularVelocity = { ...planned.ball.angularVelocity };
        if (Math.abs(next.velocity.y) > 0.05) next.grounded = false;
        if (next.lastContact) delete next.lastContact;
        this.#state = next;
        this.#plannedContactCount += 1;
        this.#lastControlQuality = contactPlan?.quality ?? 1;
        this.#lastContactSurface = contactPlan?.surface ?? '';
        if (receiveMode) this.#runtime = consumeReceiveIntent(this.#runtime);
        const action = contactPlan?.kind === 'trap'
          ? 'CUSHION TOUCH'
          : receiveMode === 'controlled-exit'
            ? 'CONTROLLED EXIT'
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
    } else if (intent.sprint && this.#runtime.controlTouchCooldown <= 0 && controlAvailable) {
      // Task 4 migrates sprint knock-ons and effort turns. Until the owner has
      // approved this normal/RMB slice, keep sprint behavior isolated on the
      // previously verified path rather than half-migrating it here.
      this.#resetPlannedDribble(false);
      const touch = buildControlTouch({
        actor,
        ball: snapshot,
        desiredDirection: dribbleIntent.direction,
        precision,
        sprint: true,
        pressure: actor.pressure,
        moveIntentMagnitude: dribbleIntent.magnitude,
        receiveMode,
      });
      this.#lastControlQuality = touch.quality;
      if (touch.eligible && touch.command) {
        this.#applyCommand(touch.command);
        this.#runtime = markControlTouch(this.#runtime, true, touch.touchMode);
        if (receiveMode) this.#runtime = consumeReceiveIntent(this.#runtime);
        const action = touch.touchMode === 'trap'
          ? 'CUSHION TOUCH'
          : touch.touchMode === 'receive-exit'
            ? 'CONTROLLED EXIT'
            : touch.touchMode === 'effort-turn'
              ? 'EFFORT TURN'
              : `${touch.touchMode.toUpperCase()} TOUCH`;
        this.#recordAction(action, true, touch.touchMode);
      } else if (receiveArmed) {
        const readableReason = touch.reason === 'out-of-reach' ? 'waiting for legal contact' : touch.reason;
        this.#recordAction('TRAP ARMED', touch.reason === 'out-of-reach', readableReason);
      } else if (touch.reason !== 'out-of-reach' && touch.reason !== 'idle-no-touch') {
        this.#recordAction('FIRST TOUCH FAILED', false, touch.reason);
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

  #resetPlannedDribble(resetCounters: boolean): void {
    this.#dribble = createPlannedDribbleState();
    if (resetCounters) {
      this.#contactTick = 0;
      this.#plannedContactCount = 0;
      this.#freeBallFrames = 0;
      this.#lastContactSurface = '';
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
    const crossing = evaluateKeeperPlaneCrossing(previous, next, KEEPER_Z, this.#keeperX, KEEPER_HALF_REACH, 2.18);
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
    this.#lastAction = action;
    this.#lastSuccess = success;
    this.#lastReason = reason;
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
    this.#probe.dataset.contactSurface = this.#dribble.activePlan?.surface ?? this.#lastContactSurface;
    this.#probe.dataset.contactTick = String(this.#contactTick);
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
