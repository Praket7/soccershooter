import * as THREE from 'three';
import { STANDARD_GOAL_FRAME } from '@soccershooter/physics/ball/trajectory';
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
import { ActionMap } from './input/ActionMap';
import { GamepadAdapter } from './input/GamepadAdapter';
import { mergeInputSources } from './input/InputMerge';
import { intersectAimRayWithGround, intersectAimRayWithPlaneZ } from './input/WorldAim';
import { ThirdPersonCamera, type CameraObstacle } from './camera/ThirdPersonCamera';
import { buildPracticeGoalCameraObstacles, resolveBallAwareCameraFocus } from './camera/FootballPracticeCamera';
import { MovementHud } from './debug/MovementHud';
import { BallLab } from './dev/BallLab';
import { FootballPractice } from './dev/FootballPractice';
import { playerVisualFootY } from './presentation/PlayerVisualLayout';
import { ProceduralAthleteProxy } from './presentation/ProceduralAthleteProxy';
import { ContactDebugOverlay } from './presentation/ContactDebugOverlay';
import { RoadToLegendScreen } from './screens/RoadToLegend';
import { ARCHETYPE_MODIFIERS } from '@soccershooter/progression';
import { selectContentMode } from '@soccershooter/content/contentMode';
import './styles.css';

function requireElement<T extends Element>(selector: string): T {
  const element = document.querySelector<T>(selector);
  if (!element) throw new Error(`Missing required element: ${selector}`);
  return element;
}

const app = requireElement<HTMLElement>('#app');
const contentMode = selectContentMode(import.meta.env.VITE_CONTENT_MODE, import.meta.env.PROD);
const reference = runReferenceTrace();
app.innerHTML = `
  <div class="movement-lab-shell">
    <header class="lab-header">
      <div>
        <p class="eyebrow">Stage 05–07 · owner control overhaul</p>
        <h1>SoccerShooter Physical Football Lab</h1>
        <p class="subtitle">The ball stays independent. The player now gives explicit football intent: carry, receive, pass through a lane, or shoot at a visible world target.</p>
      </div>
      <div class="header-actions">
        <div class="mode-switch" role="group" aria-label="Practice mode">
          <button type="button" data-mode-practice data-active="true">Football Practice</button>
          <button type="button" data-mode-ball-lab data-active="false">Ball Lab</button>
          <button type="button" data-mode-career data-active="false">Road to Legend</button>
        </div>
        <div class="status-pill" data-content-mode="${contentMode.mode}"><span></span> ${contentMode.watermark ?? contentMode.mode}</div>
      </div>
    </header>
    <section class="viewport-wrap" aria-label="SoccerShooter physical football practice">
      <div id="game-viewport" class="game-viewport"></div>
      <div class="camera-capture-overlay" data-camera-capture>CLICK TO CONTROL CAMERA</div>
      <div class="center-reticle" data-center-reticle hidden aria-hidden="true"><i></i><b></b></div>
      <aside class="control-card">
        <strong>Football controls</strong>
        <span>WASD · move / exact carry direction</span>
        <span>Mouse / right stick · camera + center-reticle world aim</span>
        <span>Shift / L3 · sprint / recoverable knock-on</span>
        <span>RMB / LT · close-control dribble</span>
        <span>F · receive / trap · F + WASD controlled exit</span>
        <span>E · ground pass · Q · through pass · R · lofted pass</span>
        <span>RMB+E · driven ground pass · Ctrl+Q · chipped through ball</span>
        <span>LMB · hold power / release shot · RMB+LMB finesse · Ctrl+LMB chip</span>
        <span>C / B · challenge · Shift+C committed · Space aerial</span>
        <span>G · reset ball in practice only</span>
        <span>Practice panel · select technique · T to execute within its contact window</span>
      </aside>
      <aside class="action-feedback" data-action-feedback data-action="idle" aria-live="polite">
        <strong>PLAY READY</strong>
        <span>Click once to capture the camera. That click never performs a football action.</span>
      </aside>
      <aside class="course-card">
        <strong>Repair focus</strong>
        <span>visible world aim</span><span>buffered receive</span><span>sharp-turn touch</span>
        <span>aim-first pass lane</span><span>physical shooting</span><span>keeper read</span>
        <span>challenge timing</span><span>no welded ball</span>
      </aside>
    </section>
    <footer class="lab-footer">
      <span>Practice: F receive · E/Q/R passes · RMB+E driven · Ctrl+Q chipped through · RMB/Ctrl + LMB shot variants</span>
      <span>Debug tools: F8 trace · P replay · K player reset · F1 HUD · F9 contact ghost · ${PLAYER_MOVEMENT_TICK_HZ} Hz</span>
    </footer>
    <output data-determinism-hash="${reference.hash}" data-determinism-ticks="${reference.ticks}" hidden>${reference.hash}</output>
    <output data-player-state data-x="0" data-z="${BENCHMARK_COURSE.spawn.z}" data-movement-tick-hz="${PLAYER_MOVEMENT_TICK_HZ}" data-pointer-locked="false" hidden></output>
    <output data-athlete-proxy-state hidden></output>
    <output class="contact-debug-readout" data-contact-debug-readout hidden></output>
  </div>
`;

document.title = 'SoccerShooter Physical Football Lab';

const viewport = requireElement<HTMLElement>('#game-viewport');
const playerProbe = requireElement<HTMLOutputElement>('[data-player-state]');
const athleteProxyProbe = requireElement<HTMLOutputElement>('[data-athlete-proxy-state]');
const contactDebugReadout = requireElement<HTMLOutputElement>('[data-contact-debug-readout]');
const actionFeedback = requireElement<HTMLElement>('[data-action-feedback]');
const practiceModeButton = requireElement<HTMLButtonElement>('[data-mode-practice]');
const ballLabModeButton = requireElement<HTMLButtonElement>('[data-mode-ball-lab]');
const careerModeButton = requireElement<HTMLButtonElement>('[data-mode-career]');
const captureOverlay = requireElement<HTMLElement>('[data-camera-capture]');
const centerReticle = requireElement<HTMLElement>('[data-center-reticle]');

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0b1118);
scene.fog = new THREE.Fog(0x0b1118, 26, 58);

const camera = new THREE.PerspectiveCamera(55, 1, 0.05, 100);
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.domElement.dataset.gameViewport = 'true';
renderer.domElement.dataset.proceduralAthlete = 'true';
renderer.domElement.setAttribute('aria-label', 'Interactive SoccerShooter physical football practice');
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

const athleteProxy = new ProceduralAthleteProxy(scene);
const contactDebugOverlay = new ContactDebugOverlay(scene);

const cameraObstacles: CameraObstacle[] = world.obstacles.map((obstacle) => ({ ...obstacle }));
const practiceCameraObstacles = buildPracticeGoalCameraObstacles(STANDARD_GOAL_FRAME, -15.2);
const cameraController = new ThirdPersonCamera();
const actionMap = new ActionMap(window, renderer.domElement);
actionMap.attach();
const gamepad = new GamepadAdapter();
const hud = new MovementHud(document.body);
const ballLab = new BallLab({ scene, host: viewport });
let roadToLegend: RoadToLegendScreen | null = null;
const footballPractice = new FootballPractice({ scene, host: viewport, onGoalScored: () => { void roadToLegend?.notifyCampaignGoal(); } });
roadToLegend = new RoadToLegendScreen(document.body, () => {
  footballPractice.setCampaignChallenge(null);
  setMode('practice');
}, undefined, (profile) => {
  footballPractice.setBuildModifiers(ARCHETYPE_MODIFIERS[profile.archetype]);
}, (encounter) => {
  footballPractice.setCampaignChallenge(encounter);
  setMode('practice');
}, () => {
  footballPractice.setCampaignChallenge(null);
  setMode('career');
});

const FIXED_DT = 1 / PLAYER_MOVEMENT_TICK_HZ;
const ACTION_FEEDBACK_MS = 480;
const EDGE_ACTION_BITS = (
  PlayerActionBits.Jump
  | PlayerActionBits.Tackle
  | PlayerActionBits.Pass
  | PlayerActionBits.ThroughPass
  | PlayerActionBits.LoftedPass
  | PlayerActionBits.Receive
  | PlayerActionBits.Technique
  | PlayerActionBits.ShootReleased
) >>> 0;
const HELD_ACTION_BITS = (
  PlayerActionBits.ShootHeld
  | PlayerActionBits.Precision
  | PlayerActionBits.DrivenModifier
  | PlayerActionBits.ChipModifier
) >>> 0;
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
const stage05rSlowMotion = new URLSearchParams(window.location.search).get('stage05rSlowMotion') === '1';
let sampledContactEventTick: number | null = null;
let sampledContact: { visible: boolean; error: number; foot: string; surface: string } | null = null;

function syncPointerLockUi(): void {
  const locked = document.pointerLockElement === renderer.domElement;
  captureOverlay.hidden = locked;
  centerReticle.hidden = !locked;
  playerProbe.dataset.pointerLocked = String(locked);
}

document.addEventListener('pointerlockchange', syncPointerLockUi);
syncPointerLockUi();

function setBallLabTrails(enabled: boolean): void {
  const input = ballLab.root.querySelector<HTMLInputElement>('[data-ball-trail]');
  if (!input || input.checked === enabled) return;
  input.checked = enabled;
  input.dispatchEvent(new Event('change', { bubbles: true }));
}

function setMode(mode: 'practice' | 'ball-lab' | 'career'): void {
  practiceMode = mode === 'practice';
  footballPractice.setVisible(practiceMode);
  const ballLabMode = mode === 'ball-lab';
  if (roadToLegend) roadToLegend.root.hidden = mode !== 'career';
  renderer.domElement.hidden = mode === 'career';
  ballLab.root.hidden = !ballLabMode;
  ballLab.ballVisual.visible = ballLabMode;
  ballLab.goalVisual.visible = ballLabMode;
  setBallLabTrails(ballLabMode);
  for (const visual of courseVisuals) visual.visible = ballLabMode;
  athleteProxy.group.visible = mode !== 'career';
  practiceModeButton.dataset.active = String(practiceMode);
  ballLabModeButton.dataset.active = String(ballLabMode);
  careerModeButton.dataset.active = String(mode === 'career');
  playerProbe.dataset.mode = mode;
}

practiceModeButton.addEventListener('click', () => setMode('practice'));
ballLabModeButton.addEventListener('click', () => setMode('ball-lab'));
careerModeButton.addEventListener('click', () => setMode('career'));
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

document.addEventListener('keydown', (event) => {
  if (!practiceMode || event.repeat) return;
  if (event.code === 'KeyG') {
    footballPractice.resetBallNear(player);
    event.preventDefault();
    return;
  }
  if (event.code === 'KeyL' || event.code === 'Digit0') event.stopPropagation();
}, true);

window.addEventListener('keydown', (event) => {
  if (event.repeat) return;
  if (event.code === 'F1') {
    event.preventDefault();
    hud.toggle();
  } else if (event.code === 'KeyK') {
    resetPlayer();
  } else if (event.code === 'F8') {
    event.preventDefault();
    if (!recording) {
      recording = true;
      recordedIntents = [];
      recordingInitial = clonePlayerState(player);
    } else {
      recording = false;
      lastTrace = recordMovementTrace(recordingInitial, recordedIntents, PLAYER_MOVEMENT_TICK_HZ);
    }
  } else if (event.code === 'F9') {
    event.preventDefault();
    contactDebugOverlay.setEnabled(!contactDebugOverlay.enabled);
    contactDebugReadout.hidden = !contactDebugOverlay.enabled;
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
    athleteProxy.bodyMaterial.emissive.setHex(0x16475a);
    athleteProxy.bodyMaterial.emissiveIntensity = 0.7;
  } else if (mode === 'tackle') {
    actionFeedback.innerHTML = '<strong>DEFENSIVE INPUT</strong><span>Standing challenge · sprint commits with recovery cost</span>';
    athleteProxy.bodyMaterial.emissive.setHex(0x6b3100);
    athleteProxy.bodyMaterial.emissiveIntensity = 0.65;
  } else if (mode === 'sprint') {
    actionFeedback.innerHTML = `<strong>SPRINT ENGAGED</strong><span>Recoverable knock-on touches · target ${Math.round(DEFAULT_MOVEMENT_CONFIG.sprintSpeed * 3.6)} km/h</span>`;
    athleteProxy.bodyMaterial.emissive.setHex(0x233000);
    athleteProxy.bodyMaterial.emissiveIntensity = 0.35;
  } else {
    actionFeedback.innerHTML = '<strong>PLAY READY</strong><span>F receive · E/Q/R pass lanes · RMB close control · LMB shoot through the reticle</span>';
    athleteProxy.bodyMaterial.emissive.setHex(0x000000);
    athleteProxy.bodyMaterial.emissiveIntensity = 0;
  }
}

function updateWorldAim(): void {
  const direction = new THREE.Vector3();
  camera.getWorldDirection(direction);
  const origin = { x: camera.position.x, y: camera.position.y, z: camera.position.z };
  const ray = { x: direction.x, y: direction.y, z: direction.z };
  const goalHit = intersectAimRayWithPlaneZ(origin, ray, STANDARD_GOAL_FRAME.planeZ);
  const validGoalHit = goalHit
    && Math.abs(goalHit.x) <= STANDARD_GOAL_FRAME.halfWidth + 0.9
    && goalHit.y >= -0.2
    && goalHit.y <= STANDARD_GOAL_FRAME.height + 0.9
    ? goalHit
    : null;
  const groundHit = intersectAimRayWithGround(origin, ray, 0);
  footballPractice.setWorldAimTarget(validGoalHit ?? groundHit);
  playerProbe.dataset.worldAim = validGoalHit ? 'goal' : groundHit ? 'ground' : 'none';
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
  accumulator += rawDelta * (stage05rSlowMotion ? 0.2 : 1);

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
    intent = { ...intent, moveX: intent.moveX * authority, moveY: intent.moveY * authority, sprint: false };
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
      } else playbackIndex = null;
    }
    if (recording && playbackIndex === null) recordedIntents.push(copyIntent(tickIntent));

    const beforeVelocity = player.velocity;
    player = stepPlayerMovement(player, tickIntent, practiceMode ? footballPractice.movementWorld(practiceWorld) : world, FIXED_DT, practiceMode ? footballPractice.movementConfig : DEFAULT_MOVEMENT_CONFIG);
    if (practiceMode) {
      if (!playingBack) footballPractice.processIntent(player, tickIntent, FIXED_DT);
      // Keep the independent football on the same authoritative timeline as
      // player movement. Advancing it later from render delta allowed the
      // player to move multiple fixed ticks while the ball stood still during
      // slow frames, producing frame-rate-dependent dribble separation.
      footballPractice.update(FIXED_DT);
    }
    jumpAcknowledgedThisFrame ||= player.actionHooks.jumpRequested;
    tackleAcknowledgedThisFrame ||= player.actionHooks.tackleRequested;
    lastAcceleration = Math.hypot(player.velocity.x - beforeVelocity.x, player.velocity.z - beforeVelocity.z) / FIXED_DT;
    simTick += 1;
    accumulator -= FIXED_DT;
    stepped = true;

    if (!playingBack) {
      bufferedActionBits &= ~(tickIntent.actionBits & EDGE_ACTION_BITS);
      intent = { ...intent, actionBits: ((intent.actionBits & HELD_ACTION_BITS) | bufferedActionBits) >>> 0 };
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
  const contactPlan = footballPractice.activeContactPlan ?? footballPractice.lastContactPlan;
  const athletePose = athleteProxy.update({
    player: displayPlayer,
    plan: contactPlan,
    simulationTick: footballPractice.contactTick,
    interpolationAlpha: alpha,
  });
  contactDebugOverlay.update(contactPlan, footballPractice.contactTick);
  contactDebugReadout.textContent = contactDebugOverlay.label;
  athleteProxyProbe.dataset.simulationTick = String(footballPractice.contactTick);
  athleteProxyProbe.dataset.contactFoot = athletePose.contactFoot ?? '';
  athleteProxyProbe.dataset.contactTick = athletePose.contactTick === null ? '' : String(athletePose.contactTick);
  athleteProxyProbe.dataset.contactVisible = String(athletePose.contactVisible);
  athleteProxyProbe.dataset.contactErrorMeters = athletePose.contactErrorMeters.toFixed(6);
  const eventTick = footballPractice.lastContactEventTick;
  const isLatestContact = eventTick !== null && athletePose.contactTick === eventTick;
  if (eventTick === null) {
    sampledContactEventTick = null;
    sampledContact = null;
  }
  if (eventTick !== null && eventTick !== sampledContactEventTick) {
    sampledContactEventTick = eventTick;
    sampledContact = null;
  }
  if (isLatestContact && athletePose.contactVisible && sampledContact === null) {
    sampledContact = {
      visible: true,
      error: athletePose.contactErrorMeters,
      foot: athletePose.contactFoot ?? '',
      surface: footballPractice.lastContactPlan?.surface ?? '',
    };
  }
  athleteProxyProbe.dataset.lastContactVisible = String(sampledContact?.visible ?? false);
  athleteProxyProbe.dataset.lastContactErrorM = sampledContact?.error.toFixed(6) ?? '';
  athleteProxyProbe.dataset.lastContactFoot = sampledContact?.foot ?? '';
  athleteProxyProbe.dataset.lastContactSurface = sampledContact?.surface ?? '';

  const speed = Math.hypot(player.velocity.x, player.velocity.z);
  const sprintFraction = Math.max(0, Math.min(1, (speed - DEFAULT_MOVEMENT_CONFIG.jogSpeed) /
    (DEFAULT_MOVEMENT_CONFIG.sprintSpeed - DEFAULT_MOVEMENT_CONFIG.jogSpeed)));
  const cameraPlayer = clonePlayerState(displayPlayer);
  let cameraFocusBias = 0;
  if (practiceMode) {
    const manualAimActive = document.pointerLockElement === renderer.domElement;
    const focus = resolveBallAwareCameraFocus(
      displayPlayer.position,
      footballPractice.state.position,
      manualAimActive,
      {
        velocity: displayPlayer.athleticMotion.plannedVelocity,
        trajectory: displayPlayer.athleticMotion.trajectory,
        contactPoint: (footballPractice.activeContactPlan ?? footballPractice.lastContactPlan)
          ? {
            x: (footballPractice.activeContactPlan ?? footballPractice.lastContactPlan)!.expectedBallPoint.x,
            z: (footballPractice.activeContactPlan ?? footballPractice.lastContactPlan)!.expectedBallPoint.z,
          }
          : null,
        plantDemand: displayPlayer.athleticMotion.plantIntensity,
        actionPreparation: footballPractice.activeContactPlan !== null,
        contactResolved: footballPractice.lastContactEventTick !== null
          && footballPractice.contactTick - footballPractice.lastContactEventTick <= 1,
      },
    );
    cameraPlayer.position = { ...focus };
    cameraFocusBias = Math.hypot(focus.x - displayPlayer.position.x, focus.z - displayPlayer.position.z);
    playerProbe.dataset.manualAimActive = String(manualAimActive);
  }
  const cameraState = cameraController.update(
    cameraPlayer,
    look,
    Math.max(rawDelta, 1 / 240),
    practiceMode ? practiceCameraObstacles : cameraObstacles,
    sprintFraction,
  );
  camera.position.set(cameraState.position.x, cameraState.position.y, cameraState.position.z);
  camera.fov = cameraState.fov;
  camera.lookAt(cameraState.target.x, cameraState.target.y, cameraState.target.z);
  camera.updateProjectionMatrix();
  updateWorldAim();

  if (practiceMode) {
    // Refresh presentation/aim markers without advancing authoritative ball
    // state a second time from render-frame delta.
    footballPractice.update(0);
  } else ballLab.update(rawDelta);

  playerProbe.dataset.x = String(player.position.x);
  playerProbe.dataset.y = String(player.position.y);
  playerProbe.dataset.z = String(player.position.z);
  playerProbe.dataset.facingYaw = String(player.facingYaw);
  playerProbe.dataset.visualFootY = playerVisualFootY(displayPlayer.position.y).toFixed(6);
  playerProbe.dataset.cameraFocusBias = cameraFocusBias.toFixed(6);
  playerProbe.dataset.tick = String(simTick);
  playerProbe.dataset.inputToSimulationMs = inputToSimulationMs === null ? '' : inputToSimulationMs.toFixed(3);
  playerProbe.dataset.inputToRenderMs = inputToRenderMs === null ? '' : inputToRenderMs.toFixed(3);
  playerProbe.dataset.speed = speed.toFixed(3);
  playerProbe.dataset.sprinting = String(intent.sprint);
  playerProbe.dataset.jumpHook = String(jumpAcknowledgedThisFrame);
  playerProbe.dataset.tackleHook = String(tackleAcknowledgedThisFrame);
  playerProbe.dataset.cameraDistance = cameraState.userDistance.toFixed(3);

  renderActionFeedback(now, intent.sprint && player.stamina > 0 && !player.sprintLocked, jumpAcknowledgedThisFrame, tackleAcknowledgedThisFrame);

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
