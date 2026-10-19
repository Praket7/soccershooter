import { describe, expect, test } from 'vitest';
import { TECHNIQUE_BY_ID } from '@soccershooter/content/techniques/catalog';
import { describeTechniqueForPlayer } from './TechniquePlayerGuide';

describe('player-facing technique guidance', () => {
  test('explains an aerial technique in physical terms before the player attempts it', () => {
    const bicycle = TECHNIQUE_BY_ID.get('bicycle');
    if (!bicycle) throw new Error('missing bicycle technique');
    const guide = describeTechniqueForPlayer(bicycle);

    expect(guide.setup).toContain('Airborne ball');
    expect(guide.setup).toContain('0.75–1.70 m');
    expect(guide.cost).toBe('10 stamina · 34 tick recovery');
    expect(guide.contact).toContain('24.0 m/s');
    expect(guide.contact).toContain('backspin');
  });

  test('explains a grounded dribble move without developer-only ids', () => {
    const bodyFeint = TECHNIQUE_BY_ID.get('body-feint');
    if (!bodyFeint) throw new Error('missing body-feint technique');
    const guide = describeTechniqueForPlayer(bodyFeint);

    expect(guide.name).toBe('Body feint');
    expect(guide.setup).toContain('Ground ball');
    expect(guide.speed).toContain('0.0–9.0 m/s');
    expect(guide.pressure).toContain('92%');
    expect(guide.risk).toContain('counter window');
  });
});
