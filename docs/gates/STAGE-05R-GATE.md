# Stage 05R — Engineering Gate

**Branch:** `integration/stages-05r-08-10`
**Scope:** gait-timed physical dribbling, contact provenance, presentation QA, strikes, camera response, control assistance, and regression/exploit coverage.

## Automated evidence

- `pnpm lint` — PASS.
- `pnpm typecheck` — PASS.
- `pnpm test` — PASS, 83 files / 342 tests.
- `pnpm test:e2e` — PASS, 51 tests; latest rendered-response run recorded 48 timing samples, p50 17.0 ms, p90 18.5 ms, max 18.8 ms; 24 W keydown acknowledgements all within one rendered frame, each with positive forward player-state movement (minimum 0.00556 m).
- `pnpm ball:fuzz` — PASS, 1,000,000 launches / 4,000,000 states / 0 failures; checksum `e0afd3f7`.
- `pnpm football:fuzz` — PASS, 250,000 mixed cases / 1,000,000 contact-plan states / 0 failures; checksum `8758b230`; max result speed `34.88992486315191` m/s.
- `pnpm football:balance` — PASS; all eight spam/exploit policies score below their timed or varied references.
- `pnpm determinism:headless` — PASS, 10,000 ticks; hash `d55b2d0b968372a5`.
- Stage 04 golden ball trajectories remain on the existing unchanged physics implementation; the contact planner only changes velocity/angular velocity at legal events.
- Carry tests and browser probes confirm planned foot/tick/surface IDs, free-ball frames, non-teleporting contacts, longer sprint spacing, and recoverable misses.
- `pnpm dribble:calibration` — PASS, 16 deterministic scenarios and 125 measured contacts; distributions are recorded below and in the reproducible runner.

## Owner gate still required

The prescribed Task 3 micro-playtest before migrating sprint/skills has no recorded owner result. The final 12-step Stage 05R human playtest and 8/10 feel scorecard also have not been performed. Automated evidence cannot certify responsiveness, contact believability, or mastery depth. The owner requested integration to `main`; that authorizes the requested push, but does not turn the pending sequencing or subjective playtests into passing results.

## Calibration evidence and remaining gaps

`pnpm dribble:calibration` records deterministic simulator distributions at seed `0x05a8c1` across 16 cases: straight carry, precision/slalom, 30/90/120/180-degree jog cuts, 30/60/90/120/180-degree sprint cuts, pressure from both sides, weak-foot selection, loose-ball recovery, and trap-to-exit. The report is reproduced by `tools/perf/dribble-calibration.test.ts`.

- Touch cadence: median 2.692 contacts/s across cases (p10 2.609, p90 3.000, max 3.750).
- Contact timing error: 125 contacts, p50/p90/max all 0 ticks.
- Ball distance at contact: median 0.6635 m (p10 0.2910, p90 1.1633, max 1.5707).
- Exit ball-speed / incoming ball-speed ratio: median 1.0908 (p90 1.4970, max 11.4785; the max is a low-speed pickup and shows this ratio should be interpreted as an impulse diagnostic, not a retention score).
- Turn braking: plant duration p50 0, p90 13, max 20 ticks; braking distance p50 0.4706 m, p90 1.9225 m, max 2.1324 m.
- Loose-ball fraction: p90 0.6444, max 0.6500 in the 90/120/180-degree jog cuts; all sprint cut cases are at or below 0.0389. This is a measured control-quality issue to tune, not a passing target.
- Input-to-motion direction response (simulated): 10 measured turn scenarios; p10 4 ticks, median 12, p90 20, max 24. The other six scenarios have no turn response and are excluded rather than reported as zero. The rendered browser response distribution is recorded below.

### Task 8 transition and rendered-response calibration

- `pnpm strike:calibration` runs the production gait-aware strike planner at seed-independent fixed inputs across 10 gait phases, two stride durations, and both strike kinds: 20 shot and 20 pass samples. Each has a legal contact; both delay distributions are 5–18 ticks (p50 15, p90 18). The deterministic regression is `tools/perf/strike-transition-calibration.test.ts`.
- The live Playwright carry-to-strike test jogs, resets the free ball into the control pocket, then requests each action and measures to the actual contact event on the practice simulation clock. Latest full E2E run: shot 5/5 contacts, 5–18 ticks (p50 17, p90 18); pass 5/5, 10–11 ticks (p50 10, p90 11). This is a small integration sample, while the deterministic matrix provides phase coverage.
- The browser response probe publishes `data-input-to-render-ms` after the WebGL draw and following animation-frame boundary, and exposes the render-frame ID for the input and its acknowledgement. A previous absolute-time gate failed on GitHub's headless runner (48 samples, min 20.8 ms, p50 31.1 ms, p90 37.1 ms, max 39.2 ms) despite passing locally, so acceptance checks the plan's frame-count invariant directly: every recorded input must be acknowledged within one rendered frame. The focused test now pairs each W keydown with its acknowledgement and verifies a forward player-state change by that acknowledgement. Three focused repeats passed: each recorded 24 keydown acknowledgements, p90/max frame delta 1/1, and minimum forward change 0.00556 m. Timing telemetry across those repeats ranged from 7.3–13.6 ms minimum, 16.8–17.9 ms p50, 18.1–18.6 ms p90, and 19.0–19.4 ms maximum. The latest full 51-test E2E run recorded 48 timing samples (p50 17.0 ms, p90 18.5 ms, max 18.8 ms), 24 keydown frame deltas (p90/max 1/1), and 24 positive movement responses (minimum 0.00556 m). Milliseconds remain descriptive because wall-clock scheduling differs by runner. This establishes simulation-state response at render-loop acknowledgement; it does not measure physical display photons, which remain unmeasured. The distribution is collected by `e2e/movement.spec.ts`.

The plan's pass/shot transition calibration and browser rendered-response distribution now have reproducible instrumentation and recorded evidence. The sharp jog-cut loose-ball fraction remains a feel/playability point for tuning and owner review. Stage 05R remains blocked on owner sequencing and the 12-step feel scorecard; automated evidence does not resolve those human gates.
