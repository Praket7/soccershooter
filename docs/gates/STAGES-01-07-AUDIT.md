# SoccerShooter Stages 01–07 Audit

## Purpose

This audit verifies the first seven implementation stages against their actual repository gate records and then re-checks earlier automated invariants on the Stage 07 branch.

It does **not** turn missing human playtests into fake PASS results. “Implementation complete” and “final owner gate accepted” are tracked separately.

## Executive result

| Stage | Scope | Implementation | Human/owner gate | Current status |
|---|---|---|---|---|
| 01 | Product contract, benchmarks, measurement | Complete | Not blocking | **PASS** |
| 02 | Monorepo + deterministic simulation foundation | Complete | Not blocking | **PASS** |
| 03 | Movement, camera, input | Complete | Owner accepted with documented measurement variance | **PASS** |
| 04 | Premium football physics | Complete | Owner data/calibration audit accepted | **PASS** |
| 05 | Core football interactions | Complete | Owner merge authorization recorded | **PASS** |
| 06 | Tactical bot foundation | Complete | Visual/tactical owner playtest still pending | **ENGINEERING PASS — HOLD** |
| 07 | Adaptive bots, personalities, learning lab | Complete | Difficulty/personality/usefulness playtest still pending | **ENGINEERING PASS — HOLD** |

Therefore:

- all seven planned implementations exist;
- Stages 01–05 have final accepted gate records;
- Stages 06–07 are intentionally unmerged because the owner asked to test them first;
- no missing human score is invented.

## Stage 01 — Product contract, benchmarks, measurement harness

Source gate: `docs/gates/STAGE-01-GATE.md`

Recorded decision: **PASS**.

Verified deliverables include:

- `docs/QUALITY_BAR.md`;
- reference-hardware and network measurement definitions;
- playtest scorecard;
- asset provenance/shipping rules;
- privacy-safe telemetry validation;
- stage-gate contracts;
- balance/performance evidence formats.

Current Stage 07 regression evidence still passes the Stage 01 privacy/provenance/measurement contracts and security guards.

## Stage 02 — Monorepo and deterministic simulation foundation

Source gate: `docs/gates/STAGE-02-GATE.md`

Recorded decision: **PASS**.

Verified deliverables include:

- pnpm workspace + frozen lockfile;
- seeded deterministic simulation;
- fixed-step simulation independent of presentation cadence;
- stable state hash/input serialization;
- strict input protocol boundary;
- authoritative randomness guard;
- private-reference guard;
- web/server shells;
- Node/browser parity.

Current Stage 07 CI preserves the canonical Stage 02 deterministic hash:

`d55b2d0b968372a5`

## Stage 03 — Movement, camera, input feel

Source gate: `docs/gates/STAGE-03-GATE.md`

Recorded decision: **PASS — human-owner acceptance variance recorded explicitly**.

The repository accurately records that the original blind-playtest cohort was not fabricated. Instead, repeated owner testing found and repaired camera-relative movement, sprint-turning, airborne/step behavior, camera responsiveness, action buffering, and zoom issues. The owner then explicitly accepted the final feel.

Current Stage 07 CI still passes Stage 03 movement, camera, input, determinism, and browser regressions.

## Stage 04 — Premium football physics

Source gate: `docs/gates/STAGE-04-GATE.md`

Recorded decision: **PASS — FINAL OWNER DATA AND CALIBRATION AUDIT COMPLETE**.

Verified systems include:

- regulation-scale deterministic ball state;
- 120 Hz football physics;
- drag-crisis model;
- Magnus lift;
- spin decay;
- bounded deterministic knuckle;
- turf bounce/friction/roll/settlement;
- swept goal-frame collision;
- whole-ball goal crossing;
- authoritative trajectory prediction;
- Ball Lab and CSV audit tooling.

Current Stage 07 CI re-runs the million-launch Stage 04 gate:

- launches: `1,000,000`;
- states checked: `4,000,000`;
- failures: `0`;
- checksum: `e0afd3f7`.

## Stage 05 — Core football interactions

Source gate: `docs/gates/STAGE-05-GATE.md`

Recorded decision: **PASS FOR MERGE — ENGINEERING VERIFIED, OWNER MERGE AUTHORIZATION RECEIVED**.

Verified systems include:

- physical first touch/dribbling;
- passing families and bounded assistance;
- shot families and charge/contact logic;
- tackles, recovery, interceptions, aerial windows;
- keeper swept-plane handling;
- owner-feedback regressions;
- exploit-bot balance gate.

Current Stage 07 CI re-runs:

- football fuzz: `250,000` cases / `1,000,000` actions / `0` failures;
- checksum: `fecee5e1`;
- sprint-only, shot-spam, tackle-spam and dribble-circle exploit policies all fail to dominate their references.

## Stage 06 — Tactical bot foundation

Source gate: `docs/gates/STAGE-06-GATE.md`

Recorded decision: **ENGINEERING PASS — OWNER VISUAL PLAYTEST PENDING — DO NOT MERGE YET**.

Implementation is complete and Stage 07 is built directly on it. The remaining Stage 06 gate is human readability: sensible support/recovery behavior must be recognizable without relying on the role overlay.

Current Stage 07 CI re-runs the Stage 06 5,000-possession tournament and reports:

- `5000 / 5000` possessions completed;
- `250` match-equivalents;
- `0` simulation failures;
- `21,034` pass attempts;
- `13,927` completed passes;
- `3,764` multi-pass possessions;
- `8,547` turnovers;
- `318` shots;
- `155` goals;
- `86,472` role switches;
- `0` keeper abandonments;
- `0` permanent-swarm possessions;
- cluster ratio `0.00551079`;
- idle ratio `0`;
- average support distance `4.52722 m`;
- average decision time `0.0069909 ms/team`;
- checksum `618ed2fd`;
- tournament gate **PASS**.

Stage 06 implementation is therefore still regression-green under Stage 07. The branch remains unmerged only because its human tactical-readability test is pending.

## Stage 07 — Adaptive bots, personalities, learning lab

Source gate: `docs/gates/STAGE-07-GATE.md`

Recorded decision: **ENGINEERING PASS — OWNER PLAYTEST PENDING — DO NOT MERGE YET**.

Implemented:

- identical physical laws across novice/standard/elite;
- inspectable bounded cognition profiles;
- deterministic cognition noise;
- decayed gameplay-only player model;
- legal-boundary PvE adaptive director;
- no PvP adaptive difficulty;
- seven data-driven personalities;
- real Stage 06 runtime integration;
- isolated high-level learned-policy interface;
- learned policy default-off;
- reward-hacking detection;
- promotion contract requiring human preference;
- deterministic adaptive simulation gate.

Verified Stage 07 adaptive-tournament results:

- `2000` scenarios per tier / `6000` total;
- physical invariant `true`;
- simulation failures `0`;
- illegal mid-possession changes `0`;
- PvP adaptive changes `0`;
- learned policy enabled by default `false`;
- personality distinctness `6`;
- pass-spam exploit detected `true`;
- winning reward higher than pass spam `true`;
- learned promotion blocked on `human-preference-pending`;
- average decision time `0.015726 ms`;
- max decision time `0.741794 ms`;
- checksum `474b847d`;
- automated gate **PASS**.

Cognition scales monotonically in the intended direction:

| Tier | Reference agreement | Reaction success | Mean aim error (rad) |
|---|---:|---:|---:|
| Novice | 0.64692 | 0.0930 | 0.57220 |
| Standard | 0.69192 | 0.6390 | 0.53240 |
| Elite | 0.71244 | 0.9435 | 0.51264 |

The remaining human gate is documented rather than hidden:

- novice must feel beatable without appearing broken;
- standard must feel like a useful teammate;
- elite must force tactical adaptation without physical cheating;
- personalities must be meaningfully legible;
- teammate usefulness median must reach `>= 7.5/10`.

## Current cross-stage regression snapshot

Verified implementation head before the documentation-only audit changes:

`f47e37722c8a5f911c4fe87dbdbccd33e3973caa`

Full CI:

- run `39160734855`;
- job `117773298690`;
- result **SUCCESS**;
- **211 / 211** unit/contract tests across 43 files;
- Stage 04 fuzz PASS;
- Stage 05 fuzz/balance PASS;
- Stage 06 tournament PASS;
- Stage 07 adaptive tournament PASS;
- deterministic hash unchanged;
- production FICTIONAL_PUBLIC builds PASS;
- server health PASS;
- Chromium/browser parity **26 / 26 PASS**.

## Audit conclusion

The first seven stage implementations are present and regression-compatible.

The correct project state is **not** “merge everything.” It is:

1. Stages 01–05: final PASS records exist.
2. Stage 06: engineering complete and regression-green; owner tactical-readability playtest pending.
3. Stage 07: engineering complete and regression-green; owner difficulty/personality/usefulness playtest pending.
4. No learned policy is promoted.
5. Stage 06 and Stage 07 remain unmerged until owner feedback is accepted or converted into reproducible regressions.

Owner test instructions are in:

- `docs/handoffs/STAGE-06-HANDOFF.md`;
- `docs/gates/STAGE-07-PLAYTEST.md`;
- `docs/handoffs/STAGE-07-HANDOFF.md`.