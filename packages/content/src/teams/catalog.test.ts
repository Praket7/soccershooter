import { describe, expect, it } from 'vitest';
import { PUBLIC_TEAMS } from './catalog';
import { contrastRatio } from './schema';
import { selectContentMode } from '../contentMode';

describe('Stage 10 fictional team content', () => {
  it('loads four stable fictional public teams with complete starting elevens', () => {
    expect(PUBLIC_TEAMS.map((team) => team.id)).toEqual(['blaugrena', 'royal-whites', 'oil-company-north', 'oil-company-capital']);
    for (const team of PUBLIC_TEAMS) {
      expect(team.roster).toHaveLength(11);
      expect(team.roster.every((player) => player.id.startsWith(`${team.id}-player-`))).toBe(true);
      expect(team.badgeAsset).toMatch(/^\/assets\/teams\/.+\.svg$/);
      expect(team.homeKit.pattern).not.toBe(team.awayKit.pattern);
    }
  });

  it('keeps team text readable on its primary palette color', () => {
    for (const team of PUBLIC_TEAMS) expect(contrastRatio(team.palette.text, team.palette.primary)).toBeGreaterThanOrEqual(4.5);
  });

  it('shows a local preview watermark and refuses private mode in production', () => {
    expect(selectContentMode('PRIVATE', false).watermark).toMatch(/LOCAL CONTENT PREVIEW/);
    expect(selectContentMode('FICTIONAL_PUBLIC', true).watermark).toBeNull();
    expect(() => selectContentMode('PRIVATE', true)).toThrow(/Production builds require/);
  });
});
