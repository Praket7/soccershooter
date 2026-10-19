import { describe, expect, it } from 'vitest';
import { findPublicBundleViolations } from '../../../tools/security/check-public-bundle.mjs';

describe('production content boundary', () => {
  it('rejects a private reference path and known local roster marker', () => {
    expect(findPublicBundleViolations('asset.js', 'private/reference-content/local-roster.json')).toHaveLength(1);
    expect(findPublicBundleViolations('asset.js', 'const privateRoster = reference-content')).toHaveLength(1);
  });

  it('accepts the fictional public content pack', () => {
    expect(findPublicBundleViolations('asset.js', 'Blaugrena · Royal Whites · fictional roster')).toEqual([]);
  });
});
