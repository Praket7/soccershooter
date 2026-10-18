# Reference Hardware and Measurement Method

**Stage:** 01  
**Principle:** use hardware already available; do not require a purchase to pass development gates.

## 1. Reference profiles

### Reference Desktop

The current development machine is an Apple Silicon arm64 macOS computer. Stage 01 deliberately does **not** invent an exact SoC, GPU-core count, or RAM capacity that has not been measured. Every benchmark run must capture the actual machine/runtime facts available at execution time before the result is accepted.

Required environment record:
- operating system and version
- CPU/SoC model when exposed by the runtime/tool
- logical CPU count
- installed memory when available from trusted system tooling
- browser name/version
- graphics API and renderer string when available
- viewport resolution and device-pixel ratio
- graphics quality preset
- power mode if known
- commit SHA and build version

No benchmark may label itself `reference-desktop` if the environment record is missing.

### Constrained Fallback Profile

Until a real lower-spec machine is available, use the same available machine as a **development pressure profile**, not as a false claim of low-end hardware coverage:
- 1280×720 render viewport
- low graphics preset
- browser CPU throttling when the test harness supports it
- reduced device-memory assumptions where the browser harness can emulate them
- no simulation-rule changes

This profile is useful for regression pressure but does not replace later validation on actual lower-spec hardware. A real fallback machine can be added without changing simulation rules or measurement definitions.

## 2. Standard benchmark phases

Each performance run uses:
1. cold-load measurement when payload/loading is being tested;
2. warm-up period of at least 10 seconds for live-render scenarios;
3. measured interval of at least 60 seconds for frame-time claims unless the stage defines a longer scenario;
4. deterministic scenario/seed where gameplay state matters;
5. evidence output containing raw/aggregated measurements and environment metadata.

Do not report only the fastest sample.

## 3. Required performance measurements

### FPS

Record rendered frame timestamps during the measured interval.

- `frameTimeMs[i] = frameTimestamp[i] - frameTimestamp[i-1]`
- average FPS = `1000 / mean(frameTimeMs)`
- also report median FPS and sample count

Target for representative normal 3v3 live play: **>= 60 FPS** on Reference Desktop.

### 1% low

Sort valid measured frame times ascending and take the 99th-percentile frame time.

`1% low FPS = 1000 / p99(frameTimeMs)`

Target: **>= 50 FPS** on Reference Desktop in the representative scenario.

This definition is fixed so teams cannot switch between incompatible “1% low” formulas to improve a result.

### simulation step

Measure wall-clock duration of each authoritative fixed simulation step separately from rendering.

Report:
- mean simulation step ms
- median
- p95
- p99
- maximum
- fixed tick rate
- count of catch-up steps
- count of spiral-cap diagnostics

Rendering cadence must never determine the simulation result.

### render step

Measure the presentation/render update separately from simulation.

Report:
- mean render step ms
- median
- p95
- p99
- maximum
- frame count

### long task

In browsers that support it, use `PerformanceObserver` with the Long Tasks API. A **long task** is a main-thread task lasting more than **50 ms**.

Report:
- long task count
- total long-task duration
- maximum long-task duration
- timestamps/scenario phase for each occurrence when practical

A recurring >50 ms task during normal post-load gameplay is a defect.

### memory

Use the most reliable runtime/tool available and name it in evidence. Preferred order:
1. browser-specific measured user-agent memory API when supported;
2. browser performance tooling/DevTools capture;
3. process-level resident/heap measurements for headless Node tools.

Report memory in MB and specify whether the value is JS heap, process resident memory, browser estimate, GPU estimate, or another category. Do not compare unlike categories as though they were equivalent.

### draw call

For Three.js runtime rendering, record renderer statistics after the representative frame/interval, including draw calls and triangles where available (`renderer.info.render`).

Report:
- draw calls
- triangles
- geometries/textures if available
- quality preset
- scene ID

### payload

Measure a cold-cache initial load using transferred bytes from browser/network tooling or build manifest data.

Report separately:
- network transferred bytes
- uncompressed/resource bytes when available
- initial playable payload
- asynchronously streamed arena payload

Targets:
- initial playable transferred payload < 20 MB
- first premium arena streamed payload < 45 MB

## 4. Responsiveness timing

For later feel stages, instrumentation records:
- input capture timestamp
- tick when input enters simulation
- timestamp of first rendered acknowledgement

Derived metrics:
- input→simulation latency
- simulation→render acknowledgement latency
- total input→visible acknowledgement latency

Direct camera, movement, pass, and shot acknowledgement target: <= 1 rendered frame at 60 FPS where specified by the design.

## 5. Network fault profiles

Network simulation must be deterministic/reproducible when a seed is supported. Every run records the injected profile.

| Profile | RTT | Jitter | Packet loss | Purpose |
|---|---:|---:|---:|---|
| Local | 0 ms RTT | 0 ms | 0% | baseline correctness |
| Good WAN | 50 ms RTT | ±5 ms | 0% | common responsive remote play |
| Moderate WAN | 100 ms RTT | ±10 ms | 2% loss | prediction/reconciliation pressure |
| Adverse WAN | 150 ms RTT | ±20 ms | 5% loss | supported stress boundary |
| Loss-only | 50 ms RTT | ±5 ms | 2% loss | isolate loss behavior |
| Heavy-loss | 100 ms RTT | ±10 ms | 5% loss | duplicate/event integrity stress |

Later Stage 17 may add duplication and reordering profiles where practical. Those are additive and do not replace the required profiles above.

## 6. Evidence naming

Performance evidence uses:

`artifacts/perf/<stage>/<YYYY-MM-DD>/<commit>/<scenario>-<profile>.json`

If an artifact cannot be committed because it is large or machine-generated, the gate report records the workflow run/artifact identifier and exact reproduction command.

## 7. Benchmark validity

A performance result is invalid if:
- commit/build is unknown
- warm-up/measured interval is omitted where required
- browser/runtime is unknown
- scenario/seed is unknown for deterministic gameplay tests
- throttling is active but unreported
- debug tooling changes performance materially and is not disclosed
- frame-time outliers are manually deleted
- simulation rules differ between graphics profiles

## 8. Purchase-free rule

Failure to own a particular GPU or low-end PC does not authorize fabricated performance claims. Development gates use available hardware plus clearly labeled constrained profiles, and later public-alpha hardware coverage is expanded with real tester telemetry/playtest evidence.