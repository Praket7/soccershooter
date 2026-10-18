# Stage 07 Gate — Adaptive Bot Intelligence, Personalities, and Learning Lab

## Decision

**ENGINEERING PASS — OWNER PLAYTEST PENDING — DO NOT MERGE YET**

Stage 07 is engineering-complete on the isolated `stage/07-adaptive-bots` branch and draft PR #17, stacked directly on the unmerged Stage 06 tactical-bot branch.

The automated implementation, simulation, learned-policy research, build, and browser gates all pass. The remaining exit criteria are intentionally human: novice must feel beatable without appearing broken, standard must feel like a useful teammate, elite must force tactical adaptation without physical cheating, personality differences must be legible, and teammate usefulness must reach the planned human threshold.

Those criteria cannot be fabricated by simulation, so this gate records an engineering PASS and manual HOLD exactly as requested by the owner.

## Verified implementation head

Implementation head before the final documentation-only refresh:

`10f8c401364273afb05f5efad5f112b655d34c27`

Verified GitHub Actions:

- full CI run: `39162193996`
- full CI job: `117777643428`
- result: **SUCCESS**
- Stage 01 contract run: `39162194003`
- Stage 01 contract job: `117777643052`
- Stage 01 contract result: **SUCCESS**
- environment: Ubuntu 24.04.5, Node 24.21.0, pnpm 12.9.1

## What Stage 07 implements

### 1. Physical-fairness contract

Novice, standard, and elite share identical authoritative multipliers for:

- movement speed;
- acceleration;
- stamina capacity;
- stamina drain;
- tackle collider;
- ball physics;
- goalkeeper reach.

Difficulty cannot modify those values.

### 2. Inspectable cognition profiles

All tier differences live in one bounded cognition surface:

- reaction delay;
- observation noise;
- tactical evaluation interval;
- prediction horizon;
- aim/spin error;
- pass-risk tolerance;
- technique repertoire;
- coordinated-run frequency;
- defensive anticipation.

Noise is seeded and deterministic.

### 3. Rolling gameplay-only player model

The player model uses time-decayed sufficient statistics rather than an identity dossier. It tracks:

- pass accuracy;
- shot conversion;
- pressured turnover rate;
- dribble success;
- defensive timing;
- reaction proxy;
- favored zones;
- technique diversity;
- confidence.

No biometric, account, device, location, or other identity-sensitive field is part of the model contract.

### 4. Legal-boundary PvE adaptation

The adaptive director:

- adapts only in PvE;
- never changes tier during live possession;
- accepts only encounter-start/restart boundaries;
- requires adequate model confidence;
- ignores duplicate boundary tokens;
- changes at most one tier per accepted boundary;
- disables adaptation completely in PvP.

### 5. Data-driven personalities

Seven personalities bias the shared deterministic utility system instead of forking separate AI implementations:

- balanced;
- playmaker;
- winger;
- poacher;
- anchor;
- aggressive presser;
- calm keeper.

Personality changes preference, not physical rules.

### 6. Real runtime integration

Stage 07 is not a collection of inert helpers. The Stage 06 tactical runtime consumes the Stage 07 cognition/personality configuration. Tests prove:

- identical seed/world/config reproduces decisions;
- cognition noise never mutates authoritative world state;
- elite reacts to turnover sooner than novice without physical changes;
- personality configuration changes real decision output;
- omitting Stage 07 configuration preserves the Stage 06 deterministic path.

### 7. Adaptive Bot Lab

`apps/web/src/dev/AdaptiveBotLab.ts` provides a browser-visible Stage 07 test surface loaded from `apps/web/index.html`.

It exposes:

- novice/standard/elite cognition cards on the same seeded world;
- physical-invariance proof;
- real runtime decision/technique/utility output;
- novice-like and elite-like player-model sample injection;
- restart-boundary adaptation;
- live-possession adaptation rejection;
- PvE/PvP mode toggle;
- carrier personality selector;
- learned-policy-disabled status.

Three dedicated Playwright tests verify the surface, legal-boundary/PvP behavior, and real personality decision differences.

### 8. Isolated learned-policy research lane

The high-level learned-policy adapter may output only:

- player ID;
- high-level action;
- high-level role;
- optional target player.

Unexpected/physical-control fields are rejected. The production adapter remains disabled by default.

Stage 07 also includes an **executable local learned experiment**, not merely an interface:

- `tools/balance/learning-lab/harness.ts`
- seeded tabular behavior cloning from deterministic expert examples;
- held-out benchmark against the deterministic expert;
- proposal validation through the production high-level schema;
- machine-side promotion metrics;
- deterministic behavior checksum;
- production-enable flag fixed false;
- promotion remains blocked without human preference.

This is intentionally lightweight and research-only; no PyTorch/TensorFlow/RL framework is added to the shipping dependency graph.

## TDD evidence

Major Stage 07 contracts were introduced RED before implementation:

- physical fairness: missing difficulty implementation;
- rolling player model: missing player-model implementation;
- inspectable cognition profile: missing profile API;
- personalities: missing profile data;
- adaptive director: missing legal-boundary implementation;
- runtime integration: Stage 07 configuration unavailable to the real tactical runtime;
- executable learning lane: missing learning-lab harness;
- browser integration: dedicated Playwright tests failed when the Adaptive Bot Lab was not bootstrapped.

Each RED was repaired without weakening the intended contract. The final browser bug was fixed by loading `AdaptiveBotLab.ts` beside the existing Stage 06 tactical-lab module rather than relaxing the tests.

## Full automated verification

| Check | Result |
|---|---|
| Frozen pnpm install / supply-chain policy | PASS |
| Authoritative randomness guard | PASS |
| Private-reference guard | PASS |
| Independent Stage 01 contracts | PASS |
| Strict TypeScript | PASS |
| Unit / contract suite | **214 / 214 PASS across 44 files** |
| Stage 07 physical fairness | PASS |
| Stage 07 player-model decay/confidence/privacy | PASS |
| Stage 07 cognition profiles/noise | PASS |
| Stage 07 personalities | PASS |
| Stage 07 legal-boundary adaptation | PASS |
| Stage 07 real-runtime integration | PASS |
| Learned-policy isolation/default-off | PASS |
| Reward-hacking evaluator | PASS |
| Executable learned-policy benchmark | PASS machine gate |
| Stage 04 million-launch ball fuzz | **1,000,000 launches / 4,000,000 states / 0 failures** |
| Stage 05 football fuzz | **250,000 cases / 1,000,000 actions / 0 failures** |
| Stage 05 exploit-bot gate | PASS |
| Stage 06 5,000-possession tournament | PASS |
| Stage 07 6,000-scenario adaptive tournament | PASS |
| Stage 02 canonical determinism | PASS, hash unchanged |
| FICTIONAL_PUBLIC web/server build | PASS |
| Server health endpoint | PASS |
| Chromium / Node browser suite | **29 / 29 PASS** |

## Stage 07 adaptive simulation gate

Command:

```bash
pnpm bots:adaptive-tournament
```

Verified configuration/results:

- seed: `117471761`
- scenarios per tier: `2000`
- total tier scenarios: `6000`
- physical invariant: `true`
- simulation failures: `0`
- illegal mid-possession changes: `0`
- PvP adaptive changes: `0`
- learned policy enabled by default: `false`
- personality distinctness: `6`
- pass-spam exploit detected: `true`
- winning episode reward exceeds pass spam: `true`
- learned promotion: **BLOCKED**, `human-preference-pending`
- average Stage 07 decision time: `0.0284886 ms`
- measured max Stage 07 decision time in this run: `1.108494 ms`
- deterministic checksum: `474b847d`
- automated gate: **PASS**

The project performance target is an average bot tactical-decision budget; the verified average remains far below 1 ms/team. The measured max is recorded rather than hidden.

### Cognition scaling

| Tier | Action agreement | Reference agreement | Turnover reaction success | Mean aim error (rad) |
|---|---:|---:|---:|---:|
| Novice | 0.8985 | 0.64692 | 0.0930 | 0.57220 |
| Standard | 0.9610 | 0.69192 | 0.6390 | 0.53240 |
| Elite | 0.9895 | 0.71244 | 0.9435 | 0.51264 |

Higher tiers therefore react/perceive more reliably while physical rules remain identical.

## Executable learning-lab benchmark

Command:

```bash
pnpm bots:learning-lab
```

Verified result on the successful CI run:

- seed: `1879558910` (`0x7007cafe`)
- training examples: `2200`
- held-out evaluation episodes: `600`
- learned adapter: `tabular-behavior-clone-v1`
- expert agreement: `1.0`
- invalid proposals: `0`
- cooperation score: `1.0`
- corner-case safety: `1.0`
- exploit rate: `0`
- readability score: `1.0`
- benchmark win proxy: `1.0`
- average high-level inference: `0.00154046 ms`
- measured max inference: `0.468235 ms`
- behavior checksum: `c37c30c3`
- production enabled: `false`
- machine gate: **PASS**
- promotion: **false**, only failure `human-preference-pending`

The perfect agreement is specific to this deliberately small abstract behavior-cloning smoke environment. It proves the adapter can train, execute, validate, benchmark, and reproduce a learned high-level policy; it is **not** evidence that a learned policy is ready to replace production bots.

## Stage 06 regression on the Stage 07 head

Stage 07 re-runs Stage 06 instead of assuming it remains correct.

Fresh successful-run values:

- seed: `1369890822`
- possessions: `5000 / 5000`
- match-equivalents: `250`
- simulation failures: `0`
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
- average decision time: `0.011598 ms/team`
- measured max decision time: `2.803162 ms/team`
- deterministic checksum: `ab7ba617`
- Stage 06 tournament gate: **PASS**

## Earlier-stage regression evidence

- Stage 04 ball fuzz checksum: `e0afd3f7`
- Stage 05 football fuzz checksum: `fecee5e1`
- Stage 02 canonical deterministic hash: `d55b2d0b968372a5`
- Stage 05 exploit policies do not dominate reference policies.
- Public build and health endpoint remain green.

## Acceptance criteria status

| Criterion | Status |
|---|---|
| Novice/standard/elite use identical physical laws | **PASS — automated** |
| Every difficulty difference is inspectable | **PASS — automated** |
| Same seed reproduces cognition/runtime decisions | **PASS — automated** |
| Adaptation only at legal PvE boundaries | **PASS — automated + browser** |
| PvP has no adaptive difficulty | **PASS — automated + browser** |
| Personalities are bounded/data-driven and affect real runtime behavior | **PASS — automated + browser** |
| Learned lane is isolated and disabled by default | **PASS — automated** |
| Learned experiment can train/execute/benchmark reproducibly | **PASS — automated** |
| Pass-spam/non-winning reward farming is rejected | **PASS — automated** |
| Learned-policy machine promotion metrics pass in smoke benchmark | **PASS — automated** |
| Learned-policy human preference gate | **PENDING by design; no policy promoted** |
| Novice is beatable without appearing broken | **PENDING — owner playtest** |
| Standard is a useful teammate | **PENDING — owner playtest** |
| Elite forces tactical adaptation | **PENDING — owner playtest** |
| Personality differences feel useful/legible | **PENDING — owner playtest** |
| Teammate usefulness median >= 7.5/10 | **PENDING — human score** |

## Owner test

Use:

- `docs/gates/STAGE-07-PLAYTEST.md`
- `docs/handoffs/STAGE-07-HANDOFF.md`

The browser now exposes both **Tactical Bot Lab** and **Adaptive Bot Lab** for the Stage 06/07 comparison.

## Merge decision

**HOLD.**

Do not merge Stage 06 or Stage 07 until the owner has tested the bot feel and either:

1. explicitly accepts the remaining human criteria, or
2. reports concrete defects that are converted into RED regressions and repaired.

Do not promote the learned smoke policy to production merely because its machine benchmark passes. Do not begin Stage 08 as if the human gate had passed.