import { afterEach, describe, expect, test } from 'vitest';
import { createPlayerState } from '@soccershooter/sim/player/PlayerState';
import { ThirdPersonCamera } from './ThirdPersonCamera';

function installPracticeProbe(ballX: number, ballZ: number): void {
  const fakeDocument = {
    querySelector(selector: string) {
      if (selector === '[data-football-practice]') return { hidden: false };
      if (selector === '[data-football-state]') {
        return { dataset: { ballX: String(ballX), ballY: '0.11', ballZ: String(ballZ) } };
      }
      return null;
    },
  };
  Object.defineProperty(globalThis, 'document', { configurable: true, value: fakeDocument });
}

afterEach(() => {
  Reflect.deleteProperty(globalThis, 'document');
});

describe('Stage 05 Football Practice camera integration', () => {
  test('empty world obstacles still use ball-aware practice framing while practice is visible', () => {
    installPracticeProbe(4, 0.5);
    const camera = new ThirdPersonCamera();
    const snapshot = camera.update(
      createPlayerState({ position: { x: 0, y: 0, z: 0 } }),
      { yawDelta: 0, pitchDelta: 0 },
      1 / 60,
      [],
      0,
    );
    expect(snapshot.target.x).toBeGreaterThan(0.45);
    expect(snapshot.target.x).toBeLessThanOrEqual(0.9);
  });

  test('practice camera collides with the visible opposite goal instead of clipping through its post', () => {
    installPracticeProbe(3.66, -13);
    const camera = new ThirdPersonCamera();
    const snapshot = camera.update(
      createPlayerState({ position: { x: 3.66, y: 0, z: -13 } }),
      { yawDelta: 0, pitchDelta: 0 },
      1 / 60,
      [],
      0,
    );
    expect(snapshot.collision.active).toBe(true);
    expect(snapshot.collision.obstacleId).toBe('opposite-goal-right-post');
    expect(snapshot.armLength).toBeLessThan(snapshot.userDistance);
  });
});
