import { describe, expect, test } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const repoRoot = process.cwd();
const randomGuard = resolve(repoRoot, 'tools/security/check-authoritative-random.mjs');
const privateGuard = resolve(repoRoot, 'tools/security/check-private-imports.mjs');

function run(script: string, root: string) {
  return spawnSync(process.execPath, [script, root], {
    cwd: repoRoot,
    encoding: 'utf8',
  });
}

function tempRepo(): string {
  return mkdtempSync(join(tmpdir(), 'soccershooter-guard-'));
}

describe('authoritative randomness guard', () => {
  test('accepts authoritative source without ambient randomness', () => {
    const root = tempRepo();
    const sim = join(root, 'packages/sim/src');
    mkdirSync(sim, { recursive: true });
    writeFileSync(join(sim, 'ok.ts'), 'export const deterministic = 42;\n');
    expect(run(randomGuard, root).status).toBe(0);
  });

  test('rejects Math.random in authoritative source', () => {
    const root = tempRepo();
    const sim = join(root, 'packages/sim/src');
    mkdirSync(sim, { recursive: true });
    const forbidden = ['Math', 'random()'].join('.');
    writeFileSync(join(sim, 'bad.ts'), `export const forbidden = ${forbidden};\n`);
    const result = run(randomGuard, root);
    expect(result.status).not.toBe(0);
    expect(`${result.stdout}\n${result.stderr}`).toMatch(/Math\.random|authoritative|random/i);
  });
});

describe('private reference content guard', () => {
  test('accepts public source with no private reference import', () => {
    const root = tempRepo();
    const web = join(root, 'apps/web/src');
    mkdirSync(web, { recursive: true });
    writeFileSync(join(web, 'main.ts'), "export const mode = 'FICTIONAL_PUBLIC';\n");
    expect(run(privateGuard, root).status).toBe(0);
  });

  test('rejects a production import of private/reference-content', () => {
    const root = tempRepo();
    const web = join(root, 'apps/web/src');
    mkdirSync(web, { recursive: true });
    writeFileSync(
      join(web, 'bad.ts'),
      "import '../../../private/reference-content/real-roster.json';\nexport {};\n",
    );
    const result = run(privateGuard, root);
    expect(result.status).not.toBe(0);
    expect(`${result.stdout}\n${result.stderr}`).toMatch(/private|reference_private|reference-content/i);
  });
});
