# Performance and Determinism Evidence Contract

`tools/perf` will contain executable performance tooling in later stages. Stage 01 freezes the output contract so later implementations cannot redefine a metric after seeing results.

## Required benchmark record

Every benchmark record is associated with:
- schema version
- stage ID
- commit SHA / build version
- scenario ID
- deterministic seed when applicable
- hardware profile (`reference-desktop`, `constrained-fallback`, or explicitly named external profile)
- OS/runtime/browser/graphics information
- viewport and graphics preset
- warm-up duration
- measurement duration
- sample count
- timestamp

Performance values use the definitions in `docs/REFERENCE_HARDWARE.md`.

## Canonical JSON shape

```json
{
  "schemaVersion": 1,
  "stageId": "02",
  "commit": "<git-sha>",
  "scenarioId": "foundation-determinism",
  "seed": 12345,
  "environment": {
    "profile": "reference-desktop",
    "os": "captured-at-run-time",
    "runtime": "captured-at-run-time",
    "renderer": "captured-at-run-time",
    "viewport": [1920, 1080],
    "qualityPreset": "default"
  },
  "window": {
    "warmupSeconds": 10,
    "measuredSeconds": 60,
    "frameSamples": 3600
  },
  "metrics": {
    "fps": 60,
    "onePercentLowFps": 50,
    "simStepMs": {"mean": 0, "p95": 0, "p99": 0, "max": 0},
    "renderStepMs": {"mean": 0, "p95": 0, "p99": 0, "max": 0},
    "longTasks": {"count": 0, "totalMs": 0, "maxMs": 0},
    "memoryMb": {"value": 0, "category": "declared-by-harness"},
    "drawCalls": 0,
    "triangles": 0,
    "payloadBytes": {"initialTransferred": 0, "arenaTransferred": 0}
  }
}
```

Zeroes above demonstrate field shape only; they are never acceptable as fabricated measured results.

## Input-to-visible timing record

Later feel stages append timestamped samples:

```json
{
  "action": "move",
  "inputTimestampMs": 0,
  "simulationTick": 0,
  "simulationAppliedTimestampMs": 0,
  "firstRenderedAcknowledgementMs": 0
}
```

The harness computes input→simulation and input→visible latency rather than relying on subjective timing claims.

## Fixed-step diagnostics

Every fixed-step benchmark capable of falling behind reports:
- catch-up steps executed per presentation frame
- configured maximum catch-up steps
- count of cap activations
- backlog/discard diagnostic if the architecture allows backlog trimming
- simulation tick before/after the event

A cap activation must be visible in diagnostics. Silent time distortion is forbidden.

## Determinism evidence

A deterministic run record contains:
- sim/build version
- seed
- tick rate
- tick count
- serialized input-trace hash
- final simulation-state hash
- presentation cadence used by the harness

Repeated-run output should make mismatches easy to diff rather than emit only a boolean.

## Physics golden cases

Golden physics data follows the contract in `docs/QUALITY_BAR.md` and is stored under a versioned path such as:

`tools/perf/golden/physics/<case-id>.json`

Required fields:
- case ID
- sim version
- seed
- tick/substep configuration
- initial state
- input/contact events with ticks
- environment coefficients
- expected sample states
- expected final state hash
- explicit tolerances where permitted
- rationale/regression link

Golden expectations are not rewritten merely to make a failing test green. Intentional behavior changes require a recorded ruling/review.

## Artifact naming

Preferred output path:

`artifacts/perf/<stage>/<date>/<commit>/<scenario>-<profile>.json`

For CI-only artifacts, the gate report records workflow run ID, artifact name, and reproduction command.

## Failure policy

The harness exits nonzero when a stage has a hard budget and the measured result violates it. For exploratory benchmarks without a hard gate, the record still reports the miss clearly and may not label the run as passing.