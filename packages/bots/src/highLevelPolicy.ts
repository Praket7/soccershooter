import type { BotRole, TeamId } from './types';

export const HIGH_LEVEL_ACTIONS = [
  'shoot', 'pass', 'dribble', 'protect', 'clear',
  'support', 'overlap', 'width', 'half-space', 'back-post-run', 'recycle',
  'press', 'cover', 'block-lane', 'block-shot', 'intercept', 'recover-goal-side',
  'position', 'claim', 'dive', 'parry', 'distribute',
] as const;
export type HighLevelAction = (typeof HIGH_LEVEL_ACTIONS)[number];

export interface HighLevelPolicyContext {
  team: TeamId;
  tick: number;
  playerIds: readonly string[];
}

export interface HighLevelBotProposal {
  playerId: string;
  action?: HighLevelAction;
  role?: BotRole;
  targetPlayerId?: string | null;
}

export interface HighLevelPolicyAdapter {
  id: string;
  enabled: boolean;
  propose(context: Readonly<HighLevelPolicyContext>): readonly HighLevelBotProposal[];
}

const ALLOWED_KEYS = new Set(['playerId', 'action', 'role', 'targetPlayerId']);
const ALLOWED_ROLES = new Set<BotRole>([
  'goalkeeper', 'ball-carrier', 'immediate-support', 'width-support',
  'presser', 'cover-defender', 'recovery-runner',
]);
const ALLOWED_ACTIONS = new Set<string>(HIGH_LEVEL_ACTIONS);

export function validateHighLevelProposal(value: Readonly<HighLevelBotProposal>): HighLevelBotProposal {
  if (!value || typeof value !== 'object') throw new TypeError('High-level proposal must be an object');
  for (const key of Object.keys(value)) {
    if (!ALLOWED_KEYS.has(key)) throw new TypeError(`High-level proposal contains forbidden field: ${key}`);
  }
  if (typeof value.playerId !== 'string' || value.playerId.length === 0) throw new TypeError('playerId is required');
  if (value.action !== undefined && !ALLOWED_ACTIONS.has(value.action)) throw new TypeError('Unknown high-level action');
  if (value.role !== undefined && !ALLOWED_ROLES.has(value.role)) throw new TypeError('Unknown high-level role');
  if (value.targetPlayerId !== undefined && value.targetPlayerId !== null && typeof value.targetPlayerId !== 'string') {
    throw new TypeError('targetPlayerId must be a string or null');
  }
  return {
    playerId: value.playerId,
    ...(value.action !== undefined ? { action: value.action } : {}),
    ...(value.role !== undefined ? { role: value.role } : {}),
    ...(value.targetPlayerId !== undefined ? { targetPlayerId: value.targetPlayerId } : {}),
  };
}

export function createDisabledHighLevelPolicy(): HighLevelPolicyAdapter {
  return {
    id: 'disabled',
    enabled: false,
    propose: () => [],
  };
}
