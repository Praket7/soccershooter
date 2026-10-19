import { describe, expect, it } from 'vitest';
import { shouldLoadDevLabs } from './DevToolsBootstrap';

describe('developer lab shipping boundary', () => {
  it('keeps developer labs available during development', () => {
    expect(shouldLoadDevLabs(true, '')).toBe(true);
  });

  it('keeps developer labs out of the normal production experience', () => {
    expect(shouldLoadDevLabs(false, '')).toBe(false);
    expect(shouldLoadDevLabs(false, '?career=1')).toBe(false);
  });

  it('allows an explicit production diagnostics opt-in', () => {
    expect(shouldLoadDevLabs(false, '?devLabs=1')).toBe(true);
    expect(shouldLoadDevLabs(false, '?foo=bar&devLabs=1')).toBe(true);
  });
});
