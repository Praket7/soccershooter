export interface GameplayPreferences {
  version: 1;
  mouseSensitivity: number;
  gamepadLookSensitivity: number;
  gamepadMoveDeadzone: number;
  gamepadLookDeadzone: number;
  invertY: boolean;
  cameraFov: number;
  cameraDistance: number;
  sprintFovBoost: number;
  reducedMotion: boolean;
  hudScale: number;
  showControlHints: boolean;
}

export interface PreferenceStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem?(key: string): void;
}

export const GAMEPLAY_PREFERENCES_KEY = 'soccershooter.gameplayPreferences.v1';

export const DEFAULT_GAMEPLAY_PREFERENCES: Readonly<GameplayPreferences> = Object.freeze({
  version: 1,
  mouseSensitivity: 0.00325,
  gamepadLookSensitivity: 1,
  gamepadMoveDeadzone: 0.15,
  gamepadLookDeadzone: 0.12,
  invertY: false,
  cameraFov: 55,
  cameraDistance: 5.6,
  sprintFovBoost: 2.25,
  reducedMotion: false,
  hudScale: 1,
  showControlHints: true,
});

let activePreferences: GameplayPreferences = { ...DEFAULT_GAMEPLAY_PREFERENCES };

function numberIn(value: unknown, fallback: number, min: number, max: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, value));
}

function booleanOr(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

export function sanitizeGameplayPreferences(value: unknown): GameplayPreferences {
  const source = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  return {
    version: 1,
    mouseSensitivity: numberIn(source.mouseSensitivity, DEFAULT_GAMEPLAY_PREFERENCES.mouseSensitivity, 0.001625, 0.0065),
    gamepadLookSensitivity: numberIn(source.gamepadLookSensitivity, DEFAULT_GAMEPLAY_PREFERENCES.gamepadLookSensitivity, 0.5, 2),
    gamepadMoveDeadzone: numberIn(source.gamepadMoveDeadzone, DEFAULT_GAMEPLAY_PREFERENCES.gamepadMoveDeadzone, 0.05, 0.35),
    gamepadLookDeadzone: numberIn(source.gamepadLookDeadzone, DEFAULT_GAMEPLAY_PREFERENCES.gamepadLookDeadzone, 0.05, 0.35),
    invertY: booleanOr(source.invertY, DEFAULT_GAMEPLAY_PREFERENCES.invertY),
    cameraFov: numberIn(source.cameraFov, DEFAULT_GAMEPLAY_PREFERENCES.cameraFov, 48, 75),
    cameraDistance: numberIn(source.cameraDistance, DEFAULT_GAMEPLAY_PREFERENCES.cameraDistance, 3.4, 8.8),
    sprintFovBoost: numberIn(source.sprintFovBoost, DEFAULT_GAMEPLAY_PREFERENCES.sprintFovBoost, 0, 4),
    reducedMotion: booleanOr(source.reducedMotion, DEFAULT_GAMEPLAY_PREFERENCES.reducedMotion),
    hudScale: numberIn(source.hudScale, DEFAULT_GAMEPLAY_PREFERENCES.hudScale, 0.8, 1.4),
    showControlHints: booleanOr(source.showControlHints, DEFAULT_GAMEPLAY_PREFERENCES.showControlHints),
  };
}

/** Web-only live preference snapshot. Authoritative simulation never imports this module. */
export function currentGameplayPreferences(): Readonly<GameplayPreferences> {
  return activePreferences;
}

export function setActiveGameplayPreferences(value: unknown): GameplayPreferences {
  activePreferences = sanitizeGameplayPreferences(value);
  return { ...activePreferences };
}

export function loadGameplayPreferences(storage: PreferenceStorage): GameplayPreferences {
  try {
    const raw = storage.getItem(GAMEPLAY_PREFERENCES_KEY);
    if (!raw) return { ...DEFAULT_GAMEPLAY_PREFERENCES };
    return sanitizeGameplayPreferences(JSON.parse(raw));
  } catch {
    return { ...DEFAULT_GAMEPLAY_PREFERENCES };
  }
}

export function saveGameplayPreferences(
  storage: PreferenceStorage,
  preferences: Readonly<GameplayPreferences>,
): GameplayPreferences {
  const sanitized = sanitizeGameplayPreferences(preferences);
  try {
    storage.setItem(GAMEPLAY_PREFERENCES_KEY, JSON.stringify(sanitized));
  } catch {
    // Storage can be unavailable in privacy-restricted browsers. Settings still
    // apply for the current session; persistence failure must never break play.
  }
  return sanitized;
}
