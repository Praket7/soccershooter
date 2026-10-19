export type TacticalProfileId = 'technical-possession' | 'elite-transition' | 'positional-press' | 'speed-flair';
export type PlayerRole = 'goalkeeper' | 'defender' | 'midfielder' | 'attacker';
export type KitPattern = 'split' | 'sash' | 'pinstripe' | 'chevron';

export interface TeamPalette {
  primary: string;
  secondary: string;
  accent: string;
  text: string;
}

export interface KitDefinition {
  baseColor: string;
  trimColor: string;
  shortsColor: string;
  socksColor: string;
  pattern: KitPattern;
}

export interface PlayerDefinition {
  id: string;
  displayName: string;
  number: number;
  role: PlayerRole;
  preferredFoot: 'left' | 'right';
  styleTags: readonly string[];
}

export interface TeamDefinition {
  id: string;
  displayName: string;
  palette: TeamPalette;
  badgeAsset: string;
  homeKit: KitDefinition;
  awayKit: KitDefinition;
  tacticalProfile: TacticalProfileId;
  roster: readonly PlayerDefinition[];
}

export function validateTeam(team: TeamDefinition): void {
  if (!/^[a-z][a-z0-9-]{2,47}$/.test(team.id)) throw new TypeError('team id must be a stable slug');
  const colors = [team.palette.primary, team.palette.secondary, team.palette.accent, team.palette.text,
    team.homeKit.baseColor, team.homeKit.trimColor, team.awayKit.baseColor, team.awayKit.trimColor];
  if (colors.some((color) => !/^#[0-9a-f]{6}$/i.test(color))) throw new TypeError(`${team.id} contains an invalid color`);
  if (!team.badgeAsset.startsWith('/assets/teams/') || !team.badgeAsset.endsWith('.svg')) throw new TypeError(`${team.id} badge must be an original local SVG`);
  if (team.roster.length < 11) throw new RangeError(`${team.id} roster must contain a starting eleven`);
  if (new Set(team.roster.map((player) => player.id)).size !== team.roster.length) throw new Error(`${team.id} roster IDs must be unique`);
  for (const role of ['goalkeeper', 'defender', 'midfielder', 'attacker'] as const) {
    if (!team.roster.some((player) => player.role === role)) throw new Error(`${team.id} is missing ${role}`);
  }
}

const colorChannel = (hex: string, offset: number): number => Number.parseInt(hex.slice(offset, offset + 2), 16) / 255;
function linear(value: number): number { return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4; }
export function contrastRatio(a: string, b: string): number {
  const luminance = (color: string): number => 0.2126 * linear(colorChannel(color, 1)) + 0.7152 * linear(colorChannel(color, 3)) + 0.0722 * linear(colorChannel(color, 5));
  const first = luminance(a);
  const second = luminance(b);
  return (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05);
}
