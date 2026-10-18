import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { basename, extname, relative, resolve } from 'node:path';

const root = resolve(process.argv[2] ?? process.cwd());
const scanRoots = ['apps', 'packages'];
const sourceExtensions = new Set(['.ts', '.tsx', '.js', '.mjs', '.cjs', '.html']);
const ignoredDirectories = new Set(['node_modules', 'dist', 'build', 'coverage', '.git']);
const forbidden = /(?:^|["'`])(?:\.\.\/|\.\/|\/)*private\/reference-content(?:\/|["'`])/g;
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
  let match;
  while ((match = forbidden.exec(text)) !== null) {
    const line = text.slice(0, match.index).split('\n').length;
    violations.push(`${relative(root, path)}:${line}: production source references private/reference-content`);
  }
  forbidden.lastIndex = 0;
}

for (const path of scanRoots) walk(resolve(root, path));

if (violations.length > 0) {
  console.error('Private reference content guard failed:');
  for (const violation of violations) console.error(`- ${violation}`);
  process.exit(1);
}

console.log('Private reference content guard passed.');
