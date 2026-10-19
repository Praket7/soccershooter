import { afterEach, describe, expect, test } from 'vitest';
import { createPlayerState } from '@soccershooter/sim/player/PlayerState';
import { ThirdPersonCamera } from './ThirdPersonCamera';
import {
  DEFAULT_GAMEPLAY_PREFERENCES,
  setActiveGameplayPreferences,
} from '../settings/GameplayPreferences';

afterEach(() => {
  setActiveGameplayPreferences(DEFAULT_GAMEPLAY_PREFERENCES);
});

describe('live camera comfort preferences', () => {
  test('new cameras start from the saved FOV and distance without changing simulation', () => {
    setActiveGameplayPreferences({
      ...DEFAULT_GAMEPLAY_PREFERENCES,
      cameraFov: 68,
      cameraDistance: 7.2,
    });
    const player = createPlayerState();
    const before = structuredClone(player);
    const camera = new ThirdPersonCamera();
    const snapshot = camera.update(player, { yawDelta: 0, pitchDelta: 0 }, 1 / 60, []);

    expect(snapshot.fov).toBeCloseTo(68, 8);
    expect(snapshot.userDistance).toBeCloseTo(7.2, 8);
    expect(player).toEqual(before);
  });

  test('preferences update a running camera while reduced motion removes sprint FOV pumping', () => {
    const camera = new ThirdPersonCamera();
    const player = createPlayerState();
    camera.update(player, { yawDelta: 0, pitchDelta: 0 }, 1 / 60, [], 1);

    setActiveGameplayPreferences({
      ...DEFAULT_GAMEPLAY_PREFERENCES,
      cameraFov: 60,
      cameraDistance: 4.4,
      sprintFovBoost: 4,
      reducedMotion: true,
    });

    let snapshot = camera.update(player, { yawDelta: 0, pitchDelta: 0 }, 1 / 60, [], 1);
    for (let frame = 0; frame < 120; frame += 1) {
      snapshot = camera.update(player, { yawDelta: 0, pitchDelta: 0 }, 1 / 60, [], 1);
    }
    expect(snapshot.desiredDistance).toBeCloseTo(4.4, 8);
    expect(snapshot.userDistance).toBeCloseTo(4.4, 3);
    expect(snapshot.fov).toBeCloseTo(60, 3);
  });
});
