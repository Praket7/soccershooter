# Stage 04 Final Audit — Premium Football Physics

**Stage:** 04  
**Purpose:** final owner-data, calibration, numerical-stability, and plan-compliance audit before Stage 05  
**Decision:** **PASS CANDIDATE — merge only after this documentation-inclusive head is green**

## Why this audit exists

After the original Stage 04 gate passed, the owner ran the full local test suite and supplied an additional Ball Lab CSV (`soccershooter-ball-chip.csv`) plus explicit direction to make one final accuracy pass. The owner also requested that the real simulation be run directly in the chat environment rather than relying only on GitHub Actions.

The final pass therefore re-read the binding Stage 04 plan and design constraints, analyzed the owner CSV numerically, ran the actual shared TypeScript physics code headlessly, calibrated turf behavior against professional football-surface reference envelopes, stress-tested full trajectories, checked numerical substep sensitivity, and reran the full repository verification pipeline.

Stage 05 remains untouched.

## Owner CSV finding

The supplied custom chip trace was numerically stable:
- initial speed: `4.5 m/s`
- elevation: `34°`
- angular velocity: `+34 rad/s` around X (`top` axis in Ball Lab coordinates)
- no NaN / Infinity
- no kinetic or mechanical energy gain
- clean 120 Hz sample cadence

However, the file terminated at `t = 0.900 s` on the first non-bouncing grounded sample while the ball was still moving at approximately `3.4107 m/s` with about `31.0 rad/s` spin. That meant a supposedly complete audit CSV omitted the rolling/settling phase owned by Stage 04.

### Repair

- `buildCompleteExportTrace` now advances the same authoritative `stepBall` integrator at 120 Hz until translational settlement;
- CSV export includes flight, bounce, roll, and settlement rather than stopping on first grounding;
- live Ball Lab playback uses the same settlement policy;
- the old 8 s live hard-stop no longer freezes a still-moving roll;
- a deterministic 20 s safety cap prevents unbounded debug runs;
- regression reproduces the owner's exact launch state and requires export to continue through roll settlement.

## Turf calibration audit

The prior match profile was stable but under-calibrated against professional-surface ball interaction:
- old `groundRestitution = 0.56` produced about `0.571 m` rebound from a 2 m underside drop;
- old `rollingResistance = 0.34` produced about `13.93 m` travel from the 1 m ramp-equivalent no-slip roll probe.

The Stage 04 final profile is now:
- `groundRestitution = 0.62`
- `rollingResistance = 0.80`
- `turfFriction = 0.72` unchanged
- `groundAngularDamping = 0.24` unchanged

With the exact Stage 04 integrator this produces:
- approximately `0.699 m` rebound from the 2 m underside drop;
- approximately `6.653 m` roll from the 1 m ramp-equivalent no-slip launch.

These values intentionally sit near the middle of the documented professional football-turf rebound/roll envelopes instead of merely scraping a boundary. Flight drag, Magnus, spin decay, knuckle, goal-frame restitution, and frame tangential retention were not changed because the owner trace and independent simulation audits did not show a justified flight-model defect.

New regressions require:
- 2 m drop rebound within `0.60–0.85 m`;
- 1 m ramp-equivalent roll within `4–8 m`;
- grounded coupling remains energy-dissipative.

## Direct in-chat execution of the real physics

The shared Stage 04 TypeScript physics sources were reconstructed from the branch in the chat execution environment and compiled with TypeScript. The tests below executed the actual Stage 04 equations and state transitions, not a Python approximation.

### 10,000 full legal trajectory stress run

Each randomized launch used Ball Lab-legal ranges and ran for up to 15 seconds at the authoritative 120 Hz cadence with goal-frame contacts enabled.

Results:

```text
full trajectories: 10,000
NaN / Infinity failures: 0
turf penetrations: 0
mechanical-energy gain events: 0
shots still translating after 15 s: 0
duplicate determinism mismatches: 0 / 100
maximum sampled speed: 39.8072356341 m/s
maximum sampled spin: 215.7168004679 rad/s
maximum absolute sampled coordinate: 132.7614462031 m
maximum positive mechanical-energy delta: 0
```

The slowest random legal trajectory settled by roughly 13 seconds, leaving substantial margin under the 20 second Ball Lab safety cap.

### Golden-family spot audit

All Stage 04 launch families remained finite and learnable after turf recalibration:
- Driven
- Straight
- Curl
- Power
- Loft
- Chip
- Knuckle
- Post rebound

The post benchmark continues to make an airborne right-post contact. Flight behavior before turf contact is unchanged by the turf-only coefficient adjustment.

### Substep-sensitivity audit

Representative 120 Hz trajectories were compared with the same equations integrated at 240 Hz for 1.25 seconds.

Approximate 120 Hz vs 240 Hz position deltas:
- Straight: `0.029 m`
- Curl: `0.031 m`
- Knuckle: `0.020 m`
- Power: `0.035 m`

Velocity deltas were approximately `0.09–0.11 m/s`. The 120 Hz fixed substep remains an appropriate quality/performance tradeoff; there is no evidence justifying a more expensive runtime cadence.

## Stage 04 plan compliance

### Required tasks

- [x] coefficient-table driven quadratic drag
- [x] spin-parameter Magnus lift and saturation
- [x] deterministic spin decay
- [x] deterministic seeded bounded knuckle behavior
- [x] bounce, friction, slide-to-roll coupling, rolling resistance, damping, settlement
- [x] professional-surface rebound/roll calibration regressions
- [x] posts/crossbar collision benchmark
- [x] swept high-speed frame collision protection
- [x] whole-ball goal-plane crossing
- [x] predictor using the same authoritative equations
- [x] golden trajectory fixtures
- [x] deterministic random fuzz launcher
- [x] one-million-launch CI fuzz
- [x] interactive Ball Lab
- [x] launch speed/elevation/aim controls
- [x] spin axis/rate controls
- [x] coefficient-profile control
- [x] slow motion
- [x] actual and predicted trajectory display
- [x] expected landing marker
- [x] complete CSV flight/bounce/roll trace export

### Golden behavior checks

- [x] zero-spin shot stays near its vertical plane
- [x] sidespin curves in the correct `omega × velocity` direction
- [x] topspin drops sooner than zero-spin equivalent
- [x] backspin carries/floats longer
- [x] increasing legal sidespin increases deviation until lift saturation
- [x] low-spin knuckle is bounded and same-seed repeatable
- [x] bounce/roll are stable and energy-dissipative
- [x] post/crossbar impact cannot create an energy explosion
- [x] high-speed frame tunneling protection
- [x] no NaN/Infinity across one million CI launches
- [x] owner CSV regression retained
- [x] full-trajectory stress audit retained as recorded evidence

### Stage boundary

Still intentionally deferred to Stage 05:
- possession / magnetic control
- dribbling
- gameplay passing
- gameplay shooting/contact mechanics
- tackles/interceptions against the ball
- aerial player-ball contact

## Exact automated verification before this document

Implementation head: `2716874d5421da6799c3882f8767bdb6690bc071`  
CI run: `39137595123`  
CI job: `117705179893`

Results:
- frozen install / supply-chain policy: PASS
- authoritative randomness guard: PASS
- private-reference-content guard: PASS
- strict TypeScript: PASS
- **105 / 105 unit and contract tests PASS** across 16 files
- million-launch fuzz: PASS
- fuzz failures: `0`
- states checked: `4,000,000`
- fuzz checksum: `e0afd3f7`
- max fuzz speed: `44.80623456998427 m/s`
- max fuzz spin: `236.40180232339176 rad/s`
- canonical Stage 02 deterministic hash: `d55b2d0b968372a5`
- FICTIONAL_PUBLIC server/web build: PASS
- server health: PASS
- **11 / 11 Chromium E2E PASS**

Production bundle remains approximately `593.27 kB` minified / `152.85 kB` gzip; the existing Vite >500 kB warning is non-blocking but remains a later code-splitting task.

## TDD evidence for this final audit

The final-audit RED run intentionally failed on the old behavior for three evidence-backed reasons:
- owner chip CSV stopped on first grounding rather than including roll;
- old 2 m rebound was about `0.5707 m`, below the selected professional envelope;
- old ramp-equivalent roll was about `13.93 m`, above the selected professional envelope.

A separate RED test also required the live Ball Lab not to freeze a moving grounded ball at the old 8 second cap.

After the minimum production fixes, the exact implementation head returned fully green.

## Final decision

**Stage 04 final audit: PASS CANDIDATE.**

The implementation satisfies the Stage 04 plan, owner-data regressions, professional-surface calibration probes, deterministic stress checks, numerical-sensitivity review, and automated browser/runtime gates. Merge is permitted only after the documentation-inclusive PR head also passes CI; after merge, `main` must be verified green before Stage 04 is declared finally closed.
