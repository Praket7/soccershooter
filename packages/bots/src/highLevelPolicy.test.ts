import { describe, expect, it } from 'vitest';
import {
  createDisabledHighLevelPolicy,
  validateHighLevelProposal,
  type HighLevelPolicyAdapter,
} from './highLevelPolicy';

describe('Stage 07 learned-policy isolation', () => {
  it('is fully disabled by default', () => {
    const policy = createDisabledHighLevelPolicy();
    expect(policy.enabled).toBe(false);
    expect(policy.propose({ team: 'home', tick: 0, playerIds: ['h-1'] })).toEqual([]);
  });

  it('accepts only high-level role/action proposals', () => {
    expect(validateHighLevelProposal({ playerId: 'h-1', action: 'pass', role: 'ball-carrier', targetPlayerId: 'h-2' })).toEqual({
      playerId: 'h-1', action: 'pass', role: 'ball-carrier', targetPlayerId: 'h-2',
    });
  });

  it('rejects proposals that attempt to smuggle physical control fields', () => {
    expect(() => validateHighLevelProposal({ playerId: 'h-1', action: 'pass', moveSpeed: 99 } as never)).toThrow();
    expect(() => validateHighLevelProposal({ playerId: 'h-1', action: 'shoot', ballImpulse: { x: 99, y: 99, z: 99 } } as never)).toThrow();
    expect(() => validateHighLevelProposal({ playerId: 'h-1', role: 'presser', tackleRadius: 9 } as never)).toThrow();
  });

  it('cannot be enabled without an explicit adapter implementation', () => {
    const adapter: HighLevelPolicyAdapter = {
      id: 'local-research-only',
      enabled: false,
      propose: () => [{ playerId: 'h-1', action: 'pass' }],
    };
    expect(adapter.enabled).toBe(false);
  });
});
