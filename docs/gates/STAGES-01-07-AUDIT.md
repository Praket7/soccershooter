# SoccerShooter Stages 01–07 Audit

## Purpose

This audit verifies the first seven implementation stages against their repository gate records and then re-runs earlier automated invariants on the finished Stage 07 branch.

It deliberately separates **implementation complete** from **final human gate accepted**. Human feel/usefulness scores are not simulated or invented.

## Executive result

| Stage | Scope | Implementation | Human/owner gate | Current status |
|---|---|---|---|---|
| 01 | Product contract, benchmarks, measurement | Complete | Not blocking | **PASS** |
| 02 | Monorepo + deterministic simulation foundation | Complete | Not blocking | **PASS** |
| 03 | Movement, camera, input | Complete | Owner accepted with documented measurement variance | **PASS** |
| 04 | Premium football physics | Complete | Owner data/calibration audit accepted | **PASS** |
| 05 | Core football interactions | Complete | Owner merge authorization recorded | **PASS** |
| 06 | Tactical bot foundation | Complete | Visual/tactical owner playtest pending | **ENGINEERING PASS — HOLD** |
| 07 | Adaptive bots, personalities, learning lab | Complete | Difficulty/personality/usefulness playtest pending | **ENGINEERING PASS — HOLD** |

Therefore all seven planned implementations exist. Stages 01–05 have final accepted gate records. Stages 06–07 remain intentionally unmerged because the owner asked to test them before integration.

## Final cross-stage verification snapshot

Verified Stage 07 implementation head before this documentation-only refresh:

`10f8c401364273afb05f5efad5f112b655d34c27`

Full CI:

- run `39162193996`
- job `117777643428`
- result **SUCCESS**
- unit/contract suite: **214 / 214 PASS across 44 files**
- Stage 04 million-launch fuzz: PASS
- Stage 05 football fuzz: PASS
- Stage 05 exploit balance: PASS
- Stage 06 5,000-possession tournament: PASS
- Stage 07 6,000-scenario adaptive tournament: PASS
- Stage 07 executable learned-policy benchmark: PASS machine gate
- canonical deterministic hash unchanged
- production FICTIONAL_PUBLIC build: PASS
- server health: PASS
- Chromium/Node browser suite: **29 / 29 PASS**

Independent Stage 01 contract verification on the same head:

- run `39162194003`
- job `117777643052`
- result **SUCCESS**

## Stage 01 — Product contract, benchmarks, measurement

Source gate: `docs/gates/STAGE-01-GATE.md`

Recorded decision: **PASS**.

Verified deliverables include:

- quality bar;
- reference-hardware/network measurement definitions;
- playtest scorecard;
- asset provenance/shipping rules;
- privacy-safe telemetry validation;
- stage-gate contracts;
- balance/performance evidence formats.

Current Stage 07 CI still passes the Stage 01 privacy/provenance/security contracts, and the independent Stage 01 workflow is green.

## Stage 02 — Deterministic simulation foundation

Source gate: `docs/gates/STAGE-02-GATE.md`

Recorded decision: **PASS**.

Verified deliverables include:

- pnpm workspace + frozen lockfile;
- seeded deterministic simulation;
- fixed-step simulation independent of render cadence;
- stable state hash/input serialization;
- strict input protocol boundary;
- authoritative randomness guard;
- private-reference guard;
- web/server shells;
- Node/browser parity.

The canonical Stage 02 hash remains:

`d55b2d0b968372a5`

on the finished Stage 07 implementation.

## Stage 03 — Movement, camera, input feel

Source gate: `docs/gates/STAGE-03-GATE.md`

Recorded decision: **PASS — human-owner acceptance variance recorded explicitly**.

The repo truthfully records that an artificial blind cohort was not invented. Repeated owner testing produced concrete camera/movement/action findings, those findings became regressions, and the owner accepted the final feel.

Stage 07 CI continues to run the Stage 03 movement/camera/input/determinism/browser regression suite successfully.

## Stage 04 — Premium football physics

Source gate: `docs/gates/STAGE-04-GATE.md`

Recorded decision: **PASS — FINAL OWNER DATA AND CALIBRATION AUDIT COMPLETE**.

Verified systems include regulation-scale deterministic ball state, 120 Hz football physics, drag crisis, Magnus lift, spin decay, deterministic knuckle, turf contact, goal-frame collision, whole-ball goal crossing, authoritative prediction, and Ball Lab audit tooling.

Fresh Stage 07 regression:

- launches: `1,000,000`
- states checked: `4,000,000`
- failures: `0`
- checksum: `e0afd3f7`

## Stage 05 — Core football interactions

Source gate: `docs/gates/STAGE-05-GATE.md`

Recorded decision: **PASS FOR MERGE — ENGINEERING VERIFIED, OWNER MERGE AUTHORIZATION RECEIVED**.

Verified systems include physical control/dribbling, pass families, shots/contact, defending/recovery, interceptions, aerial windows, goalkeeper timing, owner-feedback regressions, and exploit-bot balance.

Fresh Stage 07 regression:

- cases: `250,000`
- actions checked: `1,000,000`
- failures: `0`
- checksum: `fecee5e1`
- sprint-only, shot-spam, tackle-spam, and dribble-circle policies do not dominate their reference strategies.

## Stage 06 — Tactical bot foundation

Source gate: `docs/gates/STAGE-06-GATE.md`

Recorded decision: **ENGINEERING PASS — OWNER VISUAL PLAYTEST PENDING — DO NOT MERGE YET**.

Implementation is complete. The outstanding Stage 06 question is human tactical readability: useful support/recovery behavior should be recognizable without needing the debug role overlay.

Fresh Stage 06 tournament rerun on the finished Stage 07 implementation:

- seed: `1369890822`
- possessions: `5000 / 5000`
- match-equivalents: `250`
- failures: `0`
- pass attempts: `21,069`
- completed passes: `13,893`
- multi-pass possessions: `3,753`
- turnovers: `8,643`
- shots: `322`
- goals: `159`
- role switches: `86,742`
- keeper abandonments: `0`
- permanent-swarm possessions: `0`
- cluster ratio: `0.00543648`
- idle ratio: `0`
- average support distance: `4.52708 m`
- average tactical decision time: `0.011598 ms/team`
- deterministic checksum: `ab7ba617`
- tournament gate: **PASS**

Stage 06 is therefore regression-green under Stage 07 and remains unmerged only because the requested owner visual test is pending.

## Stage 07 — Adaptive bots, personalities, learning lab

Source gate: `docs/gates/STAGE-07-GATE.md`

Recorded decision: **ENGINEERING PASS — OWNER PLAYTEST PENDING — DO NOT MERGE YET**.

Implemented:

- identical physical laws across all difficulty tiers;
- inspectable bounded cognition profiles;
- deterministic cognition noise;
- decayed gameplay-only player model;
- legal-boundary PvE adaptive director;
- no PvP adaptive difficulty;
- seven data-driven personalities;
- real Stage 06 runtime integration;
- browser Adaptive Bot Lab;
- isolated high-level learned-policy interface;
- learned policy default-off;
- reward-hacking evaluator;
- promotion contract requiring human preference;
- deterministic adaptive simulation gate;
- executable seeded learned-policy smoke experiment and benchmark.

### Adaptive simulation evidence

- `2000` scenarios/tier, `6000` total
- physical invariant: true
- simulation failures: `0`
- illegal mid-possession changes: `0`
- PvP adaptive changes: `0`
- learned policy enabled by default: false
- personality distinctness: `6`
- pass-spam exploit detected: true
- winning reward higher than pass spam: true
- learned promotion blocked on `human-preference-pending`
- average decision time: `0.028489 ms`
- checksum: `474b847d`
- automated gate: **PASS**

| Tier | Reference agreement | Reaction success | Mean aim error |
|---|---:|---:|---:|
| Novice | 0.64692 | 0.0930 | 0.57220 rad |
| Standard | 0.69192 | 0.6390 | 0.53240 rad |
| Elite | 0.71244 | 0.9435 | 0.51264 rad |

The tiers therefore become more reliable cognitively, not physically.

### Executable learning-lab evidence

`pnpm bots:learning-lab` now trains and evaluates a research-only tabular behavior-cloning policy through the strict high-level adapter.

Verified smoke benchmark:

- 2,200 training examples
- 600 held-out episodes
- expert agreement: `1.0`
- invalid proposals: `0`
- cooperation: `1.0`
- corner-case safety: `1.0`
- exploit rate: `0`
- readability: `1.0`
- benchmark win proxy: `1.0`
- average inference: `0.00154046 ms`
- max inference: `0.468235 ms`
- checksum: `c37c30c3`
- machine gate: **PASS**
- enabled in production: `false`
- promotion: **false**, only failure `human-preference-pending`

This small abstract benchmark proves the learned interface is executable, reproducible, safe at its boundary, and benchmarkable. It does not establish superiority over the full production bot and does not promote the learned policy.

### Browser evidence

The final Playwright suite is **29 / 29 PASS**. The Stage 07-specific tests prove:

- the Adaptive Bot Lab actually loads;
- novice/standard/elite cognition scaling is exposed with physical invariance;
- live-possession tier changes are blocked;
- restart-boundary PvE adaptation works;
- PvP adaptation remains locked;
- personality selection changes the real decision surface.

## Plan completeness review

The Stage 07 plan items are all implemented at the engineering level:

1. identical physical parameters: **complete**
2. player model + decay/confidence: **complete**
3. inspectable difficulty profiles: **complete**
4. data-driven personalities: **complete**
5. legal-boundary PvE adaptation: **complete**
6. isolated learned high-level interface: **complete**
7. learned experiment benchmark vs deterministic expert with cooperation/exploit/safety/latency/performance metrics: **complete at smoke-benchmark level**
8. learned policy disabled absent explicit promotion: **complete**
9. deterministic adaptive simulation/tournament gate: **complete**
10. browser owner-test surface: **complete**
11. human teammate-usefulness/fairness preference gate: **pending owner test by design**

## Audit conclusion

The first seven implementation stages are present and regression-compatible.

The correct project state is:

1. **Stages 01–05:** final PASS records exist.
2. **Stage 06:** engineering complete and regression-green; owner tactical-readability playtest pending.
3. **Stage 07:** engineering complete and regression-green; owner difficulty/personality/usefulness playtest pending.
4. **Learned policy:** research smoke benchmark passes machine checks, but no policy is promoted or production-enabled.
5. **Merge:** Stage 06 and Stage 07 remain unmerged until owner feedback is accepted or converted into RED regressions and repaired.

Owner test instructions live in:

- `docs/handoffs/STAGE-06-HANDOFF.md`
- `docs/gates/STAGE-07-PLAYTEST.md`
- `docs/handoffs/STAGE-07-HANDOFF.md`