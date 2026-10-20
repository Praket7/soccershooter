import type { PlannedDribbleState } from './dribblePlanner';

/**
 * Pause ordinary carry planning while a pass, shot, or specialist contact owns
 * the next football beat. The pending intercept is discarded because the ball
 * and athlete keep moving, but the previous physical contact provenance stays
 * intact so play can resume from the correct foot cadence instead of starting
 * possession from scratch.
 */
export function suspendPlannedDribble(
  state: Readonly<PlannedDribbleState>,
): PlannedDribbleState {
  return {
    activePlan: null,
    consumedEventIds: [...state.consumedEventIds],
    lastContactTick: state.lastContactTick,
    lastContactFoot: state.lastContactFoot,
    looseBall: false,
  };
}
