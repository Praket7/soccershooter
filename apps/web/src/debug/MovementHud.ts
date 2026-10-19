export interface MovementHudSample {
  simTick: number;
  renderFps: number;
  speed: number;
  acceleration: number;
  stamina: number;
  locomotion: string;
  positionX: number;
  positionZ: number;
  facingYaw: number;
  cameraArm: number;
  cameraCollision: string | null;
  cameraCorrectionPerSecond: number;
  inputToSimulationMs: number | null;
  inputToRenderMs: number | null;
  traceStatus: string;
  fixedStepBacklogMs: number;
}

function format(value: number, digits = 2): string {
  return Number.isFinite(value) ? value.toFixed(digits) : '—';
}

export class MovementHud {
  readonly element: HTMLDivElement;
  #visible = false;

  constructor(parent: HTMLElement = document.body) {
    const element = document.createElement('div');
    element.dataset.movementHud = 'true';
    element.setAttribute('aria-live', 'off');
    Object.assign(element.style, {
      position: 'fixed',
      top: '16px',
      left: '16px',
      minWidth: '250px',
      padding: '12px 14px',
      border: '1px solid rgba(255,255,255,.18)',
      borderRadius: '10px',
      background: 'rgba(6, 10, 16, .78)',
      color: '#eef3f8',
      font: '12px/1.45 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
      pointerEvents: 'none',
      whiteSpace: 'pre',
      zIndex: '20',
      backdropFilter: 'blur(8px)',
      display: 'none',
    });
    parent.append(element);
    this.element = element;
  }

  update(sample: Readonly<MovementHudSample>): void {
    const inputToSim = sample.inputToSimulationMs === null ? '—' : `${format(sample.inputToSimulationMs, 1)} ms`;
    const inputToRender = sample.inputToRenderMs === null ? '—' : `${format(sample.inputToRenderMs, 1)} ms`;
    this.element.textContent = [
      'STAGE 03 · MOVEMENT LAB',
      `tick       ${sample.simTick.toString().padStart(6, ' ')}    fps ${format(sample.renderFps, 0)}`,
      `speed      ${format(sample.speed)} m/s`,
      `accel      ${format(sample.acceleration)} m/s²`,
      `stamina    ${format(sample.stamina, 1)}%`,
      `state      ${sample.locomotion}`,
      `position   ${format(sample.positionX)}, ${format(sample.positionZ)}`,
      `facing     ${format(sample.facingYaw, 3)} rad`,
      `cam arm    ${format(sample.cameraArm)} m`,
      `cam hit    ${sample.cameraCollision ?? 'clear'}`,
      `cam corr   ${format(sample.cameraCorrectionPerSecond)} m/s`,
      `input→sim  ${inputToSim}`,
      `input→view ${inputToRender}`,
      `backlog    ${format(sample.fixedStepBacklogMs, 1)} ms`,
      `trace      ${sample.traceStatus}`,
      '',
      'F1 HUD · R record · P replay · X reset',
    ].join('\n');
  }

  toggle(): void {
    this.#visible = !this.#visible;
    this.element.style.display = this.#visible ? 'block' : 'none';
  }

  dispose(): void {
    this.element.remove();
  }
}
