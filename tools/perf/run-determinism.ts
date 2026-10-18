import { REFERENCE_TRACE_TICKS, runReferenceTrace } from '../../packages/sim/src/referenceTrace';

const requestedTicks = process.argv[2] ? Number.parseInt(process.argv[2], 10) : REFERENCE_TRACE_TICKS;
if (!Number.isSafeInteger(requestedTicks) || requestedTicks <= 0) {
  console.error('Usage: pnpm determinism:headless [positive-tick-count]');
  process.exit(2);
}

const startedAt = performance.now();
const result = runReferenceTrace(requestedTicks);
const durationMs = performance.now() - startedAt;

console.log(JSON.stringify({
  runner: 'node-headless',
  simVersion: 1,
  tickHz: 30,
  ticks: result.ticks,
  seed: result.seed,
  hash: result.hash,
  durationMs: Number(durationMs.toFixed(3)),
}));

if (result.ticks !== requestedTicks || !/^[0-9a-f]{16}$/.test(result.hash)) {
  console.error('Headless determinism runner produced an invalid result.');
  process.exit(1);
}
