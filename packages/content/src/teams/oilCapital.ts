import type { TeamDefinition } from './schema';
import { makeRoster } from './shared';

export const oilCapital: TeamDefinition = {
  id: 'oil-company-capital', displayName: 'Oil Company Capital',
  palette: { primary: '#23354d', secondary: '#913948', accent: '#d2ad58', text: '#fff7eb' },
  badgeAsset: '/assets/teams/oil-company-capital.svg',
  homeKit: { baseColor: '#23354d', trimColor: '#913948', shortsColor: '#172435', socksColor: '#d2ad58', pattern: 'sash' },
  awayKit: { baseColor: '#e9e4d8', trimColor: '#913948', shortsColor: '#23354d', socksColor: '#e9e4d8', pattern: 'chevron' },
  tacticalProfile: 'speed-flair',
  roster: makeRoster('oil-company-capital', ['Reno', 'Silas', 'Dario', 'Neri', 'Olan', 'Tarek', 'Miro', 'Aven', 'Zori', 'Kellan', 'Deni'], ['burst-run', 'one-v-one', 'diagonal-run']),
};
