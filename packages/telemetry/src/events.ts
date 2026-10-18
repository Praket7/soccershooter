export const ASSET_KINDS = [
  'image',
  'mesh',
  'texture',
  'audio',
  'animation',
  'font',
  'code',
] as const;

export type AssetKind = (typeof ASSET_KINDS)[number];

export const GATE_STAGE_IDS = [
  '01','02','03','04','05','06','07','08','09','10',
  '11','12','13','14','15','16','17','17A','18','19','20',
] as const;

export type GateStageId = (typeof GATE_STAGE_IDS)[number];
export type ContentMode = 'FICTIONAL_PUBLIC' | 'REFERENCE_PRIVATE';

export interface ValidationResult {
  ok: boolean;
  errors: readonly string[];
}

export interface BenchmarkMetrics {
  fps: number;
  onePercentLowFps: number;
  simStepMs: number;
  renderStepMs: number;
  longTaskCount: number;
  memoryMb: number;
  drawCalls: number;
  payloadBytes: number;
}

export interface BenchmarkSampleEvent {
  eventVersion: 1;
  eventType: 'benchmark_sample';
  sessionId: string;
  elapsedMs: number;
  buildVersion: string;
  contentMode: ContentMode;
  metrics: BenchmarkMetrics;
}

export interface PlaytestScoreEvent {
  eventVersion: 1;
  eventType: 'playtest_score';
  sessionId: string;
  elapsedMs: number;
  buildVersion: string;
  contentMode: ContentMode;
  scenarioId: string;
  scores: Record<string, number>;
  rematchStarted: boolean;
}

export interface StageGateResultEvent {
  eventVersion: 1;
  eventType: 'stage_gate_result';
  sessionId: string;
  elapsedMs: number;
  buildVersion: string;
  contentMode: ContentMode;
  stageId: GateStageId;
  pass: boolean;
  checkCounts: { passed: number; failed: number };
}

export interface BalanceTournamentSummaryEvent {
  eventVersion: 1;
  eventType: 'balance_tournament_summary';
  sessionId: string;
  elapsedMs: number;
  buildVersion: string;
  contentMode: ContentMode;
  tournament: {
    seed: number;
    matches: number;
    exploitFlags: number;
  };
}

export type TelemetryEvent =
  | BenchmarkSampleEvent
  | PlaytestScoreEvent
  | StageGateResultEvent
  | BalanceTournamentSummaryEvent;

export interface ProvenanceEntry {
  id: string;
  kind: AssetKind;
  sourceType: 'original' | 'third-party';
  source: string;
  author: string;
  license: string;
  modifications: string;
  contentMode: ContentMode;
  publicSafe: boolean;
  shippingStatus: 'shippable' | 'blocked' | 'reference-only';
}

const BANNED_TELEMETRY_KEYS = new Set([
  'name',
  'fullname',
  'firstname',
  'lastname',
  'displayname',
  'username',
  'email',
  'userid',
  'accountid',
  'oauthid',
  'providerid',
  'ip',
  'ipaddress',
  'deviceid',
  'advertisingid',
  'phone',
  'address',
  'location',
  'latitude',
  'longitude',
  'postalcode',
  'birthdate',
  'dateofbirth',
]);

const BASE_EVENT_KEYS = new Set([
  'eventVersion',
  'eventType',
  'sessionId',
  'elapsedMs',
  'buildVersion',
  'contentMode',
]);

const EVENT_KEYS: Record<string, ReadonlySet<string>> = {
  benchmark_sample: new Set([...BASE_EVENT_KEYS, 'metrics']),
  playtest_score: new Set([...BASE_EVENT_KEYS, 'scenarioId', 'scores', 'rematchStarted']),
  stage_gate_result: new Set([...BASE_EVENT_KEYS, 'stageId', 'pass', 'checkCounts']),
  balance_tournament_summary: new Set([...BASE_EVENT_KEYS, 'tournament']),
};

const BENCHMARK_METRIC_KEYS = new Set([
  'fps',
  'onePercentLowFps',
  'simStepMs',
  'renderStepMs',
  'longTaskCount',
  'memoryMb',
  'drawCalls',
  'payloadBytes',
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function normalizedKey(key: string): string {
  return key.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
}

function collectBannedKeys(value: unknown, path = '$', errors: string[] = []): string[] {
  if (Array.isArray(value)) {
    value.forEach((item, index) => collectBannedKeys(item, `${path}[${index}]`, errors));
    return errors;
  }
  if (!isRecord(value)) return errors;

  for (const [key, child] of Object.entries(value)) {
    if (BANNED_TELEMETRY_KEYS.has(normalizedKey(key))) {
      errors.push(`${path}.${key}: identifying field is forbidden`);
    }
    collectBannedKeys(child, `${path}.${key}`, errors);
  }
  return errors;
}

function nonEmptyString(value: unknown): boolean {
  return typeof value === 'string' && value.trim().length > 0;
}

function finiteNumber(value: unknown): boolean {
  return typeof value === 'number' && Number.isFinite(value);
}

function checkExactKeys(
  value: Record<string, unknown>,
  allowed: ReadonlySet<string>,
  path: string,
  errors: string[],
) {
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) errors.push(`${path}.${key}: unexpected field`);
  }
}

export function validateTelemetryEvent(value: unknown): ValidationResult {
  const errors = collectBannedKeys(value);
  if (!isRecord(value)) return { ok: false, errors: [...errors, '$: event must be an object'] };

  const eventType = value.eventType;
  if (typeof eventType !== 'string' || !(eventType in EVENT_KEYS)) {
    errors.push('$.eventType: unsupported event type');
    return { ok: false, errors };
  }

  checkExactKeys(value, EVENT_KEYS[eventType], '$', errors);

  if (value.eventVersion !== 1) errors.push('$.eventVersion: must equal 1');
  if (!nonEmptyString(value.sessionId) || (value.sessionId as string).length > 64) {
    errors.push('$.sessionId: must be a non-empty ephemeral identifier up to 64 characters');
  }
  if (!finiteNumber(value.elapsedMs) || (value.elapsedMs as number) < 0) {
    errors.push('$.elapsedMs: must be a non-negative finite number');
  }
  if (!nonEmptyString(value.buildVersion)) errors.push('$.buildVersion: required');
  if (value.contentMode !== 'FICTIONAL_PUBLIC' && value.contentMode !== 'REFERENCE_PRIVATE') {
    errors.push('$.contentMode: invalid content mode');
  }

  if (eventType === 'benchmark_sample') {
    if (!isRecord(value.metrics)) {
      errors.push('$.metrics: required object');
    } else {
      checkExactKeys(value.metrics, BENCHMARK_METRIC_KEYS, '$.metrics', errors);
      for (const key of BENCHMARK_METRIC_KEYS) {
        if (!finiteNumber(value.metrics[key])) errors.push(`$.metrics.${key}: must be finite number`);
      }
    }
  }

  if (eventType === 'playtest_score') {
    if (!nonEmptyString(value.scenarioId)) errors.push('$.scenarioId: required');
    if (!isRecord(value.scores)) errors.push('$.scores: required object');
    if (typeof value.rematchStarted !== 'boolean') errors.push('$.rematchStarted: must be boolean');
  }

  if (eventType === 'stage_gate_result') {
    if (!GATE_STAGE_IDS.includes(value.stageId as GateStageId)) errors.push('$.stageId: invalid stage id');
    if (typeof value.pass !== 'boolean') errors.push('$.pass: must be boolean');
    if (!isRecord(value.checkCounts)) errors.push('$.checkCounts: required object');
  }

  if (eventType === 'balance_tournament_summary') {
    if (!isRecord(value.tournament)) errors.push('$.tournament: required object');
  }

  return { ok: errors.length === 0, errors };
}

export function validateProvenanceEntry(value: unknown): ValidationResult {
  const errors: string[] = [];
  if (!isRecord(value)) return { ok: false, errors: ['$: provenance entry must be an object'] };

  const allowed = new Set([
    'id',
    'kind',
    'sourceType',
    'source',
    'author',
    'license',
    'modifications',
    'contentMode',
    'publicSafe',
    'shippingStatus',
  ]);
  checkExactKeys(value, allowed, '$', errors);

  if (!nonEmptyString(value.id)) errors.push('$.id: required');
  if (!ASSET_KINDS.includes(value.kind as AssetKind)) errors.push('$.kind: unsupported asset kind');
  if (value.sourceType !== 'original' && value.sourceType !== 'third-party') {
    errors.push('$.sourceType: must be original or third-party');
  }
  if (!nonEmptyString(value.modifications)) errors.push('$.modifications: required, use "none" when unchanged');
  if (value.contentMode !== 'FICTIONAL_PUBLIC' && value.contentMode !== 'REFERENCE_PRIVATE') {
    errors.push('$.contentMode: invalid content mode');
  }
  if (typeof value.publicSafe !== 'boolean') errors.push('$.publicSafe: must be boolean');
  if (!['shippable', 'blocked', 'reference-only'].includes(String(value.shippingStatus))) {
    errors.push('$.shippingStatus: invalid shipping status');
  }

  if (value.shippingStatus === 'shippable') {
    for (const field of ['source', 'author', 'license'] as const) {
      if (!nonEmptyString(value[field])) errors.push(`$.${field}: required for shippable asset`);
    }
    if (value.contentMode !== 'FICTIONAL_PUBLIC') {
      errors.push('REFERENCE_PRIVATE content cannot be shippable');
    }
    if (value.publicSafe !== true) errors.push('$.publicSafe: shippable asset must be public-safe');
  }

  if (value.contentMode === 'REFERENCE_PRIVATE') {
    if (value.publicSafe !== false) errors.push('REFERENCE_PRIVATE content cannot be public-safe');
    if (value.shippingStatus === 'shippable') errors.push('REFERENCE_PRIVATE content cannot be shippable');
  }

  return { ok: errors.length === 0, errors };
}

export function gatePathForStage(id: string): string {
  if (!GATE_STAGE_IDS.includes(id as GateStageId)) {
    throw new Error(`Unknown SoccerShooter stage id: ${id}`);
  }
  return `docs/gates/STAGE-${id}-GATE.md`;
}
