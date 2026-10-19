import type { TeamDefinition } from './schema';
import { makeRoster } from './shared';

export const oilNorth: TeamDefinition = {
  id: 'oil-company-north', displayName: 'Oil Company North',
  palette: { primary: '#68bbd5', secondary: '#263942', accent: '#bd8158', text: '#18272d' },
  badgeAsset: '/assets/teams/oil-company-north.svg',
  homeKit: { baseColor: '#68bbd5', trimColor: '#263942', shortsColor: '#263942', socksColor: '#68bbd5', pattern: 'chevron' },
  awayKit: { baseColor: '#f2f0e8', trimColor: '#bd8158', shortsColor: '#263942', socksColor: '#f2f0e8', pattern: 'split' },
  tacticalProfile: 'positional-press',
  roster: makeRoster('oil-company-north', ['Rook', 'Dax', 'Merrit', 'Sol', 'Kade', 'Briar', 'Tolan', 'Ewan', 'Venn', 'Cato', 'Lior'], ['counter-press', 'cover-shadow', 'wide-trap']),
};
