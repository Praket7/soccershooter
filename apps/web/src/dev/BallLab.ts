import * as THREE from 'three';
import { BALL_CONSTANTS, cloneBallState, createBallState, type BallState } from '@soccershooter/physics/ball/BallState';
import { MATCH_BALL_PROFILE, type BallCoefficientProfile } from '@soccershooter/physics/ball/aerodynamics';
import {
  BALL_SUBSTEP_DT,
  BALL_SUBSTEP_HZ,
  STANDARD_GOAL_FRAME,
  crossedGoalPlane,
  predictTrajectory,
  stepBall,
  type TrajectorySample,
} from '@soccershooter/physics/ball/trajectory';

export type BallLabSpinAxis = 'none' | 'side' | 'top' | 'back';

export interface BallLabControls {
  speed: number;
  elevationDegrees: number;
  azimuthDegrees: number;
  spinRate: number;
  spinAxis: BallLabSpinAxis;
  profileId: string;
  slowMotion: number;
  trailEnabled: boolean;
  knuckleSeed: number;
}

interface BallLabPreset {
  id: string;
  label: string;
  description: string;
  controls: Partial<BallLabControls>;
}

interface BallLabOptions {
  scene: THREE.Scene;
  host: HTMLElement;
}

const DEFAULT_CONTROLS: BallLabControls = Object.freeze({
  speed: 24,
  elevationDegrees: 12,
  azimuthDegrees: 0,
  spinRate: 0,
  spinAxis: 'none',
  profileId: MATCH_BALL_PROFILE.id,
  slowMotion: 1,
  trailEnabled: true,
  knuckleSeed: 0,
});

export const BALL_LAB_PRESETS: readonly BallLabPreset[] = Object.freeze([
  { id: 'driven', label: 'Driven 10m', description: 'Low, fast service benchmark', controls: { speed: 14, elevationDegrees: 5, spinRate: 8, spinAxis: 'back', azimuthDegrees: 0, knuckleSeed: 0 } },
  { id: 'straight', label: 'Straight 20m', description: 'Stable zero-spin strike benchmark', controls: { speed: 24, elevationDegrees: 12, spinRate: 0, spinAxis: 'none', azimuthDegrees: 0, knuckleSeed: 0 } },
  { id: 'curl', label: 'Curl 20m', description: 'Sidespin benchmark that bends toward +X', controls: { speed: 24, elevationDegrees: 12, spinRate: 58, spinAxis: 'side', azimuthDegrees: 0, knuckleSeed: 0 } },
  { id: 'power', label: 'Power 25m', description: '29 m/s power-strike benchmark', controls: { speed: 29, elevationDegrees: 10, spinRate: 10, spinAxis: 'side', azimuthDegrees: 0, knuckleSeed: 0 } },
  { id: 'loft', label: 'Loft', description: 'Backspin carry and softer drop', controls: { speed: 19, elevationDegrees: 27, spinRate: 22, spinAxis: 'back', azimuthDegrees: 0, knuckleSeed: 0 } },
  { id: 'chip', label: 'Chip', description: 'High launch with strong backspin', controls: { speed: 15, elevationDegrees: 34, spinRate: 34, spinAxis: 'back', azimuthDegrees: 0, knuckleSeed: 0 } },
  { id: 'knuckle', label: 'Knuckle', description: 'Seeded low-spin wake instability', controls: { speed: 24, elevationDegrees: 10, spinRate: 0.4, spinAxis: 'side', azimuthDegrees: 0, knuckleSeed: 0x9a17b5 } },
  { id: 'post', label: 'Post rebound', description: 'Rigid-frame rebound benchmark', controls: { speed: 28, elevationDegrees: 4, spinRate: 8, spinAxis: 'side', azimuthDegrees: 10.1, knuckleSeed: 0 } },
]);

const PROFILES: Readonly<Record<string, BallCoefficientProfile>> = Object.freeze({
  [MATCH_BALL_PROFILE.id]: MATCH_BALL_PROFILE,
});

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function finite(value: number, fallback: number): number {
  return Number.isFinite(value) ? value : fallback;
}

function spinVector(axis: BallLabSpinAxis, rate: number): { x: number; y: number; z: number } {
  const bounded = clamp(Math.abs(rate), 0, 180);
  if (axis === 'side') return { x: 0, y: bounded, z: 0 };
  if (axis === 'top') return { x: bounded, y: 0, z: 0 };
  if (axis === 'back') return { x: -bounded, y: 0, z: 0 };
  return { x: 0, y: 0, z: 0 };
}

export function buildLaunchFromControls(input: BallLabControls): BallState {
  const speed = clamp(finite(input.speed, DEFAULT_CONTROLS.speed), 0, 45);
  const elevation = clamp(finite(input.elevationDegrees, DEFAULT_CONTROLS.elevationDegrees), -5, 55) * Math.PI / 180;
  const azimuth = clamp(finite(input.azimuthDegrees, DEFAULT_CONTROLS.azimuthDegrees), -25, 25) * Math.PI / 180;
  const horizontal = Math.cos(elevation) * speed;
  return createBallState({
    position: { x: 0, y: BALL_CONSTANTS.radius, z: -9 },
    velocity: {
      x: Math.sin(azimuth) * horizontal,
      y: Math.sin(elevation) * speed,
      z: Math.cos(azimuth) * horizontal,
    },
    angularVelocity: spinVector(input.spinAxis, finite(input.spinRate, 0)),
    knuckleSeed: Math.max(0, Math.trunc(finite(input.knuckleSeed, 0))) >>> 0,
  });
}

function formatCsvNumber(value: number): string {
  return Number.isFinite(value) ? value.toFixed(6) : '0.000000';
}

export function traceToCsv(samples: readonly TrajectorySample[]): string {
  const rows = ['time,x,y,z,vx,vy,vz,wx,wy,wz'];
  for (const sample of samples) {
    const { position, velocity, angularVelocity } = sample.state;
    rows.push([
      sample.time,
      position.x,
      position.y,
      position.z,
      velocity.x,
      velocity.y,
      velocity.z,
      angularVelocity.x,
      angularVelocity.y,
      angularVelocity.z,
    ].map(formatCsvNumber).join(','));
  }
  return rows.join('\n');
}

function createGoalFrame(scene: THREE.Scene): THREE.Group {
  const group = new THREE.Group();
  group.name = 'stage04-goal-frame';
  const material = new THREE.MeshStandardMaterial({ color: 0xf2f5f6, roughness: 0.42, metalness: 0.08 });
  const radius = STANDARD_GOAL_FRAME.postRadius;
  const postGeometry = new THREE.CylinderGeometry(radius, radius, STANDARD_GOAL_FRAME.height, 18);
  const left = new THREE.Mesh(postGeometry, material);
  left.position.set(-STANDARD_GOAL_FRAME.halfWidth, STANDARD_GOAL_FRAME.height / 2, STANDARD_GOAL_FRAME.planeZ);
  left.castShadow = true;
  const right = left.clone();
  right.position.x = STANDARD_GOAL_FRAME.halfWidth;
  const crossbar = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, STANDARD_GOAL_FRAME.halfWidth * 2, 18),
    material,
  );
  crossbar.rotation.z = Math.PI / 2;
  crossbar.position.set(0, STANDARD_GOAL_FRAME.height, STANDARD_GOAL_FRAME.planeZ);
  crossbar.castShadow = true;
  group.add(left, right, crossbar);

  const netMaterial = new THREE.LineBasicMaterial({ color: 0xb7c1c7, transparent: true, opacity: 0.22 });
  const netPoints: THREE.Vector3[] = [];
  for (let xIndex = 0; xIndex <= 8; xIndex += 1) {
    const x = -STANDARD_GOAL_FRAME.halfWidth + (STANDARD_GOAL_FRAME.halfWidth * 2 * xIndex) / 8;
    netPoints.push(
      new THREE.Vector3(x, 0, STANDARD_GOAL_FRAME.planeZ + 0.03),
      new THREE.Vector3(x, STANDARD_GOAL_FRAME.height, STANDARD_GOAL_FRAME.planeZ + 0.03),
    );
  }
  for (let yIndex = 0; yIndex <= 5; yIndex += 1) {
    const y = (STANDARD_GOAL_FRAME.height * yIndex) / 5;
    netPoints.push(
      new THREE.Vector3(-STANDARD_GOAL_FRAME.halfWidth, y, STANDARD_GOAL_FRAME.planeZ + 0.03),
      new THREE.Vector3(STANDARD_GOAL_FRAME.halfWidth, y, STANDARD_GOAL_FRAME.planeZ + 0.03),
    );
  }
  group.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(netPoints), netMaterial));
  scene.add(group);
  return group;
}

function createBallVisual(scene: THREE.Scene): THREE.Group {
  const group = new THREE.Group();
  group.name = 'stage04-ball';
  const shell = new THREE.Mesh(
    new THREE.SphereGeometry(BALL_CONSTANTS.radius, 28, 20),
    new THREE.MeshStandardMaterial({ color: 0xf2f0e9, roughness: 0.72, metalness: 0.01 }),
  );
  shell.castShadow = true;
  shell.receiveShadow = true;
  const panelLines = new THREE.Mesh(
    new THREE.IcosahedronGeometry(BALL_CONSTANTS.radius * 1.012, 2),
    new THREE.MeshBasicMaterial({ color: 0x1b2024, wireframe: true, transparent: true, opacity: 0.58 }),
  );
  group.add(shell, panelLines);
  scene.add(group);
  return group;
}

function createLine(scene: THREE.Scene, color: number, opacity: number): THREE.Line {
  const line = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]),
    new THREE.LineBasicMaterial({ color, transparent: true, opacity }),
  );
  scene.add(line);
  return line;
}

function setLinePoints(line: THREE.Line, samples: readonly TrajectorySample[], stride = 1): void {
  const points: THREE.Vector3[] = [];
  for (let index = 0; index < samples.length; index += Math.max(1, stride)) {
    const sample = samples[index];
    if (sample) points.push(new THREE.Vector3(sample.state.position.x, sample.state.position.y, sample.state.position.z));
  }
  const final = samples[samples.length - 1];
  if (final) {
    const finalPoint = new THREE.Vector3(final.state.position.x, final.state.position.y, final.state.position.z);
    const lastPoint = points[points.length - 1];
    if (!lastPoint || lastPoint.distanceToSquared(finalPoint) > 1e-10) points.push(finalPoint);
  }
  line.geometry.dispose();
  line.geometry = new THREE.BufferGeometry().setFromPoints(
    points.length >= 2 ? points : [new THREE.Vector3(), new THREE.Vector3()],
  );
}

function requireChild<T extends HTMLElement>(root: ParentNode, selector: string): T {
  const element = root.querySelector<T>(selector);
  if (!element) throw new Error(`Ball Lab missing element ${selector}`);
  return element;
}

export class BallLab {
  readonly root: HTMLElement;
  readonly goalVisual: THREE.Group;
  readonly ballVisual: THREE.Group;

  #controls: BallLabControls = { ...DEFAULT_CONTROLS };
  #profile: BallCoefficientProfile = MATCH_BALL_PROFILE;
  #state: BallState = buildLaunchFromControls(this.#controls);
  #previousState: BallState = cloneBallState(this.#state);
  #actualSamples: TrajectorySample[] = [{ time: 0, state: cloneBallState(this.#state) }];
  #accumulator = 0;
  #playing = false;
  #goalScored = false;
  #presetId = 'straight';
  #actualTrail: THREE.Line;
  #predictionTrail: THREE.Line;
  #landingMarker: THREE.Mesh;
  #metrics: HTMLElement;
  #probe: HTMLOutputElement;
  #speedInput: HTMLInputElement;
  #elevationInput: HTMLInputElement;
  #azimuthInput: HTMLInputElement;
  #spinInput: HTMLInputElement;
  #spinAxisInput: HTMLSelectElement;
  #profileInput: HTMLSelectElement;
  #slowMotionInput: HTMLSelectElement;
  #trailInput: HTMLInputElement;
  #seedInput: HTMLInputElement;

  constructor(options: BallLabOptions) {
    this.goalVisual = createGoalFrame(options.scene);
    this.ballVisual = createBallVisual(options.scene);
    this.#actualTrail = createLine(options.scene, 0xd9f35b, 0.92);
    this.#predictionTrail = createLine(options.scene, 0x79c8ff, 0.34);
    this.#landingMarker = new THREE.Mesh(
      new THREE.RingGeometry(0.22, 0.31, 28),
      new THREE.MeshBasicMaterial({ color: 0x79c8ff, transparent: true, opacity: 0.75, side: THREE.DoubleSide }),
    );
    this.#landingMarker.rotation.x = -Math.PI / 2;
    this.#landingMarker.position.y = 0.008;
    options.scene.add(this.#landingMarker);

    this.root = document.createElement('section');
    this.root.className = 'ball-lab-panel';
    this.root.dataset.ballLab = 'true';
    this.root.dataset.preset = this.#presetId;
    this.root.dataset.flightSeconds = '0';
    this.root.dataset.ballX = '0';
    this.root.dataset.ballZ = '-9';
    this.root.dataset.goal = 'false';
    this.root.innerHTML = `
      <div class="ball-lab-heading">
        <div><span>Stage 04 instrument</span><strong>Ball Lab</strong></div>
        <span class="ball-lab-live"><i></i> ${BALL_SUBSTEP_HZ} Hz</span>
      </div>
      <div class="ball-lab-presets" role="group" aria-label="Ball physics presets">
        ${BALL_LAB_PRESETS.map((preset, index) => `<button type="button" data-ball-preset="${preset.id}" title="${preset.description}"><kbd>${index + 1}</kbd>${preset.label}</button>`).join('')}
      </div>
      <div class="ball-lab-grid">
        <label>Launch speed <output data-speed-value>${this.#controls.speed.toFixed(1)} m/s</output><input aria-label="Launch speed" data-ball-speed type="range" min="4" max="40" step="0.5" value="${this.#controls.speed}"></label>
        <label>Elevation <output data-elevation-value>${this.#controls.elevationDegrees.toFixed(0)}°</output><input aria-label="Elevation" data-ball-elevation type="range" min="0" max="45" step="1" value="${this.#controls.elevationDegrees}"></label>
        <label>Aim offset <output data-azimuth-value>${this.#controls.azimuthDegrees.toFixed(1)}°</output><input aria-label="Aim offset" data-ball-azimuth type="range" min="-15" max="15" step="0.5" value="${this.#controls.azimuthDegrees}"></label>
        <label>Spin rate <output data-spin-value>${this.#controls.spinRate.toFixed(0)} rad/s</output><input aria-label="Spin rate" data-ball-spin type="range" min="0" max="120" step="1" value="${this.#controls.spinRate}"></label>
        <label>Spin axis<select aria-label="Spin axis" data-ball-spin-axis><option value="none">None</option><option value="side">Sidespin</option><option value="top">Topspin</option><option value="back">Backspin</option></select></label>
        <label>Coefficient profile<select aria-label="Coefficient profile" data-ball-profile><option value="${MATCH_BALL_PROFILE.id}">Match balanced v1</option></select></label>
        <label>Slow motion<select aria-label="Slow motion" data-ball-slow><option value="1">1× realtime</option><option value="0.5">0.5×</option><option value="0.25">0.25×</option></select></label>
        <label class="seed-field">Knuckle seed<input aria-label="Knuckle seed" data-ball-seed type="number" min="0" max="4294967295" step="1" value="0"></label>
        <label class="trail-toggle"><input aria-label="Trajectory and predictor" data-ball-trail type="checkbox" checked> Trajectory + predictor</label>
      </div>
      <div class="ball-lab-actions">
        <button aria-label="Launch" class="primary" type="button" data-ball-launch><span>Launch</span><kbd>L</kbd></button>
        <button aria-label="Reset Ball" type="button" data-ball-reset>Reset Ball <kbd>0</kbd></button>
        <button aria-label="Export CSV" type="button" data-ball-export>CSV <kbd>E</kbd></button>
      </div>
      <div class="ball-lab-metrics" data-ball-metrics aria-live="polite"></div>
      <p class="ball-lab-note">The ball stays physically independent. Stage 05 adds player contact, passing, and shooting mechanics.</p>
      <output data-ball-state data-ball-tick-hz="${BALL_SUBSTEP_HZ}" data-active="false" data-x="0" data-y="${BALL_CONSTANTS.radius}" data-z="-9" data-predicted-x="0" data-predicted-z="0" hidden></output>
    `;
    options.host.append(this.root);

    this.#metrics = requireChild(this.root, '[data-ball-metrics]');
    this.#probe = requireChild(this.root, '[data-ball-state]');
    this.#speedInput = requireChild(this.root, '[data-ball-speed]');
    this.#elevationInput = requireChild(this.root, '[data-ball-elevation]');
    this.#azimuthInput = requireChild(this.root, '[data-ball-azimuth]');
    this.#spinInput = requireChild(this.root, '[data-ball-spin]');
    this.#spinAxisInput = requireChild(this.root, '[data-ball-spin-axis]');
    this.#profileInput = requireChild(this.root, '[data-ball-profile]');
    this.#slowMotionInput = requireChild(this.root, '[data-ball-slow]');
    this.#trailInput = requireChild(this.root, '[data-ball-trail]');
    this.#seedInput = requireChild(this.root, '[data-ball-seed]');

    const onControlChange = () => {
      this.#readControls();
      this.#updateControlOutputs();
      this.#refreshPrediction();
    };
    for (const input of [this.#speedInput, this.#elevationInput, this.#azimuthInput, this.#spinInput, this.#seedInput]) {
      input.addEventListener('input', onControlChange);
    }
    for (const input of [this.#spinAxisInput, this.#profileInput, this.#slowMotionInput, this.#trailInput]) {
      input.addEventListener('change', onControlChange);
    }

    requireChild<HTMLButtonElement>(this.root, '[data-ball-launch]').addEventListener('click', () => this.launch());
    requireChild<HTMLButtonElement>(this.root, '[data-ball-reset]').addEventListener('click', () => this.reset());
    requireChild<HTMLButtonElement>(this.root, '[data-ball-export]').addEventListener('click', () => this.exportCsv());
    for (const button of this.root.querySelectorAll<HTMLButtonElement>('[data-ball-preset]')) {
      button.addEventListener('click', () => this.applyPreset(button.dataset.ballPreset ?? 'straight'));
    }
    window.addEventListener('keydown', (event) => this.#onKeyDown(event));

    this.applyPreset('straight');
  }

  get controls(): Readonly<BallLabControls> {
    return this.#controls;
  }

  get state(): Readonly<BallState> {
    return this.#state;
  }

  launch(): void {
    this.#readControls();
    this.#state = buildLaunchFromControls(this.#controls);
    this.#previousState = cloneBallState(this.#state);
    this.#actualSamples = [{ time: 0, state: cloneBallState(this.#state) }];
    this.#accumulator = 0;
    this.#goalScored = false;
    this.#playing = true;
    this.root.dataset.goal = 'false';
    this.root.classList.add('is-playing');
    this.#refreshPrediction();
    this.#syncVisuals();
  }

  reset(): void {
    this.#state = buildLaunchFromControls(this.#controls);
    this.#previousState = cloneBallState(this.#state);
    this.#actualSamples = [{ time: 0, state: cloneBallState(this.#state) }];
    this.#accumulator = 0;
    this.#goalScored = false;
    this.#playing = false;
    this.root.dataset.goal = 'false';
    this.root.classList.remove('is-playing');
    setLinePoints(this.#actualTrail, this.#actualSamples);
    this.#syncVisuals();
    this.#refreshPrediction();
  }

  applyPreset(id: string): void {
    const preset = BALL_LAB_PRESETS.find((candidate) => candidate.id === id) ?? BALL_LAB_PRESETS[1]!;
    this.#presetId = preset.id;
    this.#controls = { ...this.#controls, ...preset.controls };
    this.root.dataset.preset = preset.id;
    this.#writeControls();
    for (const button of this.root.querySelectorAll<HTMLButtonElement>('[data-ball-preset]')) {
      button.dataset.active = String(button.dataset.ballPreset === preset.id);
    }
    this.reset();
  }

  update(realDeltaSeconds: number): void {
    if (this.#playing) {
      this.#accumulator += clamp(realDeltaSeconds, 0, 0.1) * this.#controls.slowMotion;
      let steps = 0;
      while (this.#accumulator + 1e-12 >= BALL_SUBSTEP_DT && steps < 24) {
        this.#previousState = cloneBallState(this.#state);
        this.#state = stepBall(this.#state, BALL_SUBSTEP_DT, this.#profile, STANDARD_GOAL_FRAME);
        if (!this.#goalScored && crossedGoalPlane(this.#previousState, this.#state, STANDARD_GOAL_FRAME)) {
          this.#goalScored = true;
          this.root.dataset.goal = 'true';
        }
        this.#actualSamples.push({ time: this.#state.flightSeconds, state: cloneBallState(this.#state) });
        this.#accumulator -= BALL_SUBSTEP_DT;
        steps += 1;
      }
      const speed = Math.hypot(this.#state.velocity.x, this.#state.velocity.y, this.#state.velocity.z);
      if (this.#state.flightSeconds >= 8 || (this.#state.grounded && speed < 0.12 && this.#state.flightSeconds > 0.35)) {
        this.#playing = false;
        this.root.classList.remove('is-playing');
      }
      if (this.#controls.trailEnabled && this.#actualSamples.length % 2 === 0) {
        setLinePoints(this.#actualTrail, this.#actualSamples, 2);
      }
    }
    this.#syncVisuals();
  }

  exportCsv(): void {
    const csv = traceToCsv(this.#actualSamples);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `soccershooter-ball-${this.#presetId}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  #readControls(): void {
    this.#controls = {
      speed: Number(this.#speedInput.value),
      elevationDegrees: Number(this.#elevationInput.value),
      azimuthDegrees: Number(this.#azimuthInput.value),
      spinRate: Number(this.#spinInput.value),
      spinAxis: this.#spinAxisInput.value as BallLabSpinAxis,
      profileId: this.#profileInput.value,
      slowMotion: Number(this.#slowMotionInput.value),
      trailEnabled: this.#trailInput.checked,
      knuckleSeed: Number(this.#seedInput.value),
    };
    this.#profile = PROFILES[this.#controls.profileId] ?? MATCH_BALL_PROFILE;
    this.#actualTrail.visible = this.#controls.trailEnabled;
    this.#predictionTrail.visible = this.#controls.trailEnabled;
    this.#landingMarker.visible = this.#controls.trailEnabled;
  }

  #writeControls(): void {
    this.#speedInput.value = String(this.#controls.speed);
    this.#elevationInput.value = String(this.#controls.elevationDegrees);
    this.#azimuthInput.value = String(this.#controls.azimuthDegrees);
    this.#spinInput.value = String(this.#controls.spinRate);
    this.#spinAxisInput.value = this.#controls.spinAxis;
    this.#profileInput.value = this.#controls.profileId;
    this.#slowMotionInput.value = String(this.#controls.slowMotion);
    this.#trailInput.checked = this.#controls.trailEnabled;
    this.#seedInput.value = String(this.#controls.knuckleSeed >>> 0);
    this.#readControls();
    this.#updateControlOutputs();
  }

  #updateControlOutputs(): void {
    requireChild<HTMLOutputElement>(this.root, '[data-speed-value]').value = `${this.#controls.speed.toFixed(1)} m/s`;
    requireChild<HTMLOutputElement>(this.root, '[data-elevation-value]').value = `${this.#controls.elevationDegrees.toFixed(0)}°`;
    requireChild<HTMLOutputElement>(this.root, '[data-azimuth-value]').value = `${this.#controls.azimuthDegrees.toFixed(1)}°`;
    requireChild<HTMLOutputElement>(this.root, '[data-spin-value]').value = `${this.#controls.spinRate.toFixed(0)} rad/s`;
  }

  #refreshPrediction(): void {
    const launch = buildLaunchFromControls(this.#controls);
    const prediction = predictTrajectory(launch, { profile: this.#profile, goalFrame: STANDARD_GOAL_FRAME, maxSeconds: 8 });
    setLinePoints(this.#predictionTrail, prediction.samples, 3);
    this.#landingMarker.position.set(prediction.landing.position.x, 0.012, prediction.landing.position.z);
    this.#probe.dataset.predictedX = prediction.landing.position.x.toFixed(6);
    this.#probe.dataset.predictedZ = prediction.landing.position.z.toFixed(6);
    this.#metrics.innerHTML = `
      <span><b>${Math.round(this.#controls.speed * 3.6)}</b> km/h</span>
      <span><b>${Math.round(this.#controls.spinRate * 60 / (Math.PI * 2))}</b> rpm</span>
      <span><b>${prediction.apex.y.toFixed(2)}</b> m apex</span>
      <span><b>${prediction.landing.time.toFixed(2)}</b> s landing</span>
    `;
  }

  #syncVisuals(): void {
    this.ballVisual.position.set(this.#state.position.x, this.#state.position.y, this.#state.position.z);
    const angularSpeed = Math.hypot(this.#state.angularVelocity.x, this.#state.angularVelocity.y, this.#state.angularVelocity.z);
    if (angularSpeed > 1e-6) {
      const axis = new THREE.Vector3(
        this.#state.angularVelocity.x,
        this.#state.angularVelocity.y,
        this.#state.angularVelocity.z,
      ).normalize();
      this.ballVisual.rotateOnWorldAxis(axis, Math.min(0.18, angularSpeed * BALL_SUBSTEP_DT));
    }
    this.root.dataset.flightSeconds = this.#state.flightSeconds.toFixed(3);
    this.root.dataset.ballX = this.#state.position.x.toFixed(4);
    this.root.dataset.ballZ = this.#state.position.z.toFixed(4);
    this.root.dataset.playing = String(this.#playing);
    this.#probe.dataset.active = String(this.#playing);
    this.#probe.dataset.x = this.#state.position.x.toFixed(6);
    this.#probe.dataset.y = this.#state.position.y.toFixed(6);
    this.#probe.dataset.z = this.#state.position.z.toFixed(6);
  }

  #onKeyDown(event: KeyboardEvent): void {
    const target = event.target as HTMLElement | null;
    if (target?.matches('input, select, button, textarea')) return;
    if (event.code === 'KeyL') {
      event.preventDefault();
      this.launch();
      return;
    }
    if (event.code === 'Digit0') {
      this.reset();
      return;
    }
    if (event.code === 'KeyE') {
      this.exportCsv();
      return;
    }
    const digit = Number(event.key);
    if (Number.isInteger(digit) && digit >= 1 && digit <= BALL_LAB_PRESETS.length) {
      const preset = BALL_LAB_PRESETS[digit - 1];
      if (preset) this.applyPreset(preset.id);
    }
  }
}
