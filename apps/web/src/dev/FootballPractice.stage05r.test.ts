import { describe, expect, test } from 'vitest';
import * as practiceModule from './FootballPractice';

describe('Stage 05R practice presentation invariants', () => {
  test('practice renders the ball at exactly the authoritative physics radius', () => {
    const module = practiceModule as unknown as { PRACTICE_BALL_VISUAL_SCALE?: number };
    expect(module.PRACTICE_BALL_VISUAL_SCALE).toBe(1);
  });
});
