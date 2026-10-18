import { describe, expect, it } from 'vitest';
import {
  BOT_DIFFICULTY_TIERS,
  physicalDifficultySnapshot,
} from './difficulty';

describe('Stage 07 physical fairness contract', () => {
  it('novice, standard, and elite use identical authoritative physical multipliers', () => {
    const snapshots = BOT_DIFFICULTY_TIERS.map((tier) => physicalDifficultySnapshot(tier));
    expect(snapshots[1]).toEqual(snapshots[0]);
    expect(snapshots[2]).toEqual(snapshots[0]);
    expect(snapshots[0]).toEqual({
      movementSpeedScale: 1,
      accelerationScale: 1,
      staminaCapacityScale: 1,
      staminaDrainScale: 1,
      tackleColliderScale: 1,
      ballPhysicsScale: 1,
      goalkeeperReachScale: 1,
    });
  });

  it('physical snapshots expose no tier-specific override field', () => {
    for (const tier of BOT_DIFFICULTY_TIERS) {
      expect(Object.keys(physicalDifficultySnapshot(tier)).sort()).toEqual([
        'accelerationScale',
        'ballPhysicsScale',
        'goalkeeperReachScale',
        'movementSpeedScale',
        'staminaCapacityScale',
        'staminaDrainScale',
        'tackleColliderScale',
      ]);
    }
  });
});
