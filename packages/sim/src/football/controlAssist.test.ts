import { describe, expect, it } from 'vitest';
import { chooseControlAssist } from './controlAssist';

describe('bounded football control assistance', () => {
  const input = {
    actorPosition: { x: 0, y: 0, z: 0 },
    ballPosition: { x: 0.32, y: 0.11, z: 0.38 },
    facingYaw: 0,
    nextFoot: 'left' as const,
    preferredFoot: 'left' as const,
    pressure: 0.1,
    balance: 0.9,
    precision: false,
    turnDemand: 0.2,
    skill: 'beginner' as const,
  };

  it('ranks the viable side foot while preserving pressure and timing limits', () => {
    const assist = chooseControlAssist(input);
    expect(assist.foot).toBe('right');
    expect(assist.surface).toBe('instep');
    expect(assist.timingWindowTicks).toBe(2);
    expect(assist.maxReachMeters).toBe(1.48);
  });

  it('rewards mastery setup with tighter timing and never expands physical reach', () => {
    const beginner = chooseControlAssist(input);
    const mastery = chooseControlAssist({ ...input, skill: 'mastery' });
    expect(mastery.timingWindowTicks).toBe(1);
    expect(mastery.maxReachMeters).toBe(beginner.maxReachMeters);
    expect(mastery.approachCorrectionMeters).toBeLessThanOrEqual(beginner.approachCorrectionMeters);
  });

  it('keeps beginner timing narrow under pressure and precision', () => {
    const assist = chooseControlAssist({ ...input, pressure: 0.9, precision: true });
    expect(assist.timingWindowTicks).toBe(1);
    expect(assist.approachCorrectionMeters).toBe(0);
  });
});
