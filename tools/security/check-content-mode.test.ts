import { describe, expect, it } from 'vitest';
import { validateContentBuildMode } from './check-content-mode.mjs';

describe('production content-mode build guard', () => {
  it('permits only the fictional public mode in production', () => {
    expect(validateContentBuildMode(undefined, true)).toBe('FICTIONAL_PUBLIC');
    expect(() => validateContentBuildMode('PRIVATE', true)).toThrow(/require FICTIONAL_PUBLIC/);
    expect(validateContentBuildMode('PRIVATE', false)).toBe('PRIVATE');
  });
});
