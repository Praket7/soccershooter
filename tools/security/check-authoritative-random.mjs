import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { resolve, relative, extname, basename } from 'node:path';

const root = resolve(process.argv[2] ?? process.cwd());
const authoritativeRoots = [
  'packages/sim',
  'packages/physics',
  'packages/bots',
  'packages/protocol',
  'packages/progression',
  'packages/replay',
];
const sourceExtensions = new Set(['.ts', '.tsx', '.js', '.mjs', '.cjs']);
const ignoredDirectories = new Set(['node_modules', 'dist', 'build', 'coverage', '.git']);
const violations = [];

function walk(path) {
  if (!existsSync(path)) return;
  const stats = statSync(path);
  if (stats.isDirectory()) {
    if (ignoredDirectories.has(basename(path))) return;
    for (const entry of readdirSync(path)) walk(resolve(path, entry));
    return;
  }
  if (!sourceExtensions.has(extname(path))) return;
  if (/\.(?:test|spec)\.[cm]?[jt]sx?$/.test(path)) return;

  const text = readFileSync(path, 'utf8');
  const pattern = /\bMath\s*\.\s*random\s*\(/g;
  let match;
  while ((match = pattern.exec(text)) !== null) {
    const line = text.slice(0, match.index).split('\n').length;
    violations.push(`${relative(root, path)}:${line}: Math.random() is forbidden in authoritative source`);
  }
}

for (const path of authoritativeRoots) walk(resolve(root, path));

if (violations.length > 0) {
  console.error('Authoritative randomness guard failed:');
  for (const violation of violations) console.error(`- ${violation}`);
  process.exit(1);
}

console.log('Authoritative randomness guard passed.');
