import { describe, expect, test } from 'vitest';
import { Scene } from 'three';
import { createPlayerState } from '../../../../packages/sim/src/player/PlayerState';
import { ProceduralAthleteProxy } from './ProceduralAthleteProxy';

describe('procedural athlete locomotion regressions', () => {
  test('ordinary jog stance keeps the support boot planted while the root advances', () => {
    const proxy = new ProceduralAthleteProxy(new Scene());
    const base = createPlayerState({ position: { x: 0, y: 0, z: 0 }, facingYaw: 0 });
    const strideSeconds = 0.42;
    const startPhase = 0.10;
    const dt = 0.05;
    const speed = 5;
    const start = {
      ...base,
      velocity: { x: 0, y: 0, z: speed },
      athleticMotion: {
        ...base.athleticMotion,
        gait: 'jog' as const,
        gaitPhase: startPhase,
        supportFoot: 'left' as const,
        nextFoot: 'right' as const,
        strideSeconds,
        plannedVelocity: { x: 0, z: speed },
      },
    };

    proxy.update({ player: start, simulationTick: 20, interpolationAlpha: 0 });
    const plantedAtStart = proxy.getFootWorldPosition('left');

    const end = {
      ...start,
      position: { x: 0, y: 0, z: speed * dt },
      athleticMotion: {
        ...start.athleticMotion,
        gaitPhase: (startPhase + dt / strideSeconds) % 1,
      },
    };
    proxy.update({ player: end, simulationTick: 23, interpolationAlpha: 0 });
    const plantedAfterRootAdvance = proxy.getFootWorldPosition('left');

    expect(plantedAtStart.distanceTo(plantedAfterRootAdvance)).toBeLessThanOrEqual(0.08);
    proxy.dispose();
  });
});
