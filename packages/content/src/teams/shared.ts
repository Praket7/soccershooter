import type { PlayerDefinition, PlayerRole } from './schema';

export function makeRoster(prefix: string, surnames: readonly string[], styles: readonly string[]): readonly PlayerDefinition[] {
  const roles: readonly PlayerRole[] = ['goalkeeper', 'defender', 'defender', 'defender', 'defender', 'midfielder', 'midfielder', 'midfielder', 'attacker', 'attacker', 'attacker'];
  return roles.map((role, index) => ({
    id: `${prefix}-player-${String(index + 1).padStart(2, '0')}`,
    displayName: `${['Ari', 'Milo', 'Niko', 'Sami', 'Tavi', 'Luca', 'Remy', 'Ivo', 'Kian', 'Enzo', 'Noa'][index]} ${surnames[index]}`,
    number: index + 1,
    role,
    preferredFoot: index % 3 === 0 ? 'left' : 'right',
    styleTags: [styles[index % styles.length]!],
  }));
}
