import { describe, expect, test } from 'vitest';
import { STAGE_TEST_GUIDE } from './StageTestingGuide';

describe('Stage 06–10 preview testing guide', () => {
  test('lists each planned stage with an honest preview surface and an actionable owner check', () => {
    expect(STAGE_TEST_GUIDE.map(({ stage }) => stage)).toEqual([6, 7, 8, 9, 10]);
    for (const item of STAGE_TEST_GUIDE) {
      expect(item.surface.trim().length).toBeGreaterThan(0);
      expect(item.checks.length).toBeGreaterThanOrEqual(2);
      expect(item.actions.length).toBeGreaterThan(0);
    }
    expect(STAGE_TEST_GUIDE[4]?.checks.join(' ')).toMatch(/FICTIONAL_PUBLIC|content mode/i);
    expect(STAGE_TEST_GUIDE[4]?.description).toMatch(/not a playable team-selection mode/i);
    expect(STAGE_TEST_GUIDE[1]?.actions.map(({ label }) => label)).toContain('Open Adaptive Bot Playtest');
    expect(STAGE_TEST_GUIDE[1]?.checks.join(' ')).toMatch(/WASD.*Space.*challenge/i);
  });
});
