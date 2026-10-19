import {
  DEFAULT_GAMEPLAY_PREFERENCES,
  currentGameplayPreferences,
  loadGameplayPreferences,
  saveGameplayPreferences,
  setActiveGameplayPreferences,
  type GameplayPreferences,
  type PreferenceStorage,
} from './GameplayPreferences';

function browserStorage(): PreferenceStorage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

const storage = browserStorage();
const initialPreferences = storage
  ? loadGameplayPreferences(storage)
  : { ...DEFAULT_GAMEPLAY_PREFERENCES };
setActiveGameplayPreferences(initialPreferences);

function percent(value: number): number {
  return Math.round(value * 100);
}

function mousePercent(value: number): number {
  return Math.round(value / DEFAULT_GAMEPLAY_PREFERENCES.mouseSensitivity * 100);
}

function applyPagePreferences(preferences: Readonly<GameplayPreferences>): void {
  document.documentElement.style.setProperty('--game-hud-scale', String(preferences.hudScale));
  document.body.dataset.reducedMotion = String(preferences.reducedMotion);
  document.body.dataset.cameraFov = String(preferences.cameraFov);
  document.body.dataset.cameraDistance = preferences.cameraDistance.toFixed(1);
  document.body.dataset.gamepadMoveDeadzone = preferences.gamepadMoveDeadzone.toFixed(2);
  document.body.dataset.gamepadLookDeadzone = preferences.gamepadLookDeadzone.toFixed(2);
  document.body.dataset.invertY = String(preferences.invertY);
  for (const hints of document.querySelectorAll<HTMLElement>('.control-card')) {
    hints.hidden = !preferences.showControlHints;
  }
}

function readNumber(root: ParentNode, name: string): number {
  const input = root.querySelector<HTMLInputElement>(`[name="${name}"]`);
  if (!input) throw new Error(`Missing gameplay setting: ${name}`);
  return Number(input.value);
}

function readChecked(root: ParentNode, name: string): boolean {
  const input = root.querySelector<HTMLInputElement>(`[name="${name}"]`);
  if (!input) throw new Error(`Missing gameplay setting: ${name}`);
  return input.checked;
}

function preferencesFromForm(root: ParentNode): GameplayPreferences {
  return {
    version: 1,
    mouseSensitivity: DEFAULT_GAMEPLAY_PREFERENCES.mouseSensitivity * readNumber(root, 'mouse-sensitivity') / 100,
    gamepadLookSensitivity: readNumber(root, 'gamepad-look-sensitivity') / 100,
    gamepadMoveDeadzone: readNumber(root, 'gamepad-move-deadzone') / 100,
    gamepadLookDeadzone: readNumber(root, 'gamepad-look-deadzone') / 100,
    invertY: readChecked(root, 'invert-y'),
    cameraFov: readNumber(root, 'camera-fov'),
    cameraDistance: readNumber(root, 'camera-distance'),
    sprintFovBoost: readNumber(root, 'sprint-fov-boost'),
    reducedMotion: readChecked(root, 'reduced-motion'),
    hudScale: readNumber(root, 'hud-scale') / 100,
    showControlHints: readChecked(root, 'show-control-hints'),
  };
}

function setInputValue(root: ParentNode, name: string, value: string | number): void {
  const input = root.querySelector<HTMLInputElement>(`[name="${name}"]`);
  if (input) input.value = String(value);
}

function setInputChecked(root: ParentNode, name: string, checked: boolean): void {
  const input = root.querySelector<HTMLInputElement>(`[name="${name}"]`);
  if (input) input.checked = checked;
}

function syncForm(root: ParentNode, preferences: Readonly<GameplayPreferences>): void {
  setInputValue(root, 'mouse-sensitivity', mousePercent(preferences.mouseSensitivity));
  setInputValue(root, 'gamepad-look-sensitivity', percent(preferences.gamepadLookSensitivity));
  setInputValue(root, 'gamepad-move-deadzone', percent(preferences.gamepadMoveDeadzone));
  setInputValue(root, 'gamepad-look-deadzone', percent(preferences.gamepadLookDeadzone));
  setInputChecked(root, 'invert-y', preferences.invertY);
  setInputValue(root, 'camera-fov', preferences.cameraFov);
  setInputValue(root, 'camera-distance', preferences.cameraDistance.toFixed(1));
  setInputValue(root, 'sprint-fov-boost', preferences.sprintFovBoost);
  setInputChecked(root, 'reduced-motion', preferences.reducedMotion);
  setInputValue(root, 'hud-scale', percent(preferences.hudScale));
  setInputChecked(root, 'show-control-hints', preferences.showControlHints);
  updateOutputs(root);
}

function updateOutputs(root: ParentNode): void {
  for (const output of root.querySelectorAll<HTMLOutputElement>('[data-value-for]')) {
    const name = output.dataset.valueFor;
    if (!name) continue;
    const input = root.querySelector<HTMLInputElement>(`[name="${name}"]`);
    if (!input) continue;
    const suffix = output.dataset.suffix ?? '';
    output.value = `${input.value}${suffix}`;
  }
}

function settingRow(
  name: string,
  label: string,
  min: number,
  max: number,
  step: number,
  suffix: string,
): string {
  return `
    <label class="gameplay-setting-row">
      <span>${label}</span>
      <output data-value-for="${name}" data-suffix="${suffix}"></output>
      <input name="${name}" aria-label="${label}" type="range" min="${min}" max="${max}" step="${step}">
    </label>`;
}

function setupPanel(): void {
  applyPagePreferences(currentGameplayPreferences());
  const headerActions = document.querySelector<HTMLElement>('.header-actions');
  if (!headerActions || document.querySelector('[data-gameplay-settings-button]')) return;

  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'gameplay-settings-button';
  button.dataset.gameplaySettingsButton = 'true';
  button.textContent = 'Settings';
  headerActions.prepend(button);

  const dialog = document.createElement('dialog');
  dialog.className = 'gameplay-settings-dialog';
  dialog.setAttribute('aria-labelledby', 'gameplay-settings-title');
  dialog.innerHTML = `
    <form class="gameplay-settings-form" method="dialog">
      <header>
        <div>
          <p class="eyebrow">PLAYER PREFERENCES</p>
          <h2 id="gameplay-settings-title">Gameplay settings</h2>
          <p>Adjust controls and camera comfort without changing the authoritative football simulation.</p>
        </div>
        <button type="button" class="settings-close-icon" data-settings-close aria-label="Close settings">×</button>
      </header>

      <section aria-labelledby="controls-settings-heading">
        <h3 id="controls-settings-heading">Controls</h3>
        ${settingRow('mouse-sensitivity', 'Mouse sensitivity', 50, 200, 5, '%')}
        ${settingRow('gamepad-look-sensitivity', 'Controller look sensitivity', 50, 200, 5, '%')}
        ${settingRow('gamepad-move-deadzone', 'Movement stick deadzone', 5, 35, 1, '%')}
        ${settingRow('gamepad-look-deadzone', 'Camera stick deadzone', 5, 35, 1, '%')}
        <label class="gameplay-setting-toggle"><span>Invert vertical camera</span><input name="invert-y" aria-label="Invert vertical camera" type="checkbox"></label>
      </section>

      <section aria-labelledby="camera-settings-heading">
        <h3 id="camera-settings-heading">Camera</h3>
        ${settingRow('camera-fov', 'Camera field of view', 48, 75, 1, '°')}
        ${settingRow('camera-distance', 'Camera distance', 3.4, 8.8, 0.1, ' m')}
        ${settingRow('sprint-fov-boost', 'Sprint field of view boost', 0, 4, 0.25, '°')}
        <label class="gameplay-setting-toggle"><span>Reduce camera motion</span><input name="reduced-motion" aria-label="Reduce camera motion" type="checkbox"></label>
      </section>

      <section aria-labelledby="interface-settings-heading">
        <h3 id="interface-settings-heading">Interface</h3>
        ${settingRow('hud-scale', 'HUD scale', 80, 140, 5, '%')}
        <label class="gameplay-setting-toggle"><span>Show control hints</span><input name="show-control-hints" aria-label="Show control hints" type="checkbox"></label>
      </section>

      <footer>
        <button type="button" class="settings-secondary" data-settings-reset>Reset defaults</button>
        <button type="button" class="settings-primary" data-settings-close>Close settings</button>
      </footer>
    </form>`;
  document.body.append(dialog);

  const commit = (): void => {
    const next = preferencesFromForm(dialog);
    const sanitized = storage ? saveGameplayPreferences(storage, next) : setActiveGameplayPreferences(next);
    setActiveGameplayPreferences(sanitized);
    syncForm(dialog, sanitized);
    applyPagePreferences(sanitized);
  };

  syncForm(dialog, currentGameplayPreferences());
  dialog.addEventListener('input', commit);
  for (const close of dialog.querySelectorAll<HTMLButtonElement>('[data-settings-close]')) {
    close.addEventListener('click', () => dialog.close());
  }
  dialog.querySelector<HTMLButtonElement>('[data-settings-reset]')?.addEventListener('click', () => {
    const defaults = storage
      ? saveGameplayPreferences(storage, DEFAULT_GAMEPLAY_PREFERENCES)
      : { ...DEFAULT_GAMEPLAY_PREFERENCES };
    setActiveGameplayPreferences(defaults);
    syncForm(dialog, defaults);
    applyPagePreferences(defaults);
  });
  button.addEventListener('click', () => {
    if (document.pointerLockElement) document.exitPointerLock?.();
    syncForm(dialog, currentGameplayPreferences());
    if (!dialog.open) dialog.showModal();
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', setupPanel, { once: true });
} else {
  setupPanel();
}
