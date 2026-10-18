# Stage 07 Gate — Adaptive Bot Intelligence, Personalities, and Learning Lab

## Decision

**ENGINEERING PASS — OWNER PLAYTEST PENDING — DO NOT MERGE YET**

Stage 07 is engineering-complete on the isolated `stage/07-adaptive-bots` branch and draft PR #17, based directly on the unmerged Stage 06 tactical-bot branch.

The automated implementation and simulation gates pass. The remaining exit criteria are intentionally human: novice must feel beatable without appearing broken, standard must feel like a useful teammate, elite must force tactical adaptation without feeling physically unfair, and teammate usefulness must reach the planned human score threshold.

Those criteria cannot be fabricated by simulation, so this gate records an engineering PASS and a manual HOLD exactly as requested by the owner.

## Verified implementation evidence

Implementation head before Stage 07 documentation updates:

`f47e37722c8a5f911c4fe87dbdbccd33e3973caa`

Verified GitHub Actions:

- full CI run: `39160734855`
- full CI job: `117773298690`
- result: **SUCCESS**
- environment: Ubuntu 24.04.5, Node 24.21.0, pnpm 12.9.1

## TDD / staged implementation evidence

Stage 07 was implemented test-first across its major contracts.

### Physical-fairness RED → GREEN

A failing difficulty contract was introduced before `difficulty.ts` existed. The resulting implementation proves novice, standard, and elite share identical authoritative movement, stamina, collider, goalkeeper-reach, and ball-physics multipliers.

### Player-model RED → GREEN

The player-model test was introduced before the module existed. The implementation now tracks decayed gameplay-only sufficient statistics with confidence and no identity-sensitive fields.

### Difficulty-profile RED → GREEN

The inspectable cognition profile contract was introduced before its API existed. The resulting profiles expose all allowed difficulty differences through one bounded snapshot and use deterministic seeded cognition noise.

### Personality RED → GREEN

The personality contract was introduced before profile data existed. Seven bounded data-driven utility profiles now bias the shared deterministic bot system.

### Adaptive-director RED → GREEN

The legal-boundary contract was introduced before `adaptiveDirector.ts` existed. The implementation now prohibits live-possession difficulty changes, requires confidence, avoids duplicate boundary application, moves at most one tier per accepted boundary, and disables adaptation in PvP.

### Runtime-integration RED → GREEN

The final integration contract was written to prevent Stage 07 from passing with inert helper objects. The real Stage 06 runtime now consumes Stage 07 difficulty/personality context while preserving the legacy deterministic path when no Stage 07 config is supplied.

Tests prove seeded repeatability, no mutation of the authoritative world, earlier elite turnover response, and personality effects in actual runtime decisions.

### Learning-lab isolation and reward safety

The high-level learned-policy interface accepts only role/action/target proposals and rejects attempted physical-control fields. The optional learned lane is disabled by default.

The learning evaluator detects pass-loop and non-winning proxy farming, and promotion requires cooperation, safety, exploit, latency, readability, win-rate, and human-preference thresholds.

## Automated verification on the verified implementation head

| Check | Result |
|---|---|
| Frozen pnpm install / supply-chain policy | PASS |
| Authoritative randomness guard | PASS |
| Private-reference guard | PASS |
| Strict TypeScript | PASS |
| Unit / contract suite | **211 / 211 PASS across 43 files** |
| Stage 07 physical fairness | PASS |
| Stage 07 player-model decay/confidence/privacy | PASS |
| Stage 07 inspectable cognition profiles | PASS |
| Stage 07 personality contracts | PASS |
| Stage 07 legal-boundary adaptation | PASS |
| Stage 07 adaptive runtime integration | PASS |
| Learned-policy isolation/default-off | PASS |
| Reward-hacking tests | PASS |
| Stage 04 million-launch ball fuzz | **1,000,000 launches / 4,000,000 states / 0 failures** |
| Stage 05 football fuzz | **250,000 cases / 1,000,000 actions / 0 failures** |
| Stage 05 exploit-bot gate | PASS |
| Stage 06 5,000-possession tournament | PASS |
| Stage 07 6,000-scenario adaptive tournament | PASS |
| Stage 02 canonical determinism | PASS, hash unchanged |
| Production FICTIONAL_PUBLIC web/server build | PASS |
| Server health endpoint | PASS |
| Browser E2E / Node parity | **26 / 26 PASS** |

## Stage 07 adaptive simulation gate

Command:

```bash
pnpm bots:adaptive-tournament
```

Verified configuration:

- seed: `117471761`
- scenarios per tier: `2000`
- total tier scenarios: `6000`

Global results:

- physical invariant: `true`
- simulation failures: `0`
- illegal mid-possession changes: `0`
- PvP adaptive changes: `0`
- learned policy enabled by default: `false`
- personality distinctness: `6`
- pass-spam reward exploit detected: `true`
- winning episode reward exceeds pass spam: `true`
- learned promotion: **BLOCKED**, `human-preference-pending`
- average decision time: `0.0157259738 ms`
- max measured decision time: `0.741794 ms`
- deterministic checksum: `474b847d`
- automated gate: **PASS**

### Cognition scaling

| Tier | Action agreement | Reference agreement | Reaction success | Mean aim error (rad) |
|---|---:|---:|---:|---:|
| Novice | 0.8985 | 0.64692 | 0.0930 | 0.57220 |
| Standard | 0.9610 | 0.69192 | 0.6390 | 0.53240 |
| Elite | 0.9895 | 0.71244 | 0.9435 | 0.51264 |

This is the intended scaling pattern: higher tiers react and perceive more reliably while physical rules remain identical.

## Stage 06 regression on the Stage 07 head

Stage 07 re-runs the Stage 06 tournament rather than assuming it still works.

Verified on the same Stage 07 CI run:

- completed possessions: `5000 / 5000`
- simulated match-equivalents: `250`
- simulation failures: `0`
- pass attempts: `21,034`
- completed passes: `13,927`
- multi-pass possessions: `3,764`
- turnovers: `8,547`
- shots: `318`
- goals: `155`
- role switches: `86,472`
- keeper abandonments: `0`
- permanent-swarm possessions: `0`
- cluster ratio: `0.00551079`
- idle ratio: `0`
- average support distance: `4.52722 m`
- average decision time per team: `0.0069909 ms`
- deterministic checksum: `618ed2fd`
- Stage 06 tournament gate: **PASS**

## Acceptance criteria status

| Criterion | Status |
|---|---|
| Novice and elite use identical physical laws | **PASS — automated** |
| Every difficulty difference is inspectable | **PASS — automated** |
| Adaptation happens only at legal PvE boundaries | **PASS — automated** |
| PvP has no adaptive difficulty | **PASS — automated** |
| Same seed reproduces decisions | **PASS — automated** |
| Personalities are data-driven and bounded | **PASS — automated** |
| Learned lane is fully disableable/default-off | **PASS — automated** |
| Pass-spam/non-winning reward farming is rejected | **PASS — automated** |
| Novice is beatable without appearing broken | **PENDING — owner playtest** |
| Standard is a useful teammate | **PENDING — owner playtest** |
| Elite forces tactical adaptation | **PENDING — owner playtest** |
| Teammate usefulness median >= 7.5/10 | **PENDING — human score** |
| Learned-policy human-preference promotion metric | **PENDING by design; no policy promoted** |

## Research-lane decision

Stage 07 does **not** require a neural policy to ship. The optional local research interface, evaluation metrics, reward-safety rules, deterministic baseline, and promotion contract are implemented. No learned model is promoted because the human-preference criterion has not been satisfied.

This preserves the production architecture: deterministic and inspectable by default, with a research lane that can never silently gain physical authority.

## Owner test

Use:

- `docs/gates/STAGE-07-PLAYTEST.md`
- `docs/handoffs/STAGE-07-HANDOFF.md`

for the Stage 06 baseline and Stage 07 comparison procedure.

## Merge decision

**HOLD.**

Do not merge Stage 06 or Stage 07 until the owner has tested the bot feel and either:

1. explicitly accepts the remaining human criteria, or
2. reports concrete defects that are first reproduced as RED regressions and then repaired.

Do not begin Stage 08 as if this human gate had passed.