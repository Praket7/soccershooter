import * as THREE from 'three';
import { runReferenceTrace } from '@soccershooter/sim/referenceTrace';
import { PlayerActionBits, clonePlayerState, createPlayerState, type PlayerState } from '@soccershooter/sim/player/PlayerState';
import {
  BENCHMARK_COURSE,
  DEFAULT_MOVEMENT_CONFIG,
  PLAYER_MOVEMENT_TICK_HZ,
  createMovementBenchmarkWorld,
  recordMovementTrace,
  stepPlayerMovement,
  type MovementTrace,
  type MovementWorld,
} from '@soccershooter/sim/player/movement';
import type { ShotStyle } from '@soccershooter/sim/football/shooting';
import { ActionMap } from './input/ActionMap';
import { GamepadAdapter } from './input/GamepadAdapter';
import { mergeInputSources } from './input/InputMerge';
import { ThirdPersonCamera, type CameraObstacle } from './camera/ThirdPersonCamera';
import { MovementHud } from './debug/MovementHud';
import { BallLab } from './dev/BallLab';
import { FootballPractice } from './dev/FootballPractice';
import './styles.css';

function requireElement<T extends Element>(selector: string): T {
  const element = document.querySelector<T>(selector);
  if (!element) throw new Error(`Missing required element: ${selector}`);
  return element;
}

const app = requireElement<HTMLElement>('#app');

const reference = runReferenceTrace();
app.innerHTML = `
  <div class="movement-lab-shell">
    <header class="lab-header">
      <div>
        <p class="eyebrow">Stage 05 · core football interactions</p>
        <h1>SoccerShooter Movement Lab</h1>
        <p class="subtitle">Physical first touch, dribbling, passing, six shot contacts, defending, aerials, and a greybox keeper now run on the Stage 04 ball model.</p>
      </div>
      <div class="header-actions">
        <div class="mode-switch" role="group" aria-label="Practice mode">
          <button type="button" data-mode-practice data-active="true">Football Practice</button>
          <button type="button" data-mode-ball-lab data-active="false">Ball Lab</button>
        </div>
        <div class="status-pill"><span></span> FICTIONAL_PUBLIC</div>
      </div>
    </header>
    <section class="viewport-wrap" aria-label="Stage 05 football practice and movement benchmark">
      <div id="game-viewport" class="game-viewport"></div>
      <aside class="control-card">
        <strong>Football controls</strong>
        <span>WASD · move / shape body</span>
        <span>Mouse / right stick · camera + aim</span>
        <span>Shift / L3 · sprint</span>
        <span>LMB / RT · hold power, release shot</span>
        <span>RMB / LT · precision touch / through pass</span>
        <span>E / X · pass · Q / RB technique modifier</span>
        <span>Space / A · aerial contest / header</span>
        <span>C / B · challenge · sprint + C commits</span>
        <span>1–6 · practice shot contact · G reset ball</span>
      </aside>
      <aside class="action-feedback" data-action-feedback data-action="idle" aria-live="polite">
        <strong>PLAY READY</strong>
        <span>Move into the ball and let each physical touch breathe</span>
      </aside>
      <aside class="course-card">
        <strong>Stage 05 focus</strong>
        <span>first touch</span><span>close dribble</span><span>sprint touch</span>
        <span>ground / lead pass</span><span>six shot contacts</span><span>keeper read</span>
        <span>challenge timing</span><span>aerial window</span>
      </aside>
    </section>
    <footer class="lab-footer">
      <span>Practice: LMB shoot · RMB precision · E pass · Q modifier · G reset</span>
      <span>Tools: mode switch · R trace · P replay · X player reset · F1 HUD · ${PLAYER_MOVEMENT_TICK_HZ} Hz</span>
    </footer>
    <output data-determinism-hash="${reference.hash}" data-determinism-ticks="${reference.ticks}" hidden>${reference.hash}</output>
    <output data-player-state data-x="0" data-z="${BENCHMARK_COURSE.spawn.z}" data-movement-tick-hz="${PLAYER_MOVEMENT_TICK_HZ}" hidden></output>
  </div>
`;

document.title = 'SoccerShooter Core Football Practice';

const viewport = requireElement<HTMLElement>('#game-viewport');
const playerProbe = requireElement<HTMLOutputElement>('[data-player-state]');
const actionFeedback = requireElement<HTMLElement>('[data-action-feedback]');
const practiceModeButton = requireElement<HTMLButtonElement>('[data-mode-practice]');
const ballLabModeButton = requireElement<HTMLButtonElement>('[data-mode-ball-lab]');

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0b1118);
scene.fog = new THREE.Fog(0x0b1118, 26, 58);

const camera = new THREE.PerspectiveCamera(55, 1, 0.05, 100);
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.domElement.dataset.gameViewport = 'true';
renderer.domElement.setAttribute('aria-label', 'Interactive SoccerShooter core football practice');
viewport.append(renderer.domElement);

scene.add(new THREE.HemisphereLight(0xbdd8ff, 0x29321f, 1.65));
const sun = new THREE.DirectionalLight(0xffffff, 2.4);
sun.position.set(-8, 18, -10);
sun.castShadow = true;
sun.shadow.mapSize.set(1024, 1024);
sun.shadow.camera.left = -28;
sun.shadow.camera.right = 28;
sun.shadow.camera.top = 22;
sun.shadow.camera.bottom = -22;
scene.add(sun);

const world = createMovementBenchmarkWorld();
const practiceWorld: MovementWorld = { bounds: world.bounds, obstacles: [], ground: [] };
const courseVisuals: THREE.Object3D[] = [];

function addBox(
  size: { x: number; y: number; z: number },
  position: { x: number; y: number; z: number },
  material: THREE.Material,
): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(size.x, size.y, size.z), material);
  mesh.position.set(position.x, position.y, position.z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  scene.add(mesh);
  return mesh;
}

const pitchMaterial = new THREE.MeshStandardMaterial({ color: 0x28323a, roughness: 0.94, metalness: 0.02 });
const pitch = new THREE.Mesh(new THREE.PlaneGeometry(48, 32), pitchMaterial);
pitch.rotation.x = -Math.PI / 2;
pitch.position.y = -0.015;
pitch.receiveShadow = true;
scene.add(pitch);

const grid = new THREE.GridHelper(48, 48, 0x52616d, 0x36434d);
grid.position.y = 0.005;
scene.add(grid);

const zoneMaterial = new THREE.MeshBasicMaterial({ color: 0x6ee7d1, transparent: true, opacity: 0.23 });
for (const zone of BENCHMARK_COURSE.zones) {
  const marker = new THREE.Mesh(new THREE.PlaneGeometry(zone.size.x, zone.size.z), zoneMaterial);
  marker.rotation.x = -Math.PI / 2;
  marker.position.set(zone.center.x, 0.012, zone.center.z);
  scene.add(marker);
  courseVisuals.push(marker);
}

const obstacleMaterial = new THREE.MeshStandardMaterial({ color: 0x66717b, roughness: 0.9 });
const coneMaterial = new THREE.MeshStandardMaterial({ color: 0xe4a853, roughness: 0.82 });
for (const obstacle of world.obstacles) {
  if (obstacle.id.startsWith('slalom')) {
    const cone = new THREE.Mesh(new THREE.ConeGeometry(0.24, 1.02, 18), coneMaterial);
    cone.position.set((obstacle.minX + obstacle.maxX) / 2, 0.51, (obstacle.minZ + obstacle.maxZ) / 2);
    cone.castShadow = true;
    scene.add(cone);
    courseVisuals.push(cone);
    continue;
  }
  courseVisuals.push(addBox(
    { x: obstacle.maxX - obstacle.minX, y: obstacle.maxY - obstacle.minY, z: obstacle.maxZ - obstacle.minZ },
    { x: (obstacle.minX + obstacle.maxX) / 2, y: (obstacle.minY + obstacle.maxY) / 2, z: (obstacle.minZ + obstacle.maxZ) / 2 },
    obstacleMaterial,
  ));
}

const groundFeatureMaterial = new THREE.MeshStandardMaterial({ color: 0x485965, roughness: 0.88 });
for (const patch of world.ground) {
  const width = patch.maxX - patch.minX;
  const depth = patch.maxZ - patch.minZ;
  if (patch.slopeX !== 0 || patch.slopeZ !== 0) {
    const riseX = patch.slopeX * width;
    const riseZ = patch.slopeZ * depth;
    const averageHeight = patch.baseHeight + riseX / 2 + riseZ / 2;
    const ramp = addBox(
      { x: width, y: 0.08, z: depth },
      { x: (patch.minX + patch.maxX) / 2, y: Math.max(0.04, averageHeight), z: (patch.minZ + patch.maxZ) / 2 },
      groundFeatureMaterial,
    );
    ramp.rotation.z = Math.atan(patch.slopeX);
    ramp.rotation.x = -Math.atan(patch.slopeZ);
    courseVisuals.push(ramp);
  } else {
    courseVisuals.push(addBox(
      { x: width, y: Math.max(0.04, patch.baseHeight), z: depth },
      { x: (patch.minX + patch.maxX) / 2, y: patch.baseHeight / 2, z: (patch.minZ + patch.maxZ) / 2 },
      groundFeatureMaterial,
    ));
  }
}

const stopLineMaterial = new THREE.MeshBasicMaterial({ color: 0xf2ce6b });
courseVisuals.push(addBox({ x: 4.2, y: 0.025, z: 0.08 }, { x: 4, y: 0.018, z: -5 }, stopLineMaterial));
const cutLine = addBox({ x: 0.08, y: 0.025, z: 3 }, { x: -4, y: 0.018, z: -5 }, stopLineMaterial);
cutLine.rotation.y = Math.PI / 4;
courseVisuals.push(cutLine);

const playerGroup = new THREE.Group();
const bodyMaterial = new THREE.MeshStandardMaterial({ color: 0xd9f35b, roughness: 0.62, metalness: 0.02 });
const accentMaterial = new THREE.MeshStandardMaterial({ color: 0x10202a, roughness: 0.75 });
const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.38, 1.08, 20), bodyMaterial);
torso.position.y = 0.82;
torso.castShadow = true;
playerGroup.add(torso);
const head = new THREE.Mesh(new THREE.SphereGeometry(0.25, 18, 14), bodyMaterial);
head.position.y = 1.58;
head.castShadow = true;
playerGroup.add(head);
const facingBar = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 0.78), accentMaterial);
facingBar.position.set(0, 1.1, 0.42);
playerGroup.add(facingBar);
scene.add(playerGroup);

const cameraObstacles: CameraObstacle[] = world.obstacles.map((obstacle) => ({ ...obstacle }));
const cameraController = new ThirdPersonCamera();
const actionMap = new ActionMap(window, renderer.domElement);
actionMap.attach();
const gamepad = new GamepadAdapter();
const hud = new MovementHud(document.body);
const ballLab = new BallLab({ scene, host: viewport });
const footballPractice = new FootballPractice({ scene, host: viewport });

const FIXED_DT = 1 / PLAYER_MOVEMENT_TICK_HZ;
const ACTION_FEEDBACK_MS = 480;
const EDGE_ACTION_BITS = PlayerActionBits.Jump | PlayerActionBits.Tackle | PlayerActionBits.Pass | PlayerActionBits.ShootReleased;
const HELD_ACTION_BITS = PlayerActionBits.ShootHeld | PlayerActionBits.Precision | PlayerActionBits.Technique;
let player = createPlayerState({ position: BENCHMARK_COURSE.spawn, stamina: DEFAULT_MOVEMENT_CONFIG.staminaMax });
let previousPlayer = clonePlayerState(player);
let accumulator = 0;
let simTick = 0;
let lastFrameTime = performance.now();
let smoothedFps = 60;
let lastAcceleration = 0;
let lastAppliedInputTimestamp = -Infinity;
let inputToSimulationMs: number | null = null;
let inputToRenderMs: number | null = null;
let pendingRenderAckTimestamp: number | null = null;
let bufferedActionBits = 0;
let lastActionFlash: 'jump' | 'tackle' | null = null;
let actionFlashUntil = 0;
let recording = false;
let recordedIntents: Array<ReturnType<ActionMap['consumeFrame']>['intent']> = [];
let recordingInitial = clonePlayerState(player);
let lastTrace: MovementTrace | null = null;
let playbackIndex: number | null = null;
let practiceMode = true;

function setBallLabTrails(enabled: boolean): void {
  const input = ballLab.root.querySelector<HTMLInputElement>('[data-ball-trail]');
  if (!input || input.checked === enabled) return;
  input.checked = enabled;
  input.dispatchEvent(new Event('change', { bubbles: true }));
}

function setMode(mode: 'practice' | 'ball-lab'): void {
  practiceMode = mode === 'practice';
  footballPractice.setVisible(practiceMode);
  ballLab.root.hidden = practiceMode;
  ballLab.ballVisual.visible = !practiceMode;
  ballLab.goalVisual.visible = true;
  setBallLabTrails(!practiceMode);
  for (const visual of courseVisuals) visual.visible = !practiceMode;
  practiceModeButton.dataset.active = String(practiceMode);
  ballLabModeButton.dataset.active = String(!practiceMode);
  playerProbe.dataset.mode = mode;
}

practiceModeButton.addEventListener('click', () => setMode('practice'));
ballLabModeButton.addEventListener('click', () => setMode('ball-lab'));
setMode('practice');

function resetPlayer(): void {
  player = createPlayerState({ position: BENCHMARK_COURSE.spawn, stamina: DEFAULT_MOVEMENT_CONFIG.staminaMax });
  previousPlayer = clonePlayerState(player);
  accumulator = 0;
  simTick = 0;
  bufferedActionBits = 0;
  lastActionFlash = null;
  actionFlashUntil = 0;
  playbackIndex = null;
  recording = false;
  recordedIntents = [];
  if (practiceMode) footballPractice.resetBallNear(player);
}

const practiceStyles: readonly ShotStyle[] = ['normal', 'driven', 'finesse', 'chip', 'knuckle', 'outside-foot'];
document.addEventListener('keydown', (event) => {
  if (!practiceMode || event.repeat) return;
  if (event.code === 'KeyE') {
    bufferedActionBits |= PlayerActionBits.Pass;
    event.preventDefault();
    event.stopPropagation();
    return;
  }
  const digit = Number(event.key);
  if (Number.isInteger(digit) && digit >= 1 && digit <= practiceStyles.length) {
    footballPractice.setShotStyle(practiceStyles[digit - 1]!);
    event.preventDefault();
    event.stopPropagation();
    return;
  }
  if (event.code === 'KeyG') {
    footballPractice.resetBallNear(player);
    event.preventDefault();
    event.stopPropagation();
    return;
  }
  if (event.code === 'KeyL' || event.code === 'Digit0') {
    event.stopPropagation();
  }
}, true);

window.addEventListener('keydown', (event) => {
  if (event.repeat) return;
  if (event.code === 'F1') {
    event.preventDefault();
    hud.toggle();
  } else if (event.code === 'KeyX') {
    resetPlayer();
  } else if (event.code === 'KeyR') {
    if (!recording) {
      recording = true;
      recordedIntents = [];
      recordingInitial = clonePlayerState(player);
    } else {
      recording = false;
      lastTrace = recordMovementTrace(recordingInitial, recordedIntents, PLAYER_MOVEMENT_TICK_HZ);
    }
  } else if (event.code === 'KeyP' && lastTrace) {
    player = clonePlayerState(lastTrace.initialState);
    previousPlayer = clonePlayerState(player);
    playbackIndex = 0;
    recording = false;
  }
});

function copyIntent(intent: ReturnType<ActionMap['consumeFrame']>['intent']) {
  return { ...intent };
}

function interpolatedPlayer(alpha: number): PlayerState {
  const output = clonePlayerState(player);
  output.position = {
    x: previousPlayer.position.x + (player.position.x - previousPlayer.position.x) * alpha,
    y: previousPlayer.position.y + (player.position.y - previousPlayer.position.y) * alpha,
    z: previousPlayer.position.z + (player.position.z - previousPlayer.position.z) * alpha,
  };
  return output;
}

function resize(): void {
  const rect = viewport.getBoundingClientRect();
  const width = Math.max(1, Math.floor(rect.width));
  const height = Math.max(1, Math.floor(rect.height));
  renderer.setSize(width, height, false);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
}

function renderActionFeedback(
  now: number,
  sprintRequested: boolean,
  jumpAcknowledged: boolean,
  tackleAcknowledged: boolean,
): void {
  if (tackleAcknowledged) {
    lastActionFlash = 'tackle';
    actionFlashUntil = now + ACTION_FEEDBACK_MS;
  } else if (jumpAcknowledged) {
    lastActionFlash = 'jump';
    actionFlashUntil = now + ACTION_FEEDBACK_MS;
  }

  const mode = now < actionFlashUntil && lastActionFlash
    ? lastActionFlash
    : sprintRequested
      ? 'sprint'
      : 'idle';

  if (actionFeedback.dataset.action === mode) return;
  actionFeedback.dataset.action = mode;
  if (mode === 'jump') {
    actionFeedback.innerHTML = '<strong>AERIAL INPUT</strong><span>Header / contest window checked against the physical ball</span>';
    bodyMaterial.emissive.setHex(0x16475a);
    bodyMaterial.emissiveIntensity = 0.7;
  } else if (mode === 'tackle') {
    actionFeedback.innerHTML = '<strong>DEFENSIVE INPUT</strong><span>Standing challenge · sprint commits with recovery cost</span>';
    bodyMaterial.emissive.setHex(0x6b3100);
    bodyMaterial.emissiveIntensity = 0.65;
  } else if (mode === 'sprint') {
    actionFeedback.innerHTML = `<strong>SPRINT ENGAGED</strong><span>Longer, harder touches · target ${Math.round(DEFAULT_MOVEMENT_CONFIG.sprintSpeed * 3.6)} km/h</span>`;
    bodyMaterial.emissive.setHex(0x233000);
    bodyMaterial.emissiveIntensity = 0.35;
  } else {
    actionFeedback.innerHTML = '<strong>PLAY READY</strong><span>Move into the ball · precision and body angle shape every touch</span>';
    bodyMaterial.emissive.setHex(0x000000);
    bodyMaterial.emissiveIntensity = 0;
  }
}

window.addEventListener('resize', resize);
resize();

function frame(now: number): void {
  const rawDelta = Math.max(0, Math.min(0.1, (now - lastFrameTime) / 1000));
  lastFrameTime = now;
  if (rawDelta > 0) {
    const fps = 1 / rawDelta;
    smoothedFps += (fps - smoothedFps) * (1 - Math.exp(-rawDelta / 0.3));
  }
  accumulator += rawDelta;

  const keyboardFrame = actionMap.consumeFrame();
  bufferedActionBits |= keyboardFrame.intent.actionBits & EDGE_ACTION_BITS;
  const gamepadFrame = gamepad.read(actionMap.aimYaw, rawDelta);
  if (gamepadFrame) bufferedActionBits |= gamepadFrame.intent.actionBits & EDGE_ACTION_BITS;
  const mergedFrame = mergeInputSources(keyboardFrame, gamepadFrame, bufferedActionBits);
  let intent = mergedFrame.intent;
  const look = mergedFrame.look;
  if (gamepadFrame && (Math.abs(gamepadFrame.look.yawDelta) + Math.abs(gamepadFrame.look.pitchDelta) > 1e-9)) {
    actionMap.setAimYaw(gamepadFrame.intent.aimYaw);
  }
  cameraController.adjustZoom(mergedFrame.zoomDelta);

  if (practiceMode && footballPractice.movementAuthority < 1) {
    const authority = footballPractice.movementAuthority;
    intent = {
      ...intent,
      moveX: intent.moveX * authority,
      moveY: intent.moveY * authority,
      sprint: false,
    };
  }

  let stepped = false;
  let jumpAcknowledgedThisFrame = false;
  let tackleAcknowledgedThisFrame = false;
  while (accumulator + 1e-12 >= FIXED_DT) {
    previousPlayer = clonePlayerState(player);
    let tickIntent = intent;
    const playingBack = playbackIndex !== null && lastTrace !== null;
    if (playingBack && lastTrace) {
      const traceFrame = lastTrace.frames[playbackIndex ?? 0];
      if (traceFrame) {
        tickIntent = traceFrame.intent;
        playbackIndex = (playbackIndex ?? 0) + 1;
      } else {
        playbackIndex = null;
      }
    }
    if (recording && playbackIndex === null) recordedIntents.push(copyIntent(tickIntent));

    const beforeVelocity = player.velocity;
    player = stepPlayerMovement(player, tickIntent, practiceMode ? practiceWorld : world, FIXED_DT);
    if (practiceMode && !playingBack) footballPractice.processIntent(player, tickIntent, FIXED_DT);
    jumpAcknowledgedThisFrame ||= player.actionHooks.jumpRequested;
    tackleAcknowledgedThisFrame ||= player.actionHooks.tackleRequested;
    lastAcceleration = Math.hypot(
      player.velocity.x - beforeVelocity.x,
      player.velocity.z - beforeVelocity.z,
    ) / FIXED_DT;
    simTick += 1;
    accumulator -= FIXED_DT;
    stepped = true;

    if (!playingBack) {
      bufferedActionBits &= ~(tickIntent.actionBits & EDGE_ACTION_BITS);
      intent = {
        ...intent,
        actionBits: ((intent.actionBits & HELD_ACTION_BITS) | bufferedActionBits) >>> 0,
      };
    }

    if (keyboardFrame.inputTimestamp !== null && keyboardFrame.inputTimestamp > lastAppliedInputTimestamp) {
      lastAppliedInputTimestamp = keyboardFrame.inputTimestamp;
      inputToSimulationMs = Math.max(0, performance.now() - keyboardFrame.inputTimestamp);
      pendingRenderAckTimestamp = keyboardFrame.inputTimestamp;
    }
  }

  if (stepped && pendingRenderAckTimestamp !== null) {
    inputToRenderMs = Math.max(0, performance.now() - pendingRenderAckTimestamp);
    pendingRenderAckTimestamp = null;
  }

  const alpha = Math.max(0, Math.min(1, accumulator / FIXED_DT));
  const displayPlayer = interpolatedPlayer(alpha);
  playerGroup.position.set(displayPlayer.position.x, displayPlayer.position.y, displayPlayer.position.z);
  playerGroup.rotation.y = displayPlayer.facingYaw;

  const speed = Math.hypot(player.velocity.x, player.velocity.z);
  const sprintFraction = Math.max(0, Math.min(1, (speed - DEFAULT_MOVEMENT_CONFIG.jogSpeed) /
    (DEFAULT_MOVEMENT_CONFIG.sprintSpeed - DEFAULT_MOVEMENT_CONFIG.jogSpeed)));
  const cameraState = cameraController.update(
    displayPlayer,
    look,
    Math.max(rawDelta, 1 / 240),
    practiceMode ? [] : cameraObstacles,
    sprintFraction,
  );
  camera.position.set(cameraState.position.x, cameraState.position.y, cameraState.position.z);
  camera.fov = cameraState.fov;
  camera.lookAt(cameraState.target.x, cameraState.target.y, cameraState.target.z);
  camera.updateProjectionMatrix();

  if (practiceMode) footballPractice.update(rawDelta);
  else ballLab.update(rawDelta);

  playerProbe.dataset.x = String(player.position.x);
  playerProbe.dataset.y = String(player.position.y);
  playerProbe.dataset.z = String(player.position.z);
  playerProbe.dataset.facingYaw = String(player.facingYaw);
  playerProbe.dataset.tick = String(simTick);
  playerProbe.dataset.inputToSimulationMs = inputToSimulationMs === null ? '' : inputToSimulationMs.toFixed(3);
  playerProbe.dataset.inputToRenderMs = inputToRenderMs === null ? '' : inputToRenderMs.toFixed(3);
  playerProbe.dataset.speed = speed.toFixed(3);
  playerProbe.dataset.sprinting = String(intent.sprint);
  playerProbe.dataset.jumpHook = String(jumpAcknowledgedThisFrame);
  playerProbe.dataset.tackleHook = String(tackleAcknowledgedThisFrame);
  playerProbe.dataset.cameraDistance = cameraState.userDistance.toFixed(3);

  renderActionFeedback(
    now,
    intent.sprint && player.stamina > 0 && !player.sprintLocked,
    jumpAcknowledgedThisFrame,
    tackleAcknowledgedThisFrame,
  );

  const traceStatus = playbackIndex !== null
    ? `replay ${playbackIndex}/${lastTrace?.frames.length ?? 0}`
    : recording
      ? `recording ${recordedIntents.length} ticks`
      : lastTrace
        ? `ready ${lastTrace.frames.length} ticks`
        : 'idle';
  hud.update({
    simTick,
    renderFps: smoothedFps,
    speed,
    acceleration: lastAcceleration,
    stamina: player.stamina,
    locomotion: player.locomotion,
    positionX: player.position.x,
    positionZ: player.position.z,
    facingYaw: player.facingYaw,
    cameraArm: cameraState.armLength,
    cameraCollision: cameraState.collision.obstacleId,
    cameraCorrectionPerSecond: cameraState.collision.correctionPerSecond,
    inputToSimulationMs,
    inputToRenderMs,
    traceStatus,
    fixedStepBacklogMs: accumulator * 1000,
  });

  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);
