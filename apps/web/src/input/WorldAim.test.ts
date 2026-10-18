import { describe, expect, test } from 'vitest';
import { intersectAimRayWithGround, intersectAimRayWithPlaneZ } from './WorldAim';

describe('center-reticle world aim', () => {
  test('camera center ray intersects gameplay ground deterministically', () => {
    const hit = intersectAimRayWithGround(
      { x: 0, y: 3, z: -4 },
      { x: 0.2, y: -0.5, z: 1 },
      0,
    );
    expect(hit).not.toBeNull();
    expect(hit?.y).toBe(0);
    expect(hit?.z).toBeGreaterThan(-4);
  });

  test('goal plane target uses the same ray rather than camera yaw only', () => {
    const hit = intersectAimRayWithPlaneZ(
      { x: 0, y: 2, z: 0 },
      { x: 0.25, y: 0.05, z: 1 },
      18,
    );
    expect(hit).not.toBeNull();
    expect(hit?.z).toBe(18);
    expect(hit?.x).toBeGreaterThan(0);
    expect(hit?.y).toBeGreaterThan(2);
  });

  test('parallel or backwards rays do not invent aim targets', () => {
    expect(intersectAimRayWithGround({ x: 0, y: 2, z: 0 }, { x: 1, y: 0, z: 0 }, 0)).toBeNull();
    expect(intersectAimRayWithPlaneZ({ x: 0, y: 2, z: 0 }, { x: 0, y: 0, z: -1 }, 18)).toBeNull();
  });
});
