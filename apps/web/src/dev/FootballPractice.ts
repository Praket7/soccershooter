import * as THREE from 'three';
import { BALL_CONSTANTS, cloneBallState, createBallState, type BallState } from '@soccershooter/physics/ball/BallState';
import { MATCH_BALL_PROFILE } from '@soccershooter/physics/ball/aerodynamics';
import { BALL_SUBSTEP_DT, STANDARD_GOAL_FRAME, crossedGoalPlane, stepBall } from '@soccershooter/physics/ball/trajectory';
import type { InputIntent } from '@soccershooter/sim';
import { PlayerActionBits, type PlayerState } from '@soccershooter/sim/player/PlayerState';
import { buildControlTouch } from '@soccershooter/sim/football/controlEnvelope';
import { solvePass, type PassType } from '@soccershooter/sim/football/passing';
import { buildShot, type ShotStyle } from '@soccershooter/sim/football/shooting';
import {
  createDefenderActionState,
  evaluateInterception,
  resolveChallenge,
  stepDefenderActionState,
  type DefenderActionState,
} from '@soccershooter/sim/football/defending';
import { evaluateAerialContact } from '@soccershooter/sim/football/aerial';
import {
  createFootballRuntimeState,
  markControlTouch,
  markKick,
  stepFootballRuntime,
  type FootballRuntimeState,
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

export interface FootballPracticeOptions {
  scene: THREE.Scene;
  host: HTMLElement;
}

const PRACTICE_BALL_START = Object.freeze({ x: 0, y: BALL_CONSTANTS.radius, z: -11.7 });
const KEEPER_Z = STANDARD_GOAL_FRAME.planeZ - 0.72;
const KEEPER_MAX_SPEED = 4.8;
const KEEPER_HALF_REACH = 0.68;
const VISUAL_SCALE = 1.35;
const PRACTICE_KNUCKLE_SEED = 0x5a17f00d;
const SHOT_STYLES: readonly ShotStyle[] = Object.freeze([
  'normal', 'driven', 'finesse', 'chip', 'knuckle', 'outside-foot',
]);

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
    facingYaw: player.facingYaw,
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
  const radius = BALL_CONSTANTS.radius * VISUAL_SCALE;
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

function createAthleteMarker(scene: THREE.Scene, color: number, name: string): THREE.Group {
  const group = new THREE.Group();
  group.name = name;
  const material = new THREE.MeshStandardMaterial({ color, roughness: 0.68 });
  const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.33, 1.04, 16), material);
  torso.position.y = 0.78;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.2, 14, 10), material);
  head.position.y = 1.48;
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
  arms.position.y = 1.25;
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

export class FootballPractice {
  readonly root: HTMLElement;
  readonly ballVisual: THREE.Group;
  readonly keeperVisual: THREE.Group;
  readonly receiverVisual: THREE.Group;
  readonly oppositeGoalVisual: THREE.Group;
  readonly debugHud: ActionDebugHud;

  #state = createBallState({ position: PRACTICE_BALL_START, grounded: true });
  #previousState = cloneBallState(this.#state);
  #runtime: FootballRuntimeState = createFootballRuntimeState();
  #defenderState: DefenderActionState = createDefenderActionState();
  #accumulator = 0;
  #elapsed = 0;
  #visible = true;
  #shotStyle: ShotStyle = 'normal';
  #passType: PassType = 'ground';
  #goals = 0;
  #saves = 0;
  #keeperX = 0;
  #goalLatched = false;
  #resetCountdown = 0;
  #lastControlQuality: number | null = null;
  #lastAction = 'ready';
  #lastReason = 'practice-ready';
  #lastSuccess = true;
  #lastPlayer: PlayerState | null = null;
  #probe: HTMLOutputElement;

  constructor(options: FootballPracticeOptions) {
    this.ballVisual = createBall(options.scene);
    this.keeperVisual = createKeeper(options.scene);
    this.receiverVisual = createAthleteMarker(options.scene, 0xf4c95d, 'stage05-pass-receiver');
    this.oppositeGoalVisual = createOppositeGoal(options.scene);
    this.debugHud = new ActionDebugHud(options.host);

    this.root = document.createElement('section');
    this.root.className = 'football-practice-panel';
    this.root.dataset.footballPractice = 'true';
    this.root.innerHTML = `
      <div class="football-practice-heading">
        <div><span>Stage 05</span><strong>Football Practice</strong></div>
        <span class="football-practice-live"><i></i> physical ball</span>
      </div>
      <p>Dribble with movement. Hold LMB to charge, release to shoot. RMB tightens touches. E passes to the moving gold receiver. Q modifies passes. Sprint + tackle commits.</p>
      <div class="shot-style-row" role="group" aria-label="Shot contact style">
        ${SHOT_STYLES.map((style, index) => `<button type="button" data-shot-style="${style}" data-active="${style === this.#shotStyle}"><kbd>${index + 1}</kbd>${style}</button>`).join('')}
      </div>
      <div class="practice-actions">
        <button type="button" data-football-reset>Reset ball <kbd>G</kbd></button>
        <span>E ground · RMB+E through · Q+E driven · Q+RMB+E lofted</span>
      </div>
      <output data-football-state data-ball-x="${this.#state.position.x}" data-ball-y="${this.#state.position.y}" data-ball-z="${this.#state.position.z}" data-goals="0" data-saves="0" data-shot-style="normal" hidden></output>
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

  setVisible(visible: boolean): void {
    this.#visible = visible;
    this.root.hidden = !visible;
    this.debugHud.setVisible(visible);
    this.ballVisual.visible = visible;
    this.keeperVisual.visible = visible;
    this.receiverVisual.visible = visible;
    this.oppositeGoalVisual.visible = visible;
  }

  setShotStyle(style: ShotStyle): void {
    if (!SHOT_STYLES.includes(style)) return;
    this.#shotStyle = style;
    this.#probe.dataset.shotStyle = style;
    for (const button of this.root.querySelectorAll<HTMLButtonElement>('[data-shot-style]')) {
      button.dataset.active = String(button.dataset.shotStyle === style);
    }
    this.#recordAction('style', true, style);
    this.#updateHud();
  }

  resetBallNear(player: Readonly<PlayerState>): void {
    const forward = forwardFromYaw(player.facingYaw);
    this.#state = createBallState({
      position: {
        x: player.position.x + forward.x * 1.05,
        y: BALL_CONSTANTS.radius,
        z: player.position.z + forward.z * 1.05,
      },
      grounded: true,
    });
    this.#previousState = cloneBallState(this.#state);
    this.#runtime = createFootballRuntimeState();
    this.#accumulator = 0;
    this.#goalLatched = false;
    this.#resetCountdown = 0;
    this.ballVisual.quaternion.identity();
    this.#recordAction('reset', true, 'ball-reset-in-front');
    this.#syncVisuals();
    this.#updateHud();
  }

  resetBallNearLastPlayer(): void {
    if (this.#lastPlayer) this.resetBallNear(this.#lastPlayer);
    else {
      this.#state = createBallState({ position: PRACTICE_BALL_START, grounded: true });
      this.#previousState = cloneBallState(this.#state);
      this.ballVisual.quaternion.identity();
      this.#syncVisuals();
    }
  }

  processIntent(player: Readonly<PlayerState>, intent: Readonly<InputIntent>, dt: number): void {
    if (!this.#visible) return;
    this.#lastPlayer = clonePlayer(player);
    this.#elapsed += Math.max(0, dt);
    const runtimeStep = stepFootballRuntime(this.#runtime, intent.actionBits, dt);
    this.#runtime = runtimeStep.state;
    this.#defenderState = stepDefenderActionState(this.#defenderState, dt);

    const actor = actorSnapshot(player);
    const snapshot = ballSnapshot(this.#state);
    const precision = (intent.actionBits & PlayerActionBits.Precision) !== 0;
    const technique = (intent.actionBits & PlayerActionBits.Technique) !== 0;
    const tackle = (intent.actionBits & PlayerActionBits.Tackle) !== 0;
    const jump = (intent.actionBits & PlayerActionBits.Jump) !== 0;
    const pass = (intent.actionBits & PlayerActionBits.Pass) !== 0;
    const aim = forwardFromYaw(intent.aimYaw);

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
      this.#recordAction(intent.sprint ? 'committed tackle' : 'standing challenge', challenge.wonBall, challenge.reason);
      if (challenge.command) this.#applyCommand(challenge.command);
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
        this.#runtime = markKick(this.#runtime, 'shot');
        this.#recordAction('header', true, 'legal-aerial-window');
        this.#updateHud();
        return;
      }
    }

    if (runtimeStep.releasedShotCharge !== null && this.#runtime.kickCooldown <= 0) {
      const elevated = this.#state.position.y > 0.34;
      if (elevated) {
        const volley = evaluateAerialContact({ kind: 'volley', actor, ball: snapshot, jumpRequested: jump });
        if (!volley.eligible) {
          this.#recordAction('volley', false, volley.reason);
          this.#updateHud();
          return;
        }
      }
      const shot = buildShot({
        style: this.#shotStyle,
        shooter: actor,
        ball: snapshot,
        aim,
        charge: runtimeStep.releasedShotCharge,
        spinInput: precision ? 0.82 : technique ? 0.38 : 0.18,
        pressure: actor.pressure,
        balance: actor.balance,
        contactFoot: actor.preferredFoot,
        knuckleSeed: PRACTICE_KNUCKLE_SEED,
      });
      this.#recordAction(elevated ? 'volley' : `${this.#shotStyle} shot`, shot.legal, shot.reason);
      if (shot.command) {
        this.#applyCommand(shot.command);
        this.#state.knuckleSeed = shot.knuckleSeed;
        this.#runtime = markKick(this.#runtime, 'shot');
      }
      this.#updateHud();
      return;
    }

    if (pass && this.#runtime.kickCooldown <= 0) {
      this.#passType = technique && precision ? 'lofted' : technique ? 'driven' : precision ? 'through' : 'ground';
      const solution = solvePass({
        type: this.#passType,
        passer: actor,
        ball: snapshot,
        receiver: this.#receiverSnapshot(),
        userAim: aim,
        assist: 0.58,
        pressure: actor.pressure,
        allowBehindBodyTechnique: false,
      });
      this.#recordAction(`${this.#passType} pass`, solution.legal, solution.reason);
      if (solution.command) {
        this.#applyCommand(solution.command);
        this.#runtime = markKick(this.#runtime, 'pass');
      }
      this.#updateHud();
      return;
    }

    if (precision && this.#runtime.kickCooldown <= 0) {
      const interception = evaluateInterception({ defender: actor, ball: snapshot, horizonSeconds: 0.18 });
      if (interception.eligible && interception.timeToWindow <= 0.11) {
        const desired = playerDirection(player);
        this.#applyCommand(commandTowardVelocity(
          'interception', snapshot,
          { x: desired.x * 3.6, y: 0, z: desired.z * 3.6 },
          { x: -2, y: 0, z: 0 }, 3.4,
          `interception t=${interception.timeToWindow.toFixed(3)}`,
        ));
        this.#runtime = markControlTouch(this.#runtime, false);
        this.#recordAction('interception', true, 'contain-window');
        this.#updateHud();
        return;
      }
    }

    if (this.#runtime.controlTouchCooldown <= 0 && this.#runtime.kickCooldown <= 0 && this.#defenderState.recoverySeconds <= 0.08) {
      const touch = buildControlTouch({
        actor,
        ball: snapshot,
        desiredDirection: playerDirection(player),
        precision,
        sprint: intent.sprint,
        pressure: actor.pressure,
      });
      this.#lastControlQuality = touch.quality;
      if (touch.eligible && touch.command) {
        this.#applyCommand(touch.command);
        this.#runtime = markControlTouch(this.#runtime, intent.sprint);
        this.#recordAction(intent.sprint ? 'sprint touch' : precision ? 'precision touch' : 'control touch', true, touch.reason);
      } else if (touch.reason !== 'out-of-reach' && touch.reason !== 'idle-no-touch') {
        this.#recordAction('first touch', false, touch.reason);
      }
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
        this.#recordAction('goal', true, 'whole-ball-crossed-line');
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
    if (previous.velocity.z <= 0 || !(previous.position.z < KEEPER_Z && next.position.z >= KEEPER_Z)) return null;
    if (Math.abs(next.position.x - this.#keeperX) > KEEPER_HALF_REACH || next.position.y > 2.18) return null;
    const away = normalizeHorizontal({ x: next.position.x - this.#keeperX, z: -1 });
    const result = this.#applyCommandToState(next, commandTowardVelocity(
      'interception', ballSnapshot(next),
      {
        x: away.x * Math.max(2.2, Math.abs(next.velocity.x) * 0.45),
        y: Math.max(2.4, Math.abs(next.velocity.y) * 0.45),
        z: -Math.max(5.5, Math.abs(next.velocity.z) * 0.52),
      },
      { x: 3, y: 2, z: 0 }, 10.5,
      'keeper parry',
    ));
    this.#saves += 1;
    this.#recordAction('keeper save', true, 'bounded-parry-contact');
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
    const speed = Math.hypot(
      this.#state.angularVelocity.x,
      this.#state.angularVelocity.y,
      this.#state.angularVelocity.z,
    );
    if (speed <= 1e-6) return;
    const axis = new THREE.Vector3(
      this.#state.angularVelocity.x,
      this.#state.angularVelocity.y,
      this.#state.angularVelocity.z,
    ).normalize();
    this.ballVisual.rotateOnWorldAxis(axis, speed * dt);
  }

  #recordAction(action: string, success: boolean, reason: string): void {
    this.#lastAction = action;
    this.#lastSuccess = success;
    this.#lastReason = reason;
  }

  #syncVisuals(): void {
    const visualOffset = BALL_CONSTANTS.radius * (VISUAL_SCALE - 1);
    this.ballVisual.position.set(this.#state.position.x, this.#state.position.y + visualOffset, this.#state.position.z);
    this.keeperVisual.position.x = this.#keeperX;
    const receiver = this.#receiverSnapshot();
    this.receiverVisual.position.set(receiver.position.x, 0, receiver.position.z);
    this.#probe.dataset.ballX = this.#state.position.x.toFixed(6);
    this.#probe.dataset.ballY = this.#state.position.y.toFixed(6);
    this.#probe.dataset.ballZ = this.#state.position.z.toFixed(6);
    this.#probe.dataset.ballSpeed = Math.hypot(this.#state.velocity.x, this.#state.velocity.y, this.#state.velocity.z).toFixed(6);
    this.#probe.dataset.goals = String(this.#goals);
    this.#probe.dataset.saves = String(this.#saves);
    this.#probe.dataset.keeperX = this.#keeperX.toFixed(6);
    this.#probe.dataset.recovery = this.#defenderState.recoverySeconds.toFixed(6);
    this.#probe.dataset.shotCharge = (this.#runtime.shotChargeSeconds / 0.85).toFixed(6);
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
