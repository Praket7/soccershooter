import * as THREE from 'three';
import {
  createPhysicalScrimmage,
  getPhysicalDifficultySnapshot,
  stepPhysicalScrimmage,
  type PhysicalScrimmageState,
} from '../../../../packages/bots/src/physicalScrimmage';
import { BOT_DIFFICULTY_TIERS, type BotDifficultyTier } from '../../../../packages/bots/src/difficulty';
import { BOT_PERSONALITY_IDS, type BotPersonalityId } from '../../../../packages/bots/src/personalities';

const FIXED_DT = 1 / 30;

function mustQuery<T extends Element>(root: ParentNode, selector: string): T {
  const element = root.querySelector<T>(selector);
  if (!element) throw new Error(`Physical Bot Scrimmage missing ${selector}`);
  return element;
}

function createStyles(): HTMLStyleElement {
  const style = document.createElement('style');
  style.textContent = `
    .physical-bot-scrimmage{position:absolute;inset:0;z-index:32;background:#071018;color:#eef5f6;font-family:Inter,system-ui,sans-serif;display:grid;grid-template-columns:minmax(0,1fr) 300px;overflow:hidden}
    .physical-bot-scrimmage[hidden]{display:none}.physical-stage{position:relative;min-width:0;min-height:0;background:radial-gradient(circle at 50% 15%,rgba(92,133,119,.18),transparent 52%),#071018}.physical-stage canvas{width:100%;height:100%;display:block}.physical-side{border-left:1px solid rgba(255,255,255,.1);background:rgba(8,18,27,.96);padding:18px;overflow:auto;display:flex;flex-direction:column;gap:14px}.physical-side h2{margin:0;font-size:23px}.physical-kicker{margin:0;color:#88a6b6;font-size:10px;text-transform:uppercase;letter-spacing:.13em}.physical-copy{margin:4px 0 0;color:#abc0ca;font-size:12px;line-height:1.5}.physical-proof{padding:10px;border:1px solid rgba(122,225,153,.25);background:#10251b;border-radius:9px;color:#bee8c9;font-size:11px;line-height:1.5}.physical-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px}.physical-stat{padding:9px;border-radius:8px;background:#10202c}.physical-stat strong{display:block;font-size:17px}.physical-stat span{font-size:9px;color:#8fa4b1;text-transform:uppercase;letter-spacing:.06em}.physical-controls{display:grid;gap:8px}.physical-controls label{display:grid;gap:5px;color:#9fb3bf;font-size:10px;text-transform:uppercase;letter-spacing:.07em}.physical-controls select,.physical-controls button{border:1px solid rgba(255,255,255,.16);background:#142738;color:#f3f8fa;border-radius:8px;padding:9px;font:inherit}.physical-controls button{cursor:pointer;font-weight:750}.physical-event{padding:10px;border-radius:8px;background:#0e1d28;font-size:11px;color:#d6e2e8;min-height:34px}.physical-legend{display:grid;gap:5px;color:#9fb1bc;font-size:10px}.physical-legend i{display:inline-block;width:8px;height:8px;border-radius:50%;margin-right:6px}.physical-home{background:#e3b341}.physical-away{background:#4e9fe8}.physical-loose{background:#f4f1e8;border:1px solid #222}.physical-badge{position:absolute;left:16px;top:14px;padding:7px 10px;border-radius:999px;background:rgba(5,12,18,.74);border:1px solid rgba(255,255,255,.12);font-size:10px;letter-spacing:.08em;text-transform:uppercase;pointer-events:none}.physical-badge strong{color:#d3f469}.physical-paused{color:#ffd59a}
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
    if (copy) copy.textContent = 'Symbolic blackboard for roles, support spacing and tactical decisions only. Possession on this page is scripted; use Physical 3v3 to validate real ball control.';
  }
  if (adaptiveButton) adaptiveButton.textContent = 'Adaptive Debug';
  const adaptiveLab = document.querySelector<HTMLElement>('[data-adaptive-bot-lab]');
  if (adaptiveLab) {
    const heading = adaptiveLab.querySelector('h2');
    if (heading) heading.textContent = 'Adaptive Debug';
    const copy = adaptiveLab.querySelector<HTMLElement>('.adaptive-copy');
    if (copy) copy.textContent = 'Static cognition inspection remains useful for comparing tiers. Physical 3v3 is now the owner acceptance surface for whether those differences survive real ball contacts.';
  }

  const button = document.createElement('button');
  button.type = 'button';
  button.dataset.modePhysicalBots = 'true';
  button.dataset.active = 'false';
  button.textContent = 'Physical 3v3';
  modeSwitch.append(button);

  const lab = document.createElement('section');
  lab.className = 'physical-bot-scrimmage';
  lab.dataset.physicalBotScrimmage = 'true';
  lab.hidden = true;
  lab.innerHTML = `
    <div class="physical-stage" data-physical-stage><div class="physical-badge" data-physical-badge><strong>LIVE</strong> · same movement + ball + contacts</div></div>
    <aside class="physical-side">
      <div><p class="physical-kicker">Stage 06–07 owner acceptance</p><h2>Physical 3v3 Scrimmage</h2><p class="physical-copy">Six bots choose Stage 06/07 tactical intent, but success is decided by Stage 03 movement, Stage 04 ball physics and Stage 05 contacts. Possession can be loose.</p></div>
      <div class="physical-grid">
        <div class="physical-stat"><strong data-physical-possession>HOME</strong><span>control</span></div>
        <div class="physical-stat"><strong data-physical-contacts>0</strong><span>contacts</span></div>
        <div class="physical-stat"><strong data-physical-loose>0</strong><span>loose ticks</span></div>
        <div class="physical-stat"><strong data-physical-changes>0</strong><span>control changes</span></div>
      </div>
      <div class="physical-controls">
        <label>Difficulty<select data-physical-tier>${BOT_DIFFICULTY_TIERS.map((tier) => `<option value="${tier}" ${tier === 'standard' ? 'selected' : ''}>${tier}</option>`).join('')}</select></label>
        <label>Home carrier personality<select data-physical-personality>${BOT_PERSONALITY_IDS.map((id) => `<option value="${id}" ${id === 'balanced' ? 'selected' : ''}>${id}</option>`).join('')}</select></label>
        <button type="button" data-physical-pause>Pause</button>
        <button type="button" data-physical-reset>Reset seeded scrimmage</button>
      </div>
      <div class="physical-proof" data-physical-proof>Physical fairness loading…</div>
      <div class="physical-event" data-physical-event>scrimmage-ready</div>
      <div class="physical-legend"><span><i class="physical-home"></i>home</span><span><i class="physical-away"></i>away</span><span><i class="physical-loose"></i>white ball is never welded to a carrier</span></div>
      <output data-physical-state data-tick="0" data-possession-player="h-1" data-possession-team="home" data-contact-count="0" data-loose-ball-ticks="0" data-possession-changes="0" data-checksum="" data-tier="standard" data-personality="balanced" data-physical-invariant="true" hidden></output>
    </aside>
  `;
  viewport.append(lab);

  const stage = mustQuery<HTMLElement>(lab, '[data-physical-stage]');
  const probe = mustQuery<HTMLOutputElement>(lab, '[data-physical-state]');
  const possessionView = mustQuery<HTMLElement>(lab, '[data-physical-possession]');
  const contactsView = mustQuery<HTMLElement>(lab, '[data-physical-contacts]');
  const looseView = mustQuery<HTMLElement>(lab, '[data-physical-loose]');
  const changesView = mustQuery<HTMLElement>(lab, '[data-physical-changes]');
  const eventView = mustQuery<HTMLElement>(lab, '[data-physical-event]');
  const proofView = mustQuery<HTMLElement>(lab, '[data-physical-proof]');
  const badge = mustQuery<HTMLElement>(lab, '[data-physical-badge]');
  const tierSelect = mustQuery<HTMLSelectElement>(lab, '[data-physical-tier]');
  const personalitySelect = mustQuery<HTMLSelectElement>(lab, '[data-physical-personality]');
  const pauseButton = mustQuery<HTMLButtonElement>(lab, '[data-physical-pause]');
  const resetButton = mustQuery<HTMLButtonElement>(lab, '[data-physical-reset]');

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x081119);
  scene.fog = new THREE.Fog(0x081119, 30, 64);
  const camera = new THREE.PerspectiveCamera(49, 1, 0.1, 100);
  camera.position.set(0, 25, -25);
  camera.lookAt(0, 0, 1.5);
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.domElement.dataset.physicalScrimmageCanvas = 'true';
  renderer.domElement.setAttribute('aria-label', 'Physical 3v3 bot scrimmage');
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
    scene.add(visual);
    players.set(player.id, visual);
  }

  let active = false;
  let paused = false;
  let tier: BotDifficultyTier = 'standard';
  let personality: BotPersonalityId = 'balanced';
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
    for (const player of state.players) {
      const visual = players.get(player.id);
      if (!visual) continue;
      visual.position.set(player.position.x, player.position.y, player.position.z);
      visual.rotation.y = player.facingYaw;
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
    eventView.textContent = `${state.lastEvent} · checksum ${state.checksum}`;
    probe.dataset.tick = String(state.tick);
    probe.dataset.possessionPlayer = state.possessionPlayerId ?? '';
    probe.dataset.possessionTeam = state.possessionTeam ?? 'loose';
    probe.dataset.contactCount = String(state.contactCount);
    probe.dataset.looseBallTicks = String(state.looseBallTicks);
    probe.dataset.possessionChanges = String(state.possessionChanges);
    probe.dataset.checksum = state.checksum;
    probe.dataset.tier = tier;
    probe.dataset.personality = personality;
    renderer.render(scene, camera);
  }

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
    render();
  }

  function setActive(next: boolean): void {
    active = next;
    lab.hidden = !next;
    button.dataset.active = String(next);
    if (next) {
      if (document.pointerLockElement) void document.exitPointerLock();
      if (tacticalLab) tacticalLab.hidden = true;
      if (adaptiveLab) adaptiveLab.hidden = true;
      if (tacticalButton) tacticalButton.dataset.active = 'false';
      if (adaptiveButton) adaptiveButton.dataset.active = 'false';
      practiceButton.dataset.active = 'false';
      ballLabButton.dataset.active = 'false';
      resize();
      render();
    }
  }

  button.addEventListener('click', () => setActive(true));
  for (const other of [practiceButton, ballLabButton, tacticalButton, adaptiveButton]) other?.addEventListener('click', () => setActive(false));
  tierSelect.addEventListener('change', () => { tier = tierSelect.value as BotDifficultyTier; render(); });
  personalitySelect.addEventListener('change', () => { personality = personalitySelect.value as BotPersonalityId; render(); });
  pauseButton.addEventListener('click', () => {
    paused = !paused;
    pauseButton.textContent = paused ? 'Resume' : 'Pause';
    badge.innerHTML = paused ? '<strong class="physical-paused">PAUSED</strong> · deterministic state held' : '<strong>LIVE</strong> · same movement + ball + contacts';
  });
  resetButton.addEventListener('click', reset);
  window.addEventListener('resize', resize);

  function frame(now: number): void {
    const delta = Math.max(0, Math.min(0.1, (now - lastFrame) / 1000));
    lastFrame = now;
    if (active && !paused) {
      accumulator += delta;
      while (accumulator + 1e-12 >= FIXED_DT) {
        state = stepPhysicalScrimmage(state, FIXED_DT, tier, personalities());
        accumulator -= FIXED_DT;
      }
      render();
    }
    requestAnimationFrame(frame);
  }

  render();
  requestAnimationFrame(frame);
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once: true });
else install();
