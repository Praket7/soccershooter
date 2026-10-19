import { validateTeam } from './schema';
import { blaugrena } from './blaugrena';
import { royalWhites } from './royalWhites';
import { oilNorth } from './oilNorth';
import { oilCapital } from './oilCapital';

export const PUBLIC_TEAMS = Object.freeze([blaugrena, royalWhites, oilNorth, oilCapital]);
for (const team of PUBLIC_TEAMS) validateTeam(team);
export const PUBLIC_TEAM_BY_ID: ReadonlyMap<string, (typeof PUBLIC_TEAMS)[number]> = new Map(PUBLIC_TEAMS.map((team) => [team.id, team]));
