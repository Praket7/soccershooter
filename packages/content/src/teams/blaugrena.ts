import type { TeamDefinition } from './schema';
import { makeRoster } from './shared';

export const blaugrena: TeamDefinition = {
  id: 'blaugrena', displayName: 'Blaugrena',
  palette: { primary: '#742d48', secondary: '#214f89', accent: '#d7b55a', text: '#fff8ed' },
  badgeAsset: '/assets/teams/blaugrena.svg',
  homeKit: { baseColor: '#742d48', trimColor: '#214f89', shortsColor: '#182d4b', socksColor: '#742d48', pattern: 'split' },
  awayKit: { baseColor: '#f2ead7', trimColor: '#d7b55a', shortsColor: '#214f89', socksColor: '#f2ead7', pattern: 'sash' },
  tacticalProfile: 'technical-possession',
  roster: makeRoster('blaugrena', ['Vale', 'Soren', 'Marek', 'Dalen', 'Oris', 'Tomas', 'Pavel', 'Ciro', 'Belen', 'Rami', 'Jalen'], ['close-control', 'short-passing', 'third-man-run']),
};
