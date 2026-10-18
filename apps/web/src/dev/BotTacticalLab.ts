import { evaluatePassLane } from '../../../../packages/bots/src/passing';
import {
  createTeamBotRuntime,
  stepTeamBotRuntime,
  type TeamBotIntent,
  type TeamBotRuntimeState,
} from '../../../../packages/bots/src/runtime';
import {
  findPlayer,
  horizontalDistance,
  ownGoalZ,
  type BotPlayerSnapshot,
  type BotRole,
  type BotWorldSnapshot,
  type TeamId,
} from '../../../../packages/bots/src/types';

const DT = 0.1;
const NORMAL_SPEED = 6.4;
const SPRINT_SPEED = 8.2;
const MAX_ACCELERATION = 9.2;
const SWARM_DISTANCE = 2.25;
const SWARM_LIMIT_TICKS = 12;

interface PendingPass {
  fromId: string;
  toId: string;
  elapsed: number;
  duration: number;
  startX: number;
  startZ: number;
  targetX: number;
  targetZ: number;
}

interface ParticipantView {
  marker: HTMLElement;
  label: HTMLElement;
}

function mustQuery<T extends Element>(root: ParentNode, selector: string): T {
  const element = root.querySelector<T>(selector);
  if (!element) throw new Error(`Tactical Bot Lab missing ${selector}`);
  return element;
}

function createPlayer(id: string, team: TeamId, x: number, z: number, goalkeeper = false): BotPlayerSnapshot {
  return {
    id,
    team,
    goalkeeper,
    position: { x, y: 0, z },
    velocity: { x: 0, y: 0, z: 0 },
    facingYaw: team === 'home' ? 0 : Math.PI,
  };
}

function createWorld(): BotWorldSnapshot {
  return {
    tick: 0,
    timeSeconds: 0,
    field: { halfWidth: 12, halfLength: 18, goalHalfWidth: 3.66 },
    ball: { position: { x: 0, y: 0.11, z: 0 }, velocity: { x: 0, y: 0, z: 0 } },
    players: [
      createPlayer('h-gk', 'home', 0, -16.5, true),
      createPlayer('h-1', 'home', 0, 0),
      createPlayer('h-2', 'home', 5, 5),
      createPlayer('a-gk', 'away', 0, 16.5, true),
      createPlayer('a-1', 'away', 0.5, 0.8),
      createPlayer('a-2', 'away', -1.8, 1.5),
    ],
    possessionTeam: 'home',
    possessionPlayerId: 'h-1',
  };
}

function approach(current: number, target: number, maxDelta: number): number {
  const delta = target - current;
  return Math.abs(delta) <= maxDelta ? target : current + Math.sign(delta) * maxDelta;
}

function applyIntents(world: BotWorldSnapshot, intents: readonly TeamBotIntent[]): void {
  for (const intent of intents) {
    const player = findPlayer(world, intent.playerId);
    const speed = intent.sprint ? SPRINT_SPEED : NORMAL_SPEED;
    const maxDelta = MAX_ACCELERATION * DT;
    player.velocity.x = approach(player.velocity.x, intent.moveX * speed, maxDelta);
    player.velocity.z = approach(player.velocity.z, intent.moveY * speed, maxDelta);
    player.position.x = Math.max(-11.35, Math.min(11.35, player.position.x + player.velocity.x * DT));
    player.position.z = Math.max(-17.35, Math.min(17.35, player.position.z + player.velocity.z * DT));
    if (Math.hypot(player.velocity.x, player.velocity.z) > 0.05) {
      player.facingYaw = Math.atan2(player.velocity.x, player.velocity.z);
    }
  }
}

function nearestFieldPlayer(world: Readonly<BotWorldSnapshot>, team: TeamId): BotPlayerSnapshot | null {
  return world.players
    .filter((player) => player.team === team && !player.goalkeeper)
    .sort((a, b) => horizontalDistance(a.position, world.ball.position) - horizontalDistance(b.position, world.ball.position)
      || (a.id < b.id ? -1 : 1))[0] ?? null;
}

function roleForPlayer(
  id: string,
  home: Readonly<TeamBotRuntimeState>,
  away: Readonly<TeamBotRuntimeState>,
): BotRole | null {
  return home.roles.assignments.find((entry) => entry.playerId === id)?.role
    ?? away.roles.assignments.find((entry) => entry.playerId === id)?.role
    ?? null;
}

function createStyles(): HTMLStyleElement {
  const style = document.createElement('style');
  style.textContent = `
    .bot-tactical-lab{position:absolute;inset:0;z-index:12;display:grid;grid-template-columns:minmax(0,1fr) 260px;background:#081019;color:#e9f1f7;font-family:Inter,system-ui,sans-serif}
    .bot-tactical-lab[hidden]{display:none}.bot-tactical-pitch-wrap{padding:18px;display:grid;place-items:center;min-width:0}
    .bot-tactical-pitch{position:relative;width:min(74vh,70vw);aspect-ratio:2/3;max-height:calc(100% - 8px);overflow:hidden;border:2px solid rgba(235,245,249,.78);border-radius:12px;background:linear-gradient(90deg,transparent 49.65%,rgba(241,248,250,.5) 49.65% 50.35%,transparent 50.35%),linear-gradient(0deg,transparent 49.75%,rgba(241,248,250,.5) 49.75% 50.25%,transparent 50.25%),repeating-linear-gradient(0deg,#173f32 0 9%,#194637 9% 18%);box-shadow:0 22px 45px rgba(0,0,0,.35)}
    .bot-tactical-pitch:before{content:'';position:absolute;left:50%;top:50%;width:22%;aspect-ratio:1;border:1px solid rgba(241,248,250,.55);border-radius:50%;transform:translate(-50%,-50%)}
    .bot-box{position:absolute;left:24%;right:24%;height:15%;border:1px solid rgba(241,248,250,.55);pointer-events:none}.bot-box.top{top:-1px}.bot-box.bottom{bottom:-1px}
    .bot-participant{position:absolute;width:34px;height:34px;border-radius:50%;transform:translate(-50%,-50%);display:grid;place-items:center;border:3px solid rgba(255,255,255,.88);box-shadow:0 5px 14px rgba(0,0,0,.4);transition:left 90ms linear,top 90ms linear;font-size:10px;font-weight:800}.bot-participant[data-team='home']{background:#e3b341;color:#15202a}.bot-participant[data-team='away']{background:#4e9fe8;color:#08121c}.bot-participant[data-goalkeeper='true']{border-radius:8px}.bot-possession{outline:3px solid #fff1a9;outline-offset:3px}
    .bot-role-label{position:absolute;left:50%;top:-24px;transform:translateX(-50%);white-space:nowrap;padding:3px 6px;border-radius:5px;background:rgba(4,9,14,.9);color:#edf6f7;font-size:10px;font-weight:700;display:none;pointer-events:none}.bot-tactical-lab[data-role-overlay='true'] .bot-role-label{display:block}
    .bot-ball{position:absolute;width:14px;height:14px;border-radius:50%;transform:translate(-50%,-50%);background:#f8f6ef;border:2px solid #18212a;box-shadow:0 2px 7px rgba(0,0,0,.45);transition:left 70ms linear,top 70ms linear;z-index:4}
    .bot-tactical-panel{border-left:1px solid rgba(255,255,255,.1);background:rgba(8,15,23,.94);padding:18px 16px;display:flex;flex-direction:column;gap:14px;overflow:auto}.bot-tactical-panel h2{margin:0;font-size:22px}.bot-tactical-panel p{margin:0;color:#aebdca;font-size:12px;line-height:1.45}.bot-stat-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px}.bot-stat{padding:9px;border-radius:8px;background:#111d28}.bot-stat strong{display:block;font-size:18px}.bot-stat span{font-size:10px;color:#8ea0ae;text-transform:uppercase}.bot-control-row{display:grid;gap:7px}.bot-control-row button{border:1px solid rgba(255,255,255,.16);background:#162635;color:#f1f7fa;border-radius:8px;padding:9px 10px;cursor:pointer;font:inherit;font-weight:700}.bot-event{padding:10px;border-radius:8px;background:#0d1721;color:#d3e0e8;font-size:11px;min-height:34px}
    @media(max-width:760px){.bot-tactical-lab{grid-template-columns:1fr;grid-template-rows:minmax(0,1fr) auto}.bot-tactical-panel{border-left:0;border-top:1px solid rgba(255,255,255,.1);max-height:220px}.bot-tactical-pitch{width:min(52vh,82vw)}}
  `;
  return style;
}

function install(): void {
  const modeSwitch = document.querySelector<HTMLElement>('.mode-switch');
  if (!modeSwitch) return;

  const viewport = mustQuery<HTMLElement>(document, '#game-viewport');
  const practiceButton = mustQuery<HTMLButtonElement>(document, '[data-mode-practice]');
  const ballLabButton = mustQuery<HTMLButtonElement>(document, '[data-mode-ball-lab]');
  const gameCanvas = mustQuery<HTMLElement>(document, '[data-game-viewport]');
  document.head.append(createStyles());

  const tacticalButton = document.createElement('button');
  tacticalButton.type = 'button';
  tacticalButton.dataset.modeTacticalBots = 'true';
  tacticalButton.dataset.active = 'false';
  tacticalButton.textContent = 'Tactical Bot Lab';
  modeSwitch.append(tacticalButton);

  const lab = document.createElement('section');
  lab.className = 'bot-tactical-lab';
  lab.dataset.botTacticalLab = 'true';
  lab.dataset.roleOverlay = 'false';
  lab.hidden = true;
  lab.innerHTML = `
    <div class="bot-tactical-pitch-wrap"><div class="bot-tactical-pitch" data-bot-pitch><i class="bot-box top"></i><i class="bot-box bottom"></i><div class="bot-ball" data-bot-ball></div></div></div>
    <aside class="bot-tactical-panel">
      <div><p>Stage 06 · deterministic 3v3</p><h2>Tactical Bot Lab</h2></div>
      <p>Watch support, pressure, recovery and goalkeeper shape first. Role labels are hidden until requested.</p>
      <div class="bot-stat-grid"><div class="bot-stat"><strong data-stat-possession>HOME</strong><span>possession</span></div><div class="bot-stat"><strong data-stat-phase>ATTACK</strong><span>home phase</span></div><div class="bot-stat"><strong data-stat-passes>0</strong><span>passes</span></div><div class="bot-stat"><strong data-stat-cluster>clear</strong><span>spacing</span></div></div>
      <div class="bot-control-row"><button type="button" data-bot-turnover>Force Turnover</button><button type="button" data-bot-roles>Show Roles</button><button type="button" data-bot-reset>Reset Simulation</button></div>
      <div class="bot-event" data-bot-event>simulation-ready</div>
      <p>Same Stage 06 runtime used by the headless tournament. Both teams use the same movement envelope.</p>
    </aside>
    <output data-bot-state data-tactical-tick="0" data-possession-team="home" data-pass-attempts="0" data-completed-passes="0" data-last-event="simulation-ready" data-permanent-swarm="false" data-max-keeper-depth="1.5" hidden></output>
  `;
  viewport.append(lab);

  const pitch = mustQuery<HTMLElement>(lab, '[data-bot-pitch]');
  const ballView = mustQuery<HTMLElement>(lab, '[data-bot-ball]');
  const probe = mustQuery<HTMLOutputElement>(lab, '[data-bot-state]');
  const possessionStat = mustQuery<HTMLElement>(lab, '[data-stat-possession]');
  const phaseStat = mustQuery<HTMLElement>(lab, '[data-stat-phase]');
  const passesStat = mustQuery<HTMLElement>(lab, '[data-stat-passes]');
  const clusterStat = mustQuery<HTMLElement>(lab, '[data-stat-cluster]');
  const eventView = mustQuery<HTMLElement>(lab, '[data-bot-event]');
  const turnoverButton = mustQuery<HTMLButtonElement>(lab, '[data-bot-turnover]');
  const rolesButton = mustQuery<HTMLButtonElement>(lab, '[data-bot-roles]');
  const resetButton = mustQuery<HTMLButtonElement>(lab, '[data-bot-reset]');

  const participants = new Map<string, ParticipantView>();
  for (const player of createWorld().players) {
    const marker = document.createElement('div');
    marker.className = 'bot-participant';
    marker.dataset.botParticipant = player.id;
    marker.dataset.team = player.team;
    marker.dataset.goalkeeper = String(player.goalkeeper);
    marker.textContent = player.goalkeeper ? 'GK' : player.id.split('-')[1] ?? player.id;
    const label = document.createElement('span');
    label.className = 'bot-role-label';
    label.dataset.botRoleLabel = player.id;
    label.textContent = 'unassigned';
    marker.append(label);
    pitch.append(marker);
    participants.set(player.id, { marker, label });
  }

  const hiddenDuringLab = Array.from(document.querySelectorAll<HTMLElement>('.control-card,.action-feedback,.course-card'));
  let active = false;
  let world = createWorld();
  let homeRuntime = createTeamBotRuntime();
  let awayRuntime = createTeamBotRuntime();
  let pendingPass: PendingPass | null = null;
  let accumulator = 0;
  let lastFrame = performance.now();
  let passAttempts = 0;
  let completedPasses = 0;
  let lastEvent = 'simulation-ready';
  let swarmTicks = 0;
  let permanentSwarm = false;
  let maxKeeperDepth = 0;

  const toPercent = (x: number, z: number) => ({
    left: (x + world.field.halfWidth) / (world.field.halfWidth * 2) * 100,
    top: 100 - (z + world.field.halfLength) / (world.field.halfLength * 2) * 100,
  });

  function setEvent(value: string): void {
    lastEvent = value;
    eventView.textContent = value;
  }

  function transfer(playerId: string, event: string): void {
    const player = findPlayer(world, playerId);
    world.possessionTeam = player.team;
    world.possessionPlayerId = player.id;
    world.ball.position = { x: player.position.x, y: 0.11, z: player.position.z };
    world.ball.velocity = { x: 0, y: 0, z: 0 };
    pendingPass = null;
    setEvent(event);
  }

  function forceTurnover(): void {
    const nextTeam: TeamId = world.possessionTeam === 'home' ? 'away' : 'home';
    const receiver = nearestFieldPlayer(world, nextTeam);
    if (!receiver) return;
    const previous = world.possessionTeam ?? 'loose';
    transfer(receiver.id, `turnover:${previous}->${nextTeam}`);
  }

  function startPass(intent: Readonly<TeamBotIntent>): void {
    if (!intent.targetPlayerId || pendingPass) return;
    const from = findPlayer(world, intent.playerId);
    const to = findPlayer(world, intent.targetPlayerId);
    const lane = evaluatePassLane(world, from.id, to.id);
    if (lane.openness < 0.08) {
      setEvent(`pass-blocked:${from.id}`);
      return;
    }
    const distance = horizontalDistance(from.position, lane.target);
    pendingPass = {
      fromId: from.id,
      toId: to.id,
      elapsed: 0,
      duration: Math.max(0.28, Math.min(0.62, distance / 14)),
      startX: world.ball.position.x,
      startZ: world.ball.position.z,
      targetX: lane.target.x,
      targetZ: lane.target.z,
    };
    passAttempts += 1;
    setEvent(`pass:${from.id}->${to.id}`);
  }

  function advancePass(): void {
    const pass = pendingPass;
    if (!pass) return;
    pass.elapsed += DT;
    const t = Math.min(1, pass.elapsed / pass.duration);
    world.ball.position.x = pass.startX + (pass.targetX - pass.startX) * t;
    world.ball.position.z = pass.startZ + (pass.targetZ - pass.startZ) * t;
    if (t >= 1) {
      completedPasses += 1;
      transfer(pass.toId, `pass-complete:${pass.toId}`);
    }
  }

  function processAction(intents: readonly TeamBotIntent[]): void {
    if (pendingPass || !world.possessionPlayerId) return;
    const intent = intents.find((candidate) => candidate.playerId === world.possessionPlayerId);
    if (!intent) return;
    if (intent.action === 'pass' || intent.action === 'distribute') {
      startPass(intent);
    } else if (intent.action === 'shoot') {
      const nextTeam: TeamId = world.possessionTeam === 'home' ? 'away' : 'home';
      const keeper = world.players.find((player) => player.team === nextTeam && player.goalkeeper);
      if (keeper) transfer(keeper.id, `shot:${nextTeam}-keeper`);
    } else if (intent.action === 'clear') {
      forceTurnover();
    }
  }

  function updateMetrics(): void {
    let clustered = false;
    for (const team of ['home', 'away'] as const) {
      const field = world.players.filter((player) => player.team === team && !player.goalkeeper);
      if (field.length >= 2 && horizontalDistance(field[0]!.position, field[1]!.position) < SWARM_DISTANCE) clustered = true;
      const keeper = world.players.find((player) => player.team === team && player.goalkeeper);
      if (keeper) maxKeeperDepth = Math.max(maxKeeperDepth, Math.abs(keeper.position.z - ownGoalZ(world, team)));
    }
    swarmTicks = clustered ? swarmTicks + 1 : 0;
    if (swarmTicks >= SWARM_LIMIT_TICKS) permanentSwarm = true;
    clusterStat.textContent = clustered ? 'tight' : 'clear';
  }

  function fixedStep(): void {
    const home = stepTeamBotRuntime(world, 'home', homeRuntime);
    const away = stepTeamBotRuntime(world, 'away', awayRuntime);
    homeRuntime = home.state;
    awayRuntime = away.state;
    processAction(world.possessionTeam === 'home' ? home.intents : away.intents);
    applyIntents(world, home.intents);
    applyIntents(world, away.intents);
    if (pendingPass) advancePass();
    else if (world.possessionPlayerId) {
      const carrier = findPlayer(world, world.possessionPlayerId);
      world.ball.position = { x: carrier.position.x, y: 0.11, z: carrier.position.z };
    }
    world.timeSeconds += DT;
    world.tick += 1;
    updateMetrics();
  }

  function render(): void {
    for (const player of world.players) {
      const view = participants.get(player.id);
      if (!view) continue;
      const point = toPercent(player.position.x, player.position.z);
      view.marker.style.left = `${point.left}%`;
      view.marker.style.top = `${point.top}%`;
      view.marker.classList.toggle('bot-possession', player.id === world.possessionPlayerId);
      view.label.textContent = roleForPlayer(player.id, homeRuntime, awayRuntime) ?? 'unassigned';
    }
    const ball = toPercent(world.ball.position.x, world.ball.position.z);
    ballView.style.left = `${ball.left}%`;
    ballView.style.top = `${ball.top}%`;
    possessionStat.textContent = (world.possessionTeam ?? 'loose').toUpperCase();
    phaseStat.textContent = homeRuntime.roles.phase.toUpperCase();
    passesStat.textContent = `${completedPasses}/${passAttempts}`;
    probe.dataset.tacticalTick = String(world.tick);
    probe.dataset.possessionTeam = world.possessionTeam ?? 'loose';
    probe.dataset.passAttempts = String(passAttempts);
    probe.dataset.completedPasses = String(completedPasses);
    probe.dataset.lastEvent = lastEvent;
    probe.dataset.permanentSwarm = String(permanentSwarm);
    probe.dataset.maxKeeperDepth = maxKeeperDepth.toFixed(6);
  }

  function reset(): void {
    world = createWorld();
    homeRuntime = createTeamBotRuntime();
    awayRuntime = createTeamBotRuntime();
    pendingPass = null;
    accumulator = 0;
    passAttempts = 0;
    completedPasses = 0;
    swarmTicks = 0;
    permanentSwarm = false;
    maxKeeperDepth = 0;
    setEvent('simulation-reset');
    render();
  }

  function deactivate(): void {
    active = false;
    lab.hidden = true;
    tacticalButton.dataset.active = 'false';
    gameCanvas.hidden = false;
    for (const element of hiddenDuringLab) element.hidden = false;
  }

  function activate(): void {
    active = true;
    practiceButton.dataset.active = 'false';
    ballLabButton.dataset.active = 'false';
    tacticalButton.dataset.active = 'true';
    if (document.pointerLockElement) document.exitPointerLock();
    const practice = document.querySelector<HTMLElement>('[data-football-practice]');
    const ballLab = document.querySelector<HTMLElement>('[data-ball-lab]');
    if (practice) practice.hidden = true;
    if (ballLab) ballLab.hidden = true;
    gameCanvas.hidden = true;
    for (const element of hiddenDuringLab) element.hidden = true;
    lab.hidden = false;
    lastFrame = performance.now();
    render();
  }

  tacticalButton.addEventListener('click', activate);
  practiceButton.addEventListener('click', deactivate);
  ballLabButton.addEventListener('click', deactivate);
  turnoverButton.addEventListener('click', forceTurnover);
  resetButton.addEventListener('click', reset);
  rolesButton.addEventListener('click', () => {
    const visible = lab.dataset.roleOverlay === 'true';
    lab.dataset.roleOverlay = String(!visible);
    rolesButton.textContent = visible ? 'Show Roles' : 'Hide Roles';
  });

  function frame(now: number): void {
    if (active) {
      accumulator += Math.min(0.25, Math.max(0, (now - lastFrame) / 1000));
      let steps = 0;
      while (accumulator + 1e-9 >= DT && steps < 3) {
        fixedStep();
        accumulator -= DT;
        steps += 1;
      }
      render();
    }
    lastFrame = now;
    requestAnimationFrame(frame);
  }

  reset();
  requestAnimationFrame(frame);
}

if (document.readyState === 'loading') window.addEventListener('DOMContentLoaded', install, { once: true });
else install();
