type MovementDirection = 'forward' | 'left' | 'back' | 'right';

interface PositionSample {
  x: number;
  z: number;
}

interface MovementSample extends PositionSample {
  distance: number;
  velocityX: number;
  velocityZ: number;
}

const SEGMENT_MS = 650;

const DIRECTION_KEYS: Record<MovementDirection, readonly string[]> = {
  forward: ['KeyW'],
  left: ['KeyA'],
  back: ['KeyS'],
  right: ['KeyD'],
};

function position(probe: HTMLElement): PositionSample {
  return { x: Number(probe.dataset.x ?? 0), z: Number(probe.dataset.z ?? 0) };
}

function distance(from: PositionSample, to: PositionSample): number {
  return Math.hypot(to.x - from.x, to.z - from.z);
}

function keyEvent(type: 'keydown' | 'keyup', code: string): void {
  const key = code === 'Space' ? ' ' : code.replace(/^Key/, '').toLowerCase();
  document.body.dispatchEvent(new KeyboardEvent(type, { code, key, bubbles: true, cancelable: true }));
}

function wait(milliseconds: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, milliseconds));
}

export function installMovementCheckPanel(host: HTMLElement, playerProbe: HTMLElement): void {
  if (host.querySelector('[data-movement-check-panel]')) return;

  const panel = document.createElement('details');
  panel.className = 'movement-check-panel';
  panel.dataset.movementCheckPanel = 'true';
  panel.innerHTML = `
    <summary>Movement check</summary>
    <p>Drive the live player through a jog, sprint, cut, reversal, and stop.</p>
    <button type="button" data-movement-check-run>Run movement check</button>
    <output data-movement-check-result data-status="idle" aria-live="polite">Ready</output>
  `;
  host.append(panel);

  const button = panel.querySelector<HTMLButtonElement>('[data-movement-check-run]')!;
  const result = panel.querySelector<HTMLOutputElement>('[data-movement-check-result]')!;

  button.addEventListener('click', () => {
    if (result.dataset.status === 'running') return;
    button.disabled = true;
    result.dataset.status = 'running';
    result.dataset.results = '';
    result.textContent = 'Running movement check…';

    void (async () => {
      const pressed = new Set<string>();
      const tap = (code: string): void => {
        keyEvent('keydown', code);
        keyEvent('keyup', code);
      };
      const runSegment = async (direction: MovementDirection, sprint: boolean): Promise<MovementSample> => {
        const start = position(playerProbe);
        const keys = [...DIRECTION_KEYS[direction], ...(sprint ? ['ShiftLeft'] : [])];
        for (const code of keys) {
          keyEvent('keydown', code);
          pressed.add(code);
        }
        await wait(SEGMENT_MS);
        const end = position(playerProbe);
        for (const code of keys) {
          keyEvent('keyup', code);
          pressed.delete(code);
        }
        return {
          x: end.x - start.x,
          z: end.z - start.z,
          distance: distance(start, end),
          velocityX: Number(playerProbe.dataset.velocityX ?? 0),
          velocityZ: Number(playerProbe.dataset.velocityZ ?? 0),
        };
      };

      try {
        tap('KeyK');
        await wait(80);
        const forward = await runSegment('forward', false);
        const sprint = await runSegment('forward', true);
        const cut = await runSegment('left', true);
        const reversal = await runSegment('back', false);
        const beforeStop = position(playerProbe);
        await wait(700);
        const stopDrift = distance(beforeStop, position(playerProbe));
        const metrics = { forward: forward.distance, sprint: sprint.distance, cut: cut.distance, reversal: reversal.distance, stopDrift,
          vectors: { forward: { x: forward.x, z: forward.z }, sprint: { x: sprint.x, z: sprint.z }, cut: { x: cut.x, z: cut.z }, reversal: { x: reversal.x, z: reversal.z } },
          terminalVelocity: { x: reversal.velocityX, z: reversal.velocityZ } };
        result.dataset.results = JSON.stringify(metrics);
        result.dataset.status = 'complete';
        result.textContent = `Jog ${forward.distance.toFixed(2)} m · sprint ${sprint.distance.toFixed(2)} m · cut ${cut.distance.toFixed(2)} m · reverse ${reversal.distance.toFixed(2)} m · stop drift ${stopDrift.toFixed(2)} m`;
      } catch (error) {
        result.dataset.status = 'failed';
        result.textContent = error instanceof Error ? error.message : 'Movement check failed';
      } finally {
        for (const code of pressed) keyEvent('keyup', code);
        button.disabled = false;
      }
    })();
  });
}
