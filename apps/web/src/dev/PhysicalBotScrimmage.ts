import * as THREE from 'three';
import {
  createPhysicalScrimmage,
  getPhysicalDifficultySnapshot,
  stepPhysicalScrimmage,
  type HumanScrimmageInput,
  type PhysicalScrimmageState,
} from '../../../../packages/bots/src/physicalScrimmage';
import { BOT_DIFFICULTY_TIERS, type BotDifficultyTier } from '../../../../packages/bots/src/difficulty';
import { BOT_PERSONALITY_IDS, type BotPersonalityId } from '../../../../packages/bots/src/personalities';
import { TEAM_PLAYSTYLES, type TeamPlaystyle } from '../../../../packages/bots/src/runtime';

const FIXED_DT = 1 / 30;

function mustQuery<T extends Element>(root: ParentNode, selector: string): T {
  const element = root.querySelector<T>(selector);
  if (!element) throw new Error(`Physical Bot Scrimmage missing ${selector}`);
  return element;
}

function createStyles(): HTMLStyleElement {
  const style = document.createElement('style');
  style.textContent = `
    .physical-bot-scrimmage{position:absolute;inset:0;z-index:32;background:#071018;color:#eef5f6;font-family:Inter,system-ui,sans-serif;display:grid;grid-template-columns:minmax(0,1fr) 320px;overflow:hidden}
    .physical-bot-scrimmage[hidden]{display:none}.physical-stage{position:relative;min-width:0;min-height:0;background:radial-gradient(circle at 50% 15%,rgba(92,133,119,.18),transparent 52%),#071018}.physical-stage canvas{width:100%;height:100%;display:block}.physical-side{border-left:1px solid rgba(255,255,255,.1);background:rgba(8,18,27,.96);padding:18px;overflow:auto;display:flex;flex-direction:column;gap:14px}.physical-side h2{margin:0;font-size:23px}.physical-kicker{margin:0;color:#88a6b6;font-size:10px;text-transform:uppercase;letter-spacing:.13em}.physical-copy{margin:4px 0 0;color:#abc0ca;font-size:12px;line-height:1.5}.physical-proof{padding:10px;border:1px solid rgba(122,225,153,.25);background:#10251b;border-radius:9px;color:#bee8c9;font-size:11px;line-height:1.5}.physical-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px}.physical-stat{padding:9px;border-radius:8px;background:#10202c}.physical-stat strong{display:block;font-size:17px}.physical-stat span{font-size:9px;color:#8fa4b1;text-transform:uppercase;letter-spacing:.06em}.physical-controls{display:grid;gap:8px}.physical-controls label{display:grid;gap:5px;color:#9fb3bf;font-size:10px;text-transform:uppercase;letter-spacing:.07em}.physical-controls select,.physical-controls button{border:1px solid rgba(255,255,255,.16);background:#142738;color:#f3f8fa;border-radius:8px;padding:9px;font:inherit}.physical-controls button{cursor:pointer;font-weight:750}.physical-event{padding:10px;border-radius:8px;background:#0e1d28;font-size:11px;color:#d6e2e8;min-height:34px}.physical-legend{display:grid;gap:5px;color:#9fb1bc;font-size:10px}.physical-legend i{display:inline-block;width:8px;height:8px;border-radius:50%;margin-right:6px}.physical-home{background:#e3b341}.physical-away{background:#4e9fe8}.physical-loose{background:#f4f1e8;border:1px solid #222}.physical-badge{position:absolute;left:16px;top:14px;padding:7px 10px;border-radius:999px;background:rgba(5,12,18,.74);border:1px solid rgba(255,255,255,.12);font-size:10px;letter-spacing:.08em;text-transform:uppercase;pointer-events:none}.physical-badge strong{color:#d3f469}.physical-paused{color:#ffd59a}
    .physical-controls-guide{padding:10px 12px;border:1px solid rgba(211,244,105,.2);border-radius:9px;background:#15231e;color:#e4f4d0;font-size:11px;line-height:1.6}.physical-user-state{color:#d3f469;font-size:12px;font-weight:750}
    @media(max-width:850px){.physical-bot-scrimmage{grid-template-columns:1fr;grid-template-rows:minmax(0,1fr) auto}.physical-side{border-left:0;border-top:1px solid rgba(255,255,255,.1);max-height:280px}.physical-grid{grid-template-columns:repeat(4,1fr)}}
  `;
  return style;
}

function makePlayerVisual(team: 'home' | 'away', goalkeeper: boolean): THREE.Group {
  const group = new THREE.Group();
  const color = team === 'home' ? 0xe3b341 : 0x4e9fe8;
  const body = new THREE.Mesh(
    goalkeeper ? new THREE.BoxGeometry(0.72, 1.45, 0.56) : new THREE.CylinderGeometry(0.34, 0.41, 1.36, 14),
    new THREE.MeshStandardMaterial({ color, roughness: 0.7 }),
  );
  body.position.y = 0.72;
  body.castShadow = true;
  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.22, 12, 9),
    new THREE.MeshStandardMaterial({ color: 0xe8c6a0, roughness: 0.85 }),
  );
  head.position.y = 1.56;
  const facing = new THREE.Mesh(
    new THREE.BoxGeometry(0.07, 0.07, 0.62),
    new THREE.MeshBasicMaterial({ color: 0xffffff }),
  );
  facing.position.set(0, 1.0, 0.43);
  group.add(body, head, facing);
  return group;
}

function addGoal(scene: THREE.Scene, z: number): void {
  const material = new THREE.MeshStandardMaterial({ color: 0xdfe7eb, roughness: 0.45 });
  for (const x of [-3.66, 3.66]) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 2.44, 10), material);
    post.position.set(x, 1.22, z);
    scene.add(post);
  }
  const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 7.32, 10), material);
  bar.rotation.z = Math.PI / 2;
  bar.position.set(0, 2.44, z);
  scene.add(bar);
}

function install(): void {
  const modeSwitch = document.querySelector<HTMLElement>('.mode-switch');
  const viewport = document.querySelector<HTMLElement>('#game-viewport');
  if (!modeSwitch || !viewport) return;
  document.head.append(createStyles());

  const practiceButton = mustQuery<HTMLButtonElement>(document, '[data-mode-practice]');
  const ballLabButton = mustQuery<HTMLButtonElement>(document, '[data-mode-ball-lab]');
  const tacticalButton = document.querySelector<HTMLButtonElement>('[data-mode-tactical-bots]');
  const adaptiveButton = document.querySelector<HTMLButtonElement>('[data-mode-adaptive-bots]');

  if (tacticalButton) tacticalButton.textContent = 'Tactical Debug';
  const tacticalLab = document.querySelector<HTMLElement>('[data-bot-tactical-lab]');
  if (tacticalLab) {
    const heading = tacticalLab.querySelector('h2');
    if (heading) heading.textContent = 'Tactical Debug';
    const copy = tacticalLab.querySelector('.bot-tactical-panel > p');
    if (copy) copy.textContent = 'Symbolic blackboard for roles, support spacing and tactical decisions only. Possession on this page is scripted; use Adaptive Bot Playtest to validate real ball control.';
  }
  if (adaptiveButton) adaptiveButton.textContent = 'Adaptive Debug';
  const adaptiveLab = document.querySelector<HTMLElement>('[data-adaptive-bot-lab]');
  if (adaptiveLab) {
    const heading = adaptiveLab.querySelector('h2');
    if (heading) heading.textContent = 'Adaptive Debug';
    const copy = adaptiveLab.querySelector<HTMLElement>('.adaptive-copy');
    if (copy) copy.textContent = 'Static cognition inspection compares the real tactical runtime. Use Adaptive Bot Playtest to play a keyboard-controlled player against bots at each tier.';
  }

  const button = document.createElement('button');
  button.type = 'button';
  button.dataset.modePhysicalBots = 'true';
  button.dataset.active = 'false';
  button.textContent = 'Adaptive Bot Playtest';
  modeSwitch.append(button);

  const lab = document.createElement('section');
  lab.className = 'physical-bot-scrimmage';
  lab.dataset.physicalBotScrimmage = 'true';
  lab.hidden = true;
  lab.innerHTML = `
    <div class="physical-stage" data-physical-stage tabindex="0" aria-label="Click the pitch to control your player"><div class="physical-badge" data-physical-badge><strong>LIVE</strong> · same movement + ball + contacts</div></div>
    <aside class="physical-side">
      <div><p class="physical-kicker">Stage 07 · live playtest</p><h2>Adaptive Bot Playtest</h2><p class="physical-copy" data-physical-description>You control h-1 throughout. Your teammate and the opposing team use their selected bot levels with the same movement, ball and contact rules.</p></div>
      <div class="physical-controls-guide" data-human-controls>W upfield · S downfield · A left · D right · Shift sprint · E pass · Space shoot · C challenge</div>
      <div class="physical-user-state" data-user-player-label>You: h-1</div>
      <div class="physical-grid">
        <div class="physical-stat"><strong data-physical-possession>HOME</strong><span>control</span></div>
        <div class="physical-stat"><strong data-physical-contacts>0</strong><span>contacts</span></div>
        <div class="physical-stat"><strong data-physical-loose>0</strong><span>loose ticks</span></div>
        <div class="physical-stat"><strong data-physical-changes>0</strong><span>possession changes</span></div>
        <div class="physical-stat"><strong data-physical-score>0–0</strong><span>score</span></div>
      </div>
      <div class="physical-controls">
        <label>Home bot level<select data-home-tier data-physical-tier>${BOT_DIFFICULTY_TIERS.map((tier) => `<option value="${tier}" ${tier === 'standard' ? 'selected' : ''}>${tier}</option>`).join('')}</select></label>
        <label>Away bot level<select data-away-tier>${BOT_DIFFICULTY_TIERS.map((tier) => `<option value="${tier}" ${tier === 'standard' ? 'selected' : ''}>${tier}</option>`).join('')}</select></label>
        <label>Home team playstyle<select data-home-playstyle>${TEAM_PLAYSTYLES.map((id) => `<option value="${id}" ${id === 'possession' ? 'selected' : ''}>${id}</option>`).join('')}</select></label>
        <label>Away team playstyle<select data-away-playstyle>${TEAM_PLAYSTYLES.map((id) => `<option value="${id}" ${id === 'high-press' ? 'selected' : ''}>${id}</option>`).join('')}</select></label>
        <label>Home player personality<select data-physical-personality>${BOT_PERSONALITY_IDS.map((id) => `<option value="${id}" ${id === 'balanced' ? 'selected' : ''}>${id}</option>`).join('')}</select></label>
        <button type="button" data-physical-spectator aria-pressed="false">Watch bot match</button>
        <button type="button" data-physical-pause>Pause</button>
        <button type="button" data-physical-reset>Reset seeded scrimmage</button>
      </div>
      <div class="physical-proof" data-physical-proof>Physical fairness loading…</div>
      <div class="physical-event" data-physical-event>scrimmage-ready</div>
      <div class="physical-legend"><span><i class="physical-home"></i>home</span><span><i class="physical-away"></i>away</span><span><i class="physical-loose"></i>white ball is never welded to a carrier</span></div>
      <output data-physical-state data-tick="0" data-possession-player="h-1" data-possession-team="home" data-contact-count="0" data-loose-ball-ticks="0" data-possession-changes="0" data-checksum="" data-tier="standard" data-personality="balanced" data-physical-invariant="true" data-user-player="h-1" data-user-x="-1.4" data-user-z="-4" data-human-input-count="0" data-last-human-action="none" hidden></output>
    </aside>
  `;
  viewport.append(lab);

  const stage = mustQuery<HTMLElement>(lab, '[data-physical-stage]');
  const probe = mustQuery<HTMLOutputElement>(lab, '[data-physical-state]');
  const possessionView = mustQuery<HTMLElement>(lab, '[data-physical-possession]');
  const contactsView = mustQuery<HTMLElement>(lab, '[data-physical-contacts]');
  const looseView = mustQuery<HTMLElement>(lab, '[data-physical-loose]');
  const changesView = mustQuery<HTMLElement>(lab, '[data-physical-changes]');
  const scoreView = mustQuery<HTMLElement>(lab, '[data-physical-score]');
  const eventView = mustQuery<HTMLElement>(lab, '[data-physical-event]');
  const proofView = mustQuery<HTMLElement>(lab, '[data-physical-proof]');
  const badge = mustQuery<HTMLElement>(lab, '[data-physical-badge]');
  const userPlayerLabel = mustQuery<HTMLElement>(lab, '[data-user-player-label]');
  const homeTierSelect = mustQuery<HTMLSelectElement>(lab, '[data-home-tier]');
  const awayTierSelect = mustQuery<HTMLSelectElement>(lab, '[data-away-tier]');
  const description = mustQuery<HTMLElement>(lab, '[data-physical-description]');
  const spectatorButton = mustQuery<HTMLButtonElement>(lab, '[data-physical-spectator]');
  const personalitySelect = mustQuery<HTMLSelectElement>(lab, '[data-physical-personality]');
  const homePlaystyleSelect = mustQuery<HTMLSelectElement>(lab, '[data-home-playstyle]');
  const awayPlaystyleSelect = mustQuery<HTMLSelectElement>(lab, '[data-away-playstyle]');
  const pauseButton = mustQuery<HTMLButtonElement>(lab, '[data-physical-pause]');
  const resetButton = mustQuery<HTMLButtonElement>(lab, '[data-physical-reset]');
  const globalModeHint = document.querySelector<HTMLElement>('.lab-footer span:first-child');
  const originalModeHint = globalModeHint?.textContent ?? '';

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x081119);
  scene.fog = new THREE.Fog(0x081119, 55, 130);
  const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 140);
  // Frame the complete pitch length, including both goals, in the standard page view.
  camera.position.set(0, 50, -34);
  camera.lookAt(0, 0, -1);
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.domElement.dataset.physicalScrimmageCanvas = 'true';
  renderer.domElement.setAttribute('aria-label', 'Adaptive Bot Playtest pitch');
  stage.prepend(renderer.domElement);

  scene.add(new THREE.HemisphereLight(0xcce5ff, 0x22311f, 1.8));
  const sun = new THREE.DirectionalLight(0xffffff, 2.2);
  sun.position.set(-8, 20, -10);
  sun.castShadow = true;
  scene.add(sun);
  const pitch = new THREE.Mesh(
    new THREE.PlaneGeometry(24, 36),
    new THREE.MeshStandardMaterial({ color: 0x174132, roughness: 0.95 }),
  );
  pitch.rotation.x = -Math.PI / 2;
  pitch.receiveShadow = true;
  scene.add(pitch);
  const grid = new THREE.GridHelper(36, 36, 0xdbe8df, 0x286049);
  grid.scale.x = 24 / 36;
  grid.position.y = 0.006;
  scene.add(grid);
  addGoal(scene, -18);
  addGoal(scene, 18);

  const ballVisual = new THREE.Mesh(
    new THREE.SphereGeometry(0.16, 20, 14),
    new THREE.MeshStandardMaterial({ color: 0xf7f4ec, roughness: 0.62 }),
  );
  ballVisual.castShadow = true;
  scene.add(ballVisual);

  let state: PhysicalScrimmageState = createPhysicalScrimmage(0x507a11);
  const players = new Map<string, THREE.Group>();
  for (const player of state.players) {
    const visual = makePlayerVisual(player.team, player.goalkeeper);
    visual.name = `physical-${player.id}`;
    if (player.team === 'home' && !player.goalkeeper) {
      const ring = new THREE.Mesh(
        new THREE.RingGeometry(0.48, 0.59, 24),
        new THREE.MeshBasicMaterial({ color: 0xd3f469, side: THREE.DoubleSide, transparent: true, opacity: 0.95 }),
      );
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = 0.025;
      ring.visible = false;
      visual.add(ring);
    }
    scene.add(visual);
    players.set(player.id, visual);
  }

  let active = false;
  let paused = false;
  let spectatorMode = false;
  let homeTier: BotDifficultyTier = 'standard';
  let awayTier: BotDifficultyTier = 'standard';
  let personality: BotPersonalityId = 'balanced';
  let homePlaystyle: TeamPlaystyle = 'possession';
  let awayPlaystyle: TeamPlaystyle = 'high-press';
  const pressedKeys = new Set<string>();
  let queuedAction: { action: HumanScrimmageInput['action']; expiresAt: number } | null = null;
  let lastHumanAction: HumanScrimmageInput['action'] | 'none' = 'none';
  let humanInputCount = 0;
  let accumulator = 0;
  let lastFrame = performance.now();

  const snapshots = BOT_DIFFICULTY_TIERS.map((candidate) => getPhysicalDifficultySnapshot(candidate));
  const invariant = snapshots.every((snapshot) => JSON.stringify(snapshot) === JSON.stringify(snapshots[0]));
  proofView.textContent = invariant
    ? 'Physical invariant PASS · movement ×1 · acceleration ×1 · stamina ×1 · tackle collider ×1 · ball physics ×1 · goalkeeper reach ×1 at every difficulty.'
    : 'Physical invariant FAILED — difficulty is changing physical rules.';
  probe.dataset.physicalInvariant = String(invariant);

  function resize(): void {
    const rect = stage.getBoundingClientRect();
    const width = Math.max(1, Math.floor(rect.width));
    const height = Math.max(1, Math.floor(rect.height));
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  }

  function render(): void {
    const controlledId = getControlledPlayerId(state);
    for (const player of state.players) {
      const visual = players.get(player.id);
      if (!visual) continue;
      visual.position.set(player.position.x, player.position.y, player.position.z);
      visual.rotation.y = player.facingYaw;
      const controlRing = visual.children.find((child) => child instanceof THREE.Mesh && child.geometry.type === 'RingGeometry');
      if (controlRing) controlRing.visible = player.id === controlledId;
      const body = visual.children[0] as THREE.Mesh;
      const material = body.material as THREE.MeshStandardMaterial;
      material.emissive.setHex(player.id === state.possessionPlayerId ? 0x465119 : 0x000000);
      material.emissiveIntensity = player.id === state.possessionPlayerId ? 0.55 : 0;
    }
    ballVisual.position.set(state.ball.position.x, Math.max(0.16, state.ball.position.y), state.ball.position.z);
    possessionView.textContent = state.possessionPlayerId ? state.possessionPlayerId.toUpperCase() : 'LOOSE';
    contactsView.textContent = String(state.contactCount);
    looseView.textContent = String(state.looseBallTicks);
    changesView.textContent = String(state.possessionChanges);
    scoreView.textContent = `${state.score.home}–${state.score.away}`;
    eventView.textContent = `${state.lastEvent} · tick ${state.tick} · checksum ${state.checksum}`;
    probe.dataset.tick = String(state.tick);
    probe.dataset.possessionPlayer = state.possessionPlayerId ?? '';
    probe.dataset.possessionTeam = state.possessionTeam ?? 'loose';
    probe.dataset.contactCount = String(state.contactCount);
    probe.dataset.looseBallTicks = String(state.looseBallTicks);
    probe.dataset.possessionChanges = String(state.possessionChanges);
    probe.dataset.scoreHome = String(state.score.home);
    probe.dataset.scoreAway = String(state.score.away);
    probe.dataset.restartCount = String(state.restartCount);
    probe.dataset.checksum = state.checksum;
    probe.dataset.tier = homeTier;
    probe.dataset.homeTier = homeTier;
    probe.dataset.awayTier = awayTier;
    probe.dataset.spectatorMode = String(spectatorMode);
    probe.dataset.personality = personality;
    probe.dataset.homePlaystyle = homePlaystyle;
    probe.dataset.awayPlaystyle = awayPlaystyle;
    const controlled = controlledId ? state.players.find((player) => player.id === controlledId) : null;
    userPlayerLabel.textContent = spectatorMode
      ? 'BOT VS BOT · both teams autonomous'
      : `You: ${controlledId}${state.possessionPlayerId === controlledId ? ' · on ball' : ''}`;
    probe.dataset.userPlayer = controlledId ?? '';
    probe.dataset.userX = String(controlled?.position.x ?? '');
    probe.dataset.userZ = String(controlled?.position.z ?? '');
    probe.dataset.humanInputCount = String(humanInputCount);
    probe.dataset.lastHumanAction = lastHumanAction;
    probe.dataset.lastHumanContact = [...state.recentContacts].reverse().find((contact) => contact.playerId === 'h-1')?.kind ?? '';
    probe.dataset.queuedHumanAction = queuedAction?.action ?? '';
    renderer.render(scene, camera);
  }

  function setSpectatorMode(next: boolean): void {
    spectatorMode = next;
    pressedKeys.clear();
    queuedAction = null;
    spectatorButton.textContent = spectatorMode ? 'Take control' : 'Watch bot match';
    spectatorButton.setAttribute('aria-pressed', String(spectatorMode));
    stage.setAttribute('aria-label', spectatorMode ? 'Watch both bot teams play on the pitch' : 'Click the pitch to control your player');
    if (globalModeHint) globalModeHint.textContent = spectatorMode
      ? 'Bot Spectator: both teams play autonomously · set levels and styles to compare'
      : 'Adaptive Bot Playtest: WASD move · Shift sprint · E pass · Space shoot · C challenge';
    description.textContent = spectatorMode
      ? 'Watching a deterministic bot-vs-bot match. Set each team’s level and playstyle to compare movement, passing, pressure, shooting and goalkeeper decisions.'
      : 'You control h-1 throughout. Your teammate and the opposing team use their selected bot levels with the same movement, ball and contact rules.';
    const controlsGuide = mustQuery<HTMLElement>(lab, '[data-human-controls]');
    controlsGuide.hidden = spectatorMode;
    render();
  }

  function getControlledPlayerId(_current: Readonly<PhysicalScrimmageState>): string | null {
    return spectatorMode ? null : 'h-1';
  }

  function takeHumanInput(): HumanScrimmageInput {
    const playerId = getControlledPlayerId(state) ?? 'h-1';
    // The oblique camera's screen-right axis is world -X, so invert only X.
    const moveX = Number(pressedKeys.has('a')) - Number(pressedKeys.has('d'));
    const moveY = Number(pressedKeys.has('w')) - Number(pressedKeys.has('s'));
    const magnitude = Math.hypot(moveX, moveY);
    const normalizedX = magnitude > 1 ? moveX / magnitude : moveX;
    const normalizedY = magnitude > 1 ? moveY / magnitude : moveY;
    const player = state.players.find((candidate) => candidate.id === playerId);
    const action = queuedAction && queuedAction.expiresAt > performance.now() ? queuedAction.action : 'carry';
    const targetPlayerId = action === 'pass'
      ? state.players
        .filter((candidate) => candidate.team === 'home' && !candidate.goalkeeper && candidate.id !== playerId)
        .sort((left, right) => {
          const leftDistance = Math.hypot(left.position.x - (player?.position.x ?? 0), left.position.z - (player?.position.z ?? 0));
          const rightDistance = Math.hypot(right.position.x - (player?.position.x ?? 0), right.position.z - (player?.position.z ?? 0));
          return leftDistance - rightDistance;
        })[0]?.id ?? null
      : null;
    if (queuedAction && queuedAction.expiresAt <= performance.now()) queuedAction = null;
    return {
      playerId,
      moveX: normalizedX,
      moveY: normalizedY,
      aimYaw: magnitude > 0 ? Math.atan2(normalizedX, normalizedY) : player?.facingYaw ?? 0,
      sprint: pressedKeys.has('shift'),
      action,
      targetPlayerId,
    };
  }

  function onKeyDown(event: KeyboardEvent): void {
    if (!active || event.target instanceof HTMLSelectElement || event.target instanceof HTMLButtonElement) return;
    const key = event.key.toLowerCase();
    if (['w', 'a', 's', 'd', 'shift'].includes(key)) {
      event.preventDefault();
      event.stopPropagation();
      pressedKeys.add(key);
      return;
    }
    if (event.repeat) return;
    const actions: Record<string, HumanScrimmageInput['action']> = { e: 'pass', ' ': 'shoot', c: 'challenge' };
    const action = actions[key];
    if (action) {
      event.preventDefault();
      event.stopPropagation();
      queuedAction = { action, expiresAt: performance.now() + 900 };
      lastHumanAction = action;
      humanInputCount += 1;
    }
  }

  function onKeyUp(event: KeyboardEvent): void {
    if (!active) return;
    pressedKeys.delete(event.key.toLowerCase());
  }

  window.addEventListener('keydown', onKeyDown, true);
  window.addEventListener('keyup', onKeyUp, true);

  function personalities(): Record<string, BotPersonalityId> {
    return {
      'h-1': personality,
      'h-2': personality,
      'h-gk': 'calm-keeper',
      'a-1': 'balanced',
      'a-2': 'winger',
      'a-gk': 'calm-keeper',
    };
  }

  function reset(): void {
    state = createPhysicalScrimmage(0x507a11);
    accumulator = 0;
    pressedKeys.clear();
    queuedAction = null;
    lastHumanAction = 'none';
    humanInputCount = 0;
    render();
  }

  function setActive(next: boolean): void {
    active = next;
    lab.hidden = !next;
    button.dataset.active = String(next);
    if (next) {
      if (globalModeHint) globalModeHint.textContent = spectatorMode
        ? 'Bot Spectator: both teams play autonomously · set levels and styles to compare'
        : 'Adaptive Bot Playtest: WASD move · Shift sprint · E pass · Space shoot · C challenge';
      if (document.pointerLockElement) void document.exitPointerLock();
      if (tacticalLab) tacticalLab.hidden = true;
      if (adaptiveLab) adaptiveLab.hidden = true;
      if (tacticalButton) tacticalButton.dataset.active = 'false';
      if (adaptiveButton) adaptiveButton.dataset.active = 'false';
      practiceButton.dataset.active = 'false';
      ballLabButton.dataset.active = 'false';
      resize();
      render();
      stage.focus();
    } else {
      if (globalModeHint) globalModeHint.textContent = originalModeHint;
      pressedKeys.clear();
      queuedAction = null;
    }
  }

  button.addEventListener('click', () => setActive(true));
  for (const other of [practiceButton, ballLabButton, tacticalButton, adaptiveButton]) other?.addEventListener('click', () => setActive(false));
  homeTierSelect.addEventListener('change', () => { homeTier = homeTierSelect.value as BotDifficultyTier; render(); });
  awayTierSelect.addEventListener('change', () => { awayTier = awayTierSelect.value as BotDifficultyTier; render(); });
  personalitySelect.addEventListener('change', () => { personality = personalitySelect.value as BotPersonalityId; render(); });
  homePlaystyleSelect.addEventListener('change', () => { homePlaystyle = homePlaystyleSelect.value as TeamPlaystyle; render(); });
  awayPlaystyleSelect.addEventListener('change', () => { awayPlaystyle = awayPlaystyleSelect.value as TeamPlaystyle; render(); });
  pauseButton.addEventListener('click', () => {
    paused = !paused;
    pauseButton.textContent = paused ? 'Resume' : 'Pause';
    badge.innerHTML = paused ? '<strong class="physical-paused">PAUSED</strong> · deterministic state held' : '<strong>LIVE</strong> · same movement + ball + contacts';
  });
  resetButton.addEventListener('click', reset);
  spectatorButton.addEventListener('click', () => setSpectatorMode(!spectatorMode));
  window.addEventListener('resize', resize);

  function frame(now: number): void {
    const delta = Math.max(0, Math.min(0.1, (now - lastFrame) / 1000));
    lastFrame = now;
    try {
      if (active && !paused) {
        accumulator += delta;
        while (accumulator + 1e-12 >= FIXED_DT) {
          state = stepPhysicalScrimmage(
            state,
            FIXED_DT,
            homeTier,
            personalities(),
            spectatorMode ? undefined : takeHumanInput(),
            { home: homePlaystyle, away: awayPlaystyle },
            { home: homeTier, away: awayTier },
          );
          const actionContact: Record<HumanScrimmageInput['action'], string> = {
            carry: '', pass: 'pass', shoot: 'shot', challenge: 'standing-challenge',
          };
          const pendingAction = queuedAction;
          if (pendingAction && state.recentContacts.some((contact) => contact.tick === state.tick
            && contact.playerId === 'h-1' && contact.kind === actionContact[pendingAction.action])) queuedAction = null;
          accumulator -= FIXED_DT;
        }
        render();
      }
    } catch (error) {
      const detail = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
      eventView.textContent = `Simulation error at tick ${state.tick}: ${detail}`;
      console.error('Adaptive Bot Playtest frame failed', error);
    }
    requestAnimationFrame(frame);
  }

  render();
  requestAnimationFrame(frame);
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once: true });
else install();
