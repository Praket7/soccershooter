import { describe, expect, test } from 'vitest';
import { PLAYER_VISUAL_LAYOUT, playerVisualFootY } from './PlayerVisualLayout';

describe('Stage 05 owner player grounding feedback', () => {
  test('the greybox player body visually reaches the support plane', () => {
    expect(playerVisualFootY(0)).toBeCloseTo(0, 8);
    expect(PLAYER_VISUAL_LAYOUT.headCenterY - PLAYER_VISUAL_LAYOUT.headRadius)
      .toBeLessThanOrEqual(PLAYER_VISUAL_LAYOUT.torsoCenterY + PLAYER_VISUAL_LAYOUT.torsoHeight / 2 + 0.03);
  });
});
