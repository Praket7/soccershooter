import { describe, expect, test } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import {
  ASSET_KINDS,
  GATE_STAGE_IDS,
  gatePathForStage,
  validateProvenanceEntry,
  validateTelemetryEvent,
} from './events';

const root = process.cwd();

function read(path: string): string {
  return readFileSync(join(root, path), 'utf8');
}

function expectInvalid(result: { ok: boolean; errors: readonly string[] }, needle: string) {
  expect(result.ok).toBe(false);
  expect(result.errors.join('\n').toLowerCase()).toContain(needle.toLowerCase());
}

describe('privacy-preserving telemetry contract', () => {
  const validBenchmarkEvent = {
    eventVersion: 1,
    eventType: 'benchmark_sample',
    sessionId: 'session-ephemeral-01',
    elapsedMs: 2500,
    buildVersion: 'dev',
    contentMode: 'FICTIONAL_PUBLIC',
    metrics: {
      fps: 60,
      onePercentLowFps: 54,
      simStepMs: 1.2,
      renderStepMs: 5.5,
      longTaskCount: 0,
      memoryMb: 256,
      drawCalls: 240,
      payloadBytes: 8_000_000,
    },
  } as const;

  test('accepts a known benchmark event with only approved fields', () => {
    expect(validateTelemetryEvent(validBenchmarkEvent)).toEqual({ ok: true, errors: [] });
  });

  test.each([
    ['email', 'student@example.com'],
    ['name', 'Example Person'],
    ['userId', 'user-123'],
    ['accountId', 'account-123'],
    ['ipAddress', '203.0.113.4'],
    ['deviceId', 'device-123'],
    ['latitude', 42.9],
    ['phone', '+1-555-0100'],
  ])('rejects identifying top-level field %s', (field, value) => {
    const result = validateTelemetryEvent({ ...validBenchmarkEvent, [field]: value });
    expectInvalid(result, field);
  });

  test('rejects identifying fields nested inside telemetry payloads', () => {
    const result = validateTelemetryEvent({
      ...validBenchmarkEvent,
      metrics: { ...validBenchmarkEvent.metrics, email: 'nested@example.com' },
    });
    expectInvalid(result, 'email');
  });

  test('rejects unexpected non-identifying fields rather than silently collecting them', () => {
    const result = validateTelemetryEvent({ ...validBenchmarkEvent, favoriteColor: 'blue' });
    expectInvalid(result, 'favoriteColor');
  });
});

describe('asset provenance shipping contract', () => {
  const validEntry = {
    id: 'font-inter',
    kind: 'font',
    sourceType: 'third-party',
    source: 'https://github.com/rsms/inter',
    author: 'Rasmus Andersson',
    license: 'OFL-1.1',
    modifications: 'Subset at build time only',
    contentMode: 'FICTIONAL_PUBLIC',
    publicSafe: true,
    shippingStatus: 'shippable',
  } as const;

  test('accepts a complete shippable provenance entry', () => {
    expect(validateProvenanceEntry(validEntry)).toEqual({ ok: true, errors: [] });
  });

  test('a shippable entry requires source, author, and license', () => {
    for (const field of ['source', 'author', 'license'] as const) {
      const candidate = { ...validEntry, [field]: '' };
      expectInvalid(validateProvenanceEntry(candidate), field);
    }
  });

  test('REFERENCE_PRIVATE content can never be marked public-safe or shippable', () => {
    expectInvalid(
      validateProvenanceEntry({
        ...validEntry,
        contentMode: 'REFERENCE_PRIVATE',
        publicSafe: true,
        shippingStatus: 'shippable',
      }),
      'REFERENCE_PRIVATE',
    );
  });

  test('provenance covers every required asset class', () => {
    expect(new Set(ASSET_KINDS)).toEqual(
      new Set(['image', 'mesh', 'texture', 'audio', 'animation', 'font', 'code']),
    );
  });
});

describe('stage gate contract', () => {
  test('defines every numbered gate plus Stage 17A', () => {
    const required = [
      '01','02','03','04','05','06','07','08','09','10',
      '11','12','13','14','15','16','17','17A','18','19','20',
    ];
    expect(GATE_STAGE_IDS).toEqual(required);
    for (const id of required) {
      expect(gatePathForStage(id)).toBe(`docs/gates/STAGE-${id}-GATE.md`);
    }
  });

  test('every stage plan has an exit gate and is represented in the quality matrix', () => {
    const stageDir = join(root, 'docs/superpowers/plans/stages');
    const qualityBar = read('docs/QUALITY_BAR.md');
    const plans = readdirSync(stageDir).filter((name) => name.endsWith('.md'));

    expect(plans.length).toBe(21);
    for (const filename of plans) {
      const stageText = read(`docs/superpowers/plans/stages/${filename}`);
      expect(stageText).toContain('## Exit gate');
      const id = filename.match(/^(\d{2}A?)-/)?.[1];
      expect(id, `stage id missing for ${filename}`).toBeTruthy();
      expect(qualityBar).toContain(`| ${id} |`);
    }
  });

  test('QUALITY_BAR has no unresolved placeholder markers', () => {
    const qualityBar = read('docs/QUALITY_BAR.md');
    expect(qualityBar).not.toMatch(/\b(?:TODO|TBD|FIXME)\b|<TBD>|<TODO>/i);
  });
});

describe('measurement documentation contract', () => {
  test('reference hardware defines all required performance and network measurements', () => {
    const hardware = read('docs/REFERENCE_HARDWARE.md').toLowerCase();
    for (const term of [
      'fps', '1% low', 'simulation step', 'render step', 'long task',
      'memory', 'draw call', 'payload', '50 ms rtt', '100 ms rtt',
      '150 ms rtt', 'jitter', '2% loss', '5% loss',
    ]) {
      expect(hardware, `missing measurement term: ${term}`).toContain(term);
    }
  });

  test('playtest scorecard contains every required feel dimension and rematch signal', () => {
    const scorecard = read('docs/PLAYTEST_SCORECARD.md').toLowerCase();
    for (const term of [
      'movement responsiveness', 'camera comfort', 'first-touch predictability',
      'passing satisfaction', 'shooting satisfaction', 'defensive fairness',
      'teammate usefulness', 'readability', 'desire to rematch',
    ]) {
      expect(scorecard, `missing scorecard term: ${term}`).toContain(term);
    }
  });

  test('asset provenance documentation names every required registry field and asset class', () => {
    const provenance = read('docs/ASSET_PROVENANCE.md').toLowerCase();
    for (const term of [
      'source', 'author', 'license', 'modifications', 'shipping status',
      'image', 'mesh', 'texture', 'audio', 'animation', 'font', 'code',
    ]) {
      expect(provenance, `missing provenance term: ${term}`).toContain(term);
    }
  });
});
