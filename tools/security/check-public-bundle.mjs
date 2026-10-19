import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { basename, extname, relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const root = resolve(process.argv[2] ?? process.cwd());
const bundleRoot = resolve(root, 'apps/web/dist');
const ignoredDirectories = new Set(['node_modules', 'coverage']);
const markers = [
  /private\/reference-content(?:\/|\b)/i,
  /\bprivateRoster\b/i,
  /\bPrivateReferenceRoster\b/i,
];

export function findPublicBundleViolations(path, text) {
  return markers.filter((marker) => marker.test(text)).map((marker) => `${path}: matched ${marker}`);
}

const violations = [];
function walk(path) {
  if (!existsSync(path)) return;
  const info = statSync(path);
  if (info.isDirectory()) {
    if (ignoredDirectories.has(basename(path))) return;
    for (const entry of readdirSync(path)) walk(resolve(path, entry));
    return;
  }
  if (!['.js', '.mjs', '.cjs', '.html', '.svg', '.json', '.css'].includes(extname(path))) return;
  violations.push(...findPublicBundleViolations(relative(root, path), readFileSync(path, 'utf8')));
}

walk(bundleRoot);
const isCli = process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href;
if (!isCli) {
  // Imported by tests to exercise the scanner without requiring a production build.
} else if (!existsSync(bundleRoot)) {
  console.error(`Public bundle directory is missing: ${relative(root, bundleRoot)}`);
  process.exit(1);
}
if (isCli && violations.length) {
  console.error('Public bundle content guard failed:');
  for (const violation of violations) console.error(`- ${violation}`);
  process.exit(1);
}
if (isCli) console.log('Public bundle contains no private reference paths or roster markers.');
