import { describe, expect, test } from 'vitest';
import {
  DEFAULT_GAMEPLAY_PREFERENCES,
  GAMEPLAY_PREFERENCES_KEY,
  loadGameplayPreferences,
  sanitizeGameplayPreferences,
  saveGameplayPreferences,
} from './GameplayPreferences';

class MemoryStorage {
  readonly values = new Map<string, string>();
  getItem(key: string): string | null { return this.values.get(key) ?? null; }
  setItem(key: string, value: string): void { this.values.set(key, value); }
  removeItem(key: string): void { this.values.delete(key); }
}

describe('gameplay preferences', () => {
  test('ships professional defaults without changing existing feel', () => {
    expect(DEFAULT_GAMEPLAY_PREFERENCES).toMatchObject({
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
  });

  test('sanitizes imported or stale settings into safe player-facing envelopes', () => {
    const result = sanitizeGameplayPreferences({
      mouseSensitivity: 99,
      gamepadLookSensitivity: -4,
      gamepadMoveDeadzone: 0.9,
      gamepadLookDeadzone: -1,
      invertY: true,
      cameraFov: 200,
      cameraDistance: 1,
      sprintFovBoost: 99,
      reducedMotion: true,
      hudScale: 9,
      showControlHints: false,
    });

    expect(result.mouseSensitivity).toBe(0.0065);
    expect(result.gamepadLookSensitivity).toBe(0.5);
    expect(result.gamepadMoveDeadzone).toBe(0.35);
    expect(result.gamepadLookDeadzone).toBe(0.05);
    expect(result.cameraFov).toBe(75);
    expect(result.cameraDistance).toBe(3.4);
    expect(result.sprintFovBoost).toBe(4);
    expect(result.hudScale).toBe(1.4);
    expect(result.invertY).toBe(true);
    expect(result.reducedMotion).toBe(true);
    expect(result.showControlHints).toBe(false);
  });

  test('corrupt storage falls back to defaults instead of breaking boot', () => {
    const storage = new MemoryStorage();
    storage.setItem(GAMEPLAY_PREFERENCES_KEY, '{definitely-not-json');
    expect(loadGameplayPreferences(storage)).toEqual(DEFAULT_GAMEPLAY_PREFERENCES);
  });

  test('save and load round-trip a sanitized versioned payload', () => {
    const storage = new MemoryStorage();
    const saved = saveGameplayPreferences(storage, {
      ...DEFAULT_GAMEPLAY_PREFERENCES,
      cameraFov: 68,
      invertY: true,
      hudScale: 1.2,
    });
    expect(loadGameplayPreferences(storage)).toEqual(saved);
    expect(JSON.parse(storage.getItem(GAMEPLAY_PREFERENCES_KEY) ?? '{}')).toMatchObject({ version: 1, cameraFov: 68 });
  });
});
