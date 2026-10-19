import type { TeamDefinition } from './schema';
import { makeRoster } from './shared';

export const royalWhites: TeamDefinition = {
  id: 'royal-whites', displayName: 'Royal Whites',
  palette: { primary: '#f4f1e8', secondary: '#23354f', accent: '#cbb77a', text: '#172331' },
  badgeAsset: '/assets/teams/royal-whites.svg',
  homeKit: { baseColor: '#f4f1e8', trimColor: '#23354f', shortsColor: '#23354f', socksColor: '#f4f1e8', pattern: 'pinstripe' },
  awayKit: { baseColor: '#23354f', trimColor: '#cbb77a', shortsColor: '#172331', socksColor: '#23354f', pattern: 'sash' },
  tacticalProfile: 'elite-transition',
  roster: makeRoster('royal-whites', ['Arden', 'Quill', 'Marlow', 'Renn', 'Cade', 'Ellery', 'Voss', 'Tarin', 'Bram', 'Alden', 'Keller'], ['quick-transition', 'long-pass', 'overlap']),
};
