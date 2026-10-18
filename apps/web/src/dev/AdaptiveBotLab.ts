import { applyAdaptiveBoundary, createAdaptiveDirector, type AdaptiveDirectorState, type AdaptiveGameMode } from '../../../../packages/bots/src/adaptiveDirector';
import {
  BOT_DIFFICULTY_TIERS,
  difficultyParameterSnapshot,
  physicalDifficultySnapshot,
  type BotDifficultyTier,
} from '../../../../packages/bots/src/difficulty';
import { createDisabledHighLevelPolicy } from '../../../../packages/bots/src/highLevelPolicy';
import { BOT_PERSONALITY_IDS, type BotPersonalityId } from '../../../../packages/bots/src/personalities';
import {
  createPlayerModel,
  playerModelSnapshot,
  recordPlayerObservation,
  type PlayerModelState,
} from '../../../../packages/bots/src/playerModel';
import { createTeamBotRuntime, stepTeamBotRuntime } from '../../../../packages/bots/src/runtime';
import type { BotWorldSnapshot } from '../../../../packages/bots/src/types';

function mustQuery<T extends Element>(root: ParentNode, selector: string): T {
  const element = root.querySelector<T>(selector);
  if (!element) throw new Error(`Adaptive Bot Lab missing ${selector}`);
  return element;
}

function createWorld(tick: number): BotWorldSnapshot {
  return {
    tick,
    timeSeconds: tick / 30,
    field: { halfWidth: 12, halfLength: 18, goalHalfWidth: 3.66 },
    ball: { position: { x: -2.1, y: 0.11, z: 7.4 }, velocity: { x: 0, y: 0, z: 0 } },
    players: [
      { id: 'h-gk', team: 'home', goalkeeper: true, position: { x: 0, y: 0, z: -16.7 }, velocity: { x: 0, y: 0, z: 0 }, facingYaw: 0 },
      { id: 'h-1', team: 'home', goalkeeper: false, position: { x: -2.1, y: 0, z: 7.4 }, velocity: { x: 0, y: 0, z: 0 }, facingYaw: 0 },
      { id: 'h-2', team: 'home', goalkeeper: false, position: { x: 4.8, y: 0, z: 11.5 }, velocity: { x: 0, y: 0, z: 0 }, facingYaw: 0 },
      { id: 'a-gk', team: 'away', goalkeeper: true, position: { x: 0, y: 0, z: 16.7 }, velocity: { x: 0, y: 0, z: 0 }, facingYaw: Math.PI },
      { id: 'a-1', team: 'away', goalkeeper: false, position: { x: -1.1, y: 0, z: 8.4 }, velocity: { x: 0, y: 0, z: 0 }, facingYaw: Math.PI },
      { id: 'a-2', team: 'away', goalkeeper: false, position: { x: 3.7, y: 0, z: 11.9 }, velocity: { x: 0, y: 0, z: 0 }, facingYaw: Math.PI },
    ],
    possessionTeam: 'home',
    possessionPlayerId: 'h-1',
  };
}

function createStyles(): HTMLStyleElement {
  const style = document.createElement('style');
  style.textContent = `
    .adaptive-bot-lab{position:absolute;inset:0;z-index:24;background:#071019;color:#edf5f7;font-family:Inter,system-ui,sans-serif;display:grid;grid-template-columns:minmax(0,1fr) 320px;overflow:hidden}
    .adaptive-bot-lab[hidden]{display:none}.adaptive-main{padding:20px;overflow:auto}.adaptive-side{padding:18px;border-left:1px solid rgba(255,255,255,.1);background:#0a151f;overflow:auto;display:flex;flex-direction:column;gap:14px}
    .adaptive-main h2,.adaptive-side h3{margin:0}.adaptive-kicker{margin:0 0 4px;color:#8ea6b8;font-size:11px;text-transform:uppercase;letter-spacing:.12em}.adaptive-copy{color:#a9bac6;font-size:12px;line-height:1.5;margin:6px 0 16px}
    .adaptive-tier-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}.adaptive-tier{border:1px solid rgba(255,255,255,.12);border-radius:12px;background:#0d1b27;padding:14px;display:grid;gap:9px}.adaptive-tier[data-tier='elite']{border-color:rgba(211,244,105,.42)}
    .adaptive-tier h3{font-size:20px;text-transform:capitalize}.adaptive-metric{display:flex;justify-content:space-between;gap:10px;font-size:11px;color:#9fb1be}.adaptive-metric strong{color:#eef5f7}.adaptive-decision{margin-top:4px;padding:9px;border-radius:8px;background:#132635;font-size:11px;line-height:1.45}.adaptive-physics{margin-top:14px;padding:12px;border-radius:10px;background:#102018;border:1px solid rgba(116,224,150,.22);font-size:11px;color:#bfe3c9}
    .adaptive-controls{display:grid;gap:7px}.adaptive-controls button,.adaptive-controls select{border:1px solid rgba(255,255,255,.15);background:#152737;color:#f3f8fa;border-radius:8px;padding:9px;font:inherit}.adaptive-controls button{cursor:pointer;font-weight:700}.adaptive-state{padding:10px;border-radius:8px;background:#0e1e2a;font-size:11px;line-height:1.5}.adaptive-confidence{height:6px;background:#192b38;border-radius:999px;overflow:hidden}.adaptive-confidence i{display:block;height:100%;background:#d3f469;width:0%}.adaptive-warning{padding:10px;border-radius:8px;background:#2a1c0e;color:#ffd59a;font-size:11px;line-height:1.45}.adaptive-ok{padding:10px;border-radius:8px;background:#10251c;color:#bde8c9;font-size:11px;line-height:1.45}
    @media(max-width:850px){.adaptive-bot-lab{grid-template-columns:1fr;grid-template-rows:minmax(0,1fr) auto}.adaptive-side{border-left:0;border-top:1px solid rgba(255,255,255,.1);max-height:300px}.adaptive-tier-grid{grid-template-columns:1fr}}
  `;
  return style;
}

function install(): void {
  const modeSwitch = document.querySelector<HTMLElement>('.mode-switch');
  const viewport = document.querySelector<HTMLElement>('#game-viewport');
  if (!modeSwitch || !viewport) return;
  const modeSwitchElement = modeSwitch;
  document.head.append(createStyles());

  const practiceButton = mustQuery<HTMLButtonElement>(document, '[data-mode-practice]');
  const ballLabButton = mustQuery<HTMLButtonElement>(document, '[data-mode-ball-lab]');
  const tacticalButton = document.querySelector<HTMLButtonElement>('[data-mode-tactical-bots]');
  const button = document.createElement('button');
  button.type = 'button';
  button.dataset.modeAdaptiveBots = 'true';
  button.dataset.active = 'false';
  button.textContent = 'Adaptive Bot Lab';
  modeSwitchElement.append(button);

  const lab = document.createElement('section');
  lab.className = 'adaptive-bot-lab';
  lab.dataset.adaptiveBotLab = 'true';
  lab.hidden = true;
  lab.innerHTML = `
    <main class="adaptive-main">
      <p class="adaptive-kicker">Stage 07 · fair adaptive cognition</p>
      <h2>Adaptive Bot Lab</h2>
      <p class="adaptive-copy">The three cards below call the real tactical runtime on the same seeded world. Difficulty changes perception, reaction, prediction and precision only. The authoritative physical envelope is identical.</p>
      <div class="adaptive-tier-grid" data-tier-grid></div>
      <div class="adaptive-physics" data-physics-proof></div>
    </main>
    <aside class="adaptive-side">
      <div><p class="adaptive-kicker">Player model</p><h3>Boundary adaptation</h3></div>
      <div class="adaptive-state" data-model-state>No gameplay evidence yet.</div>
      <div class="adaptive-confidence"><i data-confidence-bar></i></div>
      <div class="adaptive-controls">
        <button type="button" data-sample-novice>Add novice-like samples</button>
        <button type="button" data-sample-elite>Add elite-like samples</button>
        <button type="button" data-apply-restart>Apply restart boundary</button>
        <button type="button" data-try-live>Try mid-possession change</button>
        <button type="button" data-toggle-mode>Mode: PvE</button>
        <label>Carrier personality<select data-personality>${BOT_PERSONALITY_IDS.map((id) => `<option value="${id}">${id}</option>`).join('')}</select></label>
        <button type="button" data-reset-adaptive>Reset model</button>
      </div>
      <div class="adaptive-state" data-director-state>Tier: STANDARD · PvE adaptation ON</div>
      <div class="adaptive-warning" data-learning-state>Learned policy: DISABLED. Promotion remains blocked until cooperation, exploit, safety, inference, readability, win-rate and human-preference gates all pass.</div>
      <div class="adaptive-ok">Physical fairness: speed ×1 · acceleration ×1 · stamina ×1 · tackle collider ×1 · ball physics ×1 · goalkeeper reach ×1 for every tier.</div>
    </aside>
    <output data-adaptive-state data-sim-tick="0" data-mode="pve" data-current-tier="standard" data-model-confidence="0" data-last-boundary="none" data-learned-enabled="false" data-physical-invariant="true" hidden></output>
  `;
  viewport.append(lab);

  const tierGrid = mustQuery<HTMLElement>(lab, '[data-tier-grid]');
  const physicsProof = mustQuery<HTMLElement>(lab, '[data-physics-proof]');
  const probe = mustQuery<HTMLOutputElement>(lab, '[data-adaptive-state]');
  const modelView = mustQuery<HTMLElement>(lab, '[data-model-state]');
  const confidenceBar = mustQuery<HTMLElement>(lab, '[data-confidence-bar]');
  const directorView = mustQuery<HTMLElement>(lab, '[data-director-state]');
  const personalitySelect = mustQuery<HTMLSelectElement>(lab, '[data-personality]');
  const noviceSample = mustQuery<HTMLButtonElement>(lab, '[data-sample-novice]');
  const eliteSample = mustQuery<HTMLButtonElement>(lab, '[data-sample-elite]');
  const restart = mustQuery<HTMLButtonElement>(lab, '[data-apply-restart]');
  const live = mustQuery<HTMLButtonElement>(lab, '[data-try-live]');
  const toggleMode = mustQuery<HTMLButtonElement>(lab, '[data-toggle-mode]');
  const reset = mustQuery<HTMLButtonElement>(lab, '[data-reset-adaptive]');
  const gameCanvas = document.querySelector<HTMLElement>('[data-game-viewport]');
  const hiddenCards = Array.from(document.querySelectorAll<HTMLElement>('.control-card,.action-feedback,.course-card'));

  let active = false;
  let tick = 0;
  let mode: AdaptiveGameMode = 'pve';
  let playerModel: PlayerModelState = createPlayerModel();
  let director: AdaptiveDirectorState = createAdaptiveDirector(mode, 'standard');
  let boundaryCounter = 0;
  let personality: BotPersonalityId = 'balanced';
  const learned = createDisabledHighLevelPolicy();

  function confidence(): number {
    const snapshot = playerModelSnapshot(playerModel);
    return [snapshot.passAccuracy, snapshot.shotConversion, snapshot.pressuredTurnoverRate, snapshot.dribbleSuccess, snapshot.defensiveTiming, snapshot.reactionProxy, snapshot.techniqueDiversity]
      .reduce((sum, metric) => sum + metric.confidence, 0) / 7;
  }

  function updateModelView(): void {
    const snapshot = playerModelSnapshot(playerModel);
    const c = confidence();
    modelView.textContent = c <= 0.001
      ? 'No gameplay evidence yet.'
      : `Pass ${(snapshot.passAccuracy.value * 100).toFixed(0)}% · shot ${(snapshot.shotConversion.value * 100).toFixed(0)}% · dribble ${(snapshot.dribbleSuccess.value * 100).toFixed(0)}% · pressure turnovers ${(snapshot.pressuredTurnoverRate.value * 100).toFixed(0)}% · confidence ${(c * 100).toFixed(0)}%`;
    confidenceBar.style.width = `${Math.round(c * 100)}%`;
    probe.dataset.modelConfidence = c.toFixed(4);
  }

  function updateDirectorView(boundary: string): void {
    directorView.textContent = `Tier: ${director.tier.toUpperCase()} · ${mode.toUpperCase()} adaptation ${director.adaptationEnabled ? 'ON' : 'LOCKED'} · changes ${director.changeCount} · last ${boundary}`;
    probe.dataset.mode = mode;
    probe.dataset.currentTier = director.tier;
    probe.dataset.lastBoundary = boundary;
  }

  function tierCard(tier: BotDifficultyTier): string {
    const d = difficultyParameterSnapshot(tier);
    const world = createWorld(tick);
    const result = stepTeamBotRuntime(world, 'home', createTeamBotRuntime(), {
      tier,
      seed: 0x7007,
      personalitiesByPlayerId: { 'h-1': personality, 'h-2': 'winger', 'h-gk': 'calm-keeper' },
    });
    const carrier = result.intents.find((intent) => intent.playerId === 'h-1');
    return `<article class="adaptive-tier" data-tier="${tier}" data-tier-card="${tier}">
      <h3>${tier}</h3>
      <div class="adaptive-metric"><span>reaction</span><strong>${Math.round(d.reactionDelaySeconds * 1000)} ms</strong></div>
      <div class="adaptive-metric"><span>observation noise</span><strong>${Math.round(d.observationNoiseMetres * 100)} cm</strong></div>
      <div class="adaptive-metric"><span>prediction horizon</span><strong>${d.predictionHorizonSeconds.toFixed(2)} s</strong></div>
      <div class="adaptive-metric"><span>aim error cap</span><strong>${(d.aimErrorRadians * 57.2958).toFixed(1)}°</strong></div>
      <div class="adaptive-metric"><span>coordinated runs</span><strong>${Math.round(d.coordinatedRunFrequency * 100)}%</strong></div>
      <div class="adaptive-metric"><span>defensive anticipation</span><strong>${Math.round(d.defensiveAnticipation * 100)}%</strong></div>
      <div class="adaptive-decision" data-tier-decision="${tier}">same world → ${carrier?.action ?? 'none'} · technique ${carrier?.technique ?? 'basic'} · utility ${(carrier?.utilityScore ?? 0).toFixed(3)}</div>
    </article>`;
  }

  function renderTiers(): void {
    tierGrid.innerHTML = BOT_DIFFICULTY_TIERS.map(tierCard).join('');
    const physical = BOT_DIFFICULTY_TIERS.map((tier) => physicalDifficultySnapshot(tier));
    const invariant = physical.every((value) => JSON.stringify(value) === JSON.stringify(physical[0]));
    physicsProof.textContent = `Authoritative physical snapshot identical across tiers: ${invariant ? 'YES' : 'NO'} · ${JSON.stringify(physical[0])}`;
    probe.dataset.physicalInvariant = String(invariant);
    probe.dataset.learnedEnabled = String(learned.enabled);
    probe.dataset.simTick = String(tick);
  }

  function addSamples(kind: 'novice' | 'elite'): void {
    for (let index = 0; index < 18; index += 1) {
      const elite = kind === 'elite';
      playerModel = recordPlayerObservation(playerModel, {
        timeSeconds: tick / 30 + index * 0.2,
        pass: { completed: elite ? index % 10 !== 0 : index % 3 === 0 },
        shot: { scored: elite ? index % 3 === 0 : index % 9 === 0 },
        pressuredTurnover: elite ? index % 9 === 0 : index % 2 === 0,
        dribble: { succeeded: elite ? index % 7 !== 0 : index % 3 === 0 },
        defensiveTiming: elite ? 0.88 : 0.25,
        reactionSeconds: elite ? 0.12 : 0.46,
        zone: elite ? 'attacking-center' : 'middle-center',
        technique: elite ? (index % 2 === 0 ? 'finesse' : 'driven') : 'normal',
      });
    }
    updateModelView();
  }

  function applyBoundary(kind: 'restart' | 'live-possession'): void {
    boundaryCounter += 1;
    const before = director.tier;
    director = applyAdaptiveBoundary(director, {
      kind,
      token: `${kind}-${boundaryCounter}`,
      playerModel: playerModelSnapshot(playerModel),
    });
    updateDirectorView(`${kind}:${before}->${director.tier}`);
  }

  noviceSample.addEventListener('click', () => addSamples('novice'));
  eliteSample.addEventListener('click', () => addSamples('elite'));
  restart.addEventListener('click', () => applyBoundary('restart'));
  live.addEventListener('click', () => applyBoundary('live-possession'));
  toggleMode.addEventListener('click', () => {
    mode = mode === 'pve' ? 'pvp' : 'pve';
    director = createAdaptiveDirector(mode, director.tier);
    toggleMode.textContent = `Mode: ${mode === 'pve' ? 'PvE' : 'PvP'}`;
    updateDirectorView('mode-switch');
  });
  personalitySelect.addEventListener('change', () => {
    personality = personalitySelect.value as BotPersonalityId;
    renderTiers();
  });
  reset.addEventListener('click', () => {
    playerModel = createPlayerModel();
    mode = 'pve';
    director = createAdaptiveDirector(mode, 'standard');
    boundaryCounter = 0;
    toggleMode.textContent = 'Mode: PvE';
    updateModelView();
    updateDirectorView('reset');
  });

  function deactivate(): void {
    active = false;
    lab.hidden = true;
    button.dataset.active = 'false';
    if (gameCanvas) gameCanvas.hidden = false;
    for (const card of hiddenCards) card.hidden = false;
  }

  function activate(): void {
    active = true;
    lab.hidden = false;
    button.dataset.active = 'true';
    if (document.pointerLockElement) document.exitPointerLock();
    const practice = document.querySelector<HTMLElement>('[data-football-practice]');
    const ballLab = document.querySelector<HTMLElement>('[data-ball-lab]');
    const tactical = document.querySelector<HTMLElement>('[data-bot-tactical-lab]');
    if (practice) practice.hidden = true;
    if (ballLab) ballLab.hidden = true;
    if (tactical) tactical.hidden = true;
    if (gameCanvas) gameCanvas.hidden = true;
    for (const card of hiddenCards) card.hidden = true;
    for (const other of Array.from(modeSwitchElement.querySelectorAll<HTMLButtonElement>('button'))) {
      if (other !== button) other.dataset.active = 'false';
    }
    renderTiers();
  }

  button.addEventListener('click', activate);
  practiceButton.addEventListener('click', deactivate, { capture: true });
  ballLabButton.addEventListener('click', deactivate, { capture: true });
  tacticalButton?.addEventListener('click', deactivate, { capture: true });

  updateModelView();
  updateDirectorView('none');
  renderTiers();
  window.setInterval(() => {
    if (!active) return;
    tick += 1;
    renderTiers();
  }, 300);
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once: true });
else install();