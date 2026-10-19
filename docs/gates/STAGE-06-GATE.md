# Stage 06 Gate — Tactical Bot Foundation

## Decision

**ENGINEERING PASS — OWNER VISUAL PLAYTEST PENDING**

Stage 06 is engineering-complete on the isolated `stage/06-tactical-bots` branch and draft PR #15. The owner later explicitly requested integration to `main` on 2026-10-19; the human visual acceptance remains pending and is not represented as passed here.

The final Stage 06 exit criterion also requires a human to identify sensible support/recovery behavior without relying on the debug role overlay. That criterion cannot truthfully be self-certified by automation, so the issue and PR remain open pending owner playtest.

## Verified implementation head

Implementation head before this documentation refresh:

`4196abd546b538596230601d853abcc7fb5382e1`

Verified GitHub Actions:

- main CI run: `39158217835`
- main CI job: `117765780488`
- Stage 01 contract run: `39158217834`
- result: **SUCCESS**
- environment: Ubuntu 24.04.5, Node 24.21.0, pnpm 12.9.1

## RED → GREEN evidence

Stage 06 followed test-first development.

### Tactical scenario RED

Commit `d707ff5805b90c91cbf71121407ec83960a01339` added eight tactical scenarios before the bot implementation existed.

CI run `39154269111`, job `117754121377`:

- all 158 pre-Stage-06 tests passed;
- all eight new tactical scenarios failed because the planned bot modules did not exist.

### Runtime / tournament RED

Tests for 10 Hz tactical cadence and the thousands-of-possessions tournament were added before `runtime.ts` and `tacticalTournament.ts` existed.

CI run `39154928212`, job `117756076178` failed at strict TypeScript with the expected missing-module errors.

### Match/restart-context RED

`blackboard.stage06.test.ts` was added before the world snapshot exposed match/restart state.

CI run `39157255743`, job `117762917628` failed at strict TypeScript on the intentionally missing match-state fields.

### Role-occupancy export RED

The final plan review found that the Stage 06 benchmark had pass, turnover, support, clustering, and role-switch statistics but did not yet export the plan-required role occupancy counts. A regression was added first.

Commit `9ec7295cbcc81fec3954a9e3bafa950196d2ba15` failed at strict TypeScript because `TacticalTournamentReport.roleOccupancy` did not exist. Commit `4196abd546b538596230601d853abcc7fb5382e1` implemented occupancy counting and made the contract GREEN.

All four Stage 06 TDD contracts are GREEN on the verified implementation head.

## Automated verification

| Check | Result |
|---|---|
| Frozen pnpm install / supply-chain policy | PASS |
| Authoritative randomness guard | PASS |
| Private-reference guard | PASS |
| Strict TypeScript | PASS |
| Unit / contract suite | **178 / 178 PASS across 35 files** |
| Stage 06 tactical scenarios | PASS |
| 10 Hz tactical runtime + event-driven turnover response | PASS |
| Match/restart blackboard contract | PASS |
| Off-ball/defensive utility contracts | PASS |
| Tournament role-occupancy export | PASS |
| Stage 04 million-launch ball fuzz | **1,000,000 launches / 4,000,000 states / 0 failures** |
| Stage 05 football fuzz | **250,000 cases / 1,000,000 actions / 0 failures** |
| Stage 05 exploit-bot balance gate | PASS |
| Stage 06 5,000-possession tactical tournament | **PASS** |
| Stage 02 canonical determinism | **PASS, unchanged** |
| Production FICTIONAL_PUBLIC web/server build | PASS |
| Server health endpoint | PASS |
| Browser E2E / Node parity | **26 / 26 PASS** |
| Stage 01 contract workflow | PASS |

## 5,000-possession tactical simulation

Command:

`pnpm bots:tournament`

Verified values from run `39158217835`:

- seed: `1369890822`
- requested/completed possessions: `5000 / 5000`
- simulated match-equivalents: `250`
- simulation failures: `0`
- pass attempts: `34,627`
- completed passes: `23,687` (**68.4%**)
- multi-pass possessions: `4,573` (**91.46%**)
- turnovers: `12,185`
- shots: `341`
- goals: `150`
- role switches recorded: `116,184`
- role occupancy samples:
  - goalkeeper: `171,858`
  - ball carrier: `85,929`
  - immediate support: `85,929`
  - presser: `85,929`
  - cover defender: `85,929`
  - width support: `0` in this one-keeper + two-field-player 3v3 benchmark
  - recovery runner: `0` in this one-keeper + two-field-player 3v3 benchmark
- keeper abandonments: `0`
- permanent-swarm possessions: `0`
- cluster ratio: `0.0508734`
- idle ratio: `0`
- average support distance: `4.5287 m`
- average tactical decision time: `0.00833 ms/team`
- max measured tactical decision time: `2.0720 ms/team`
- deterministic checksum: `f8ba9988`
- gate failures: `[]`

Width-support and recovery-runner behaviors are exercised by dedicated role/off-ball unit scenarios with larger field-player counts; they are structurally unavailable in this specific benchmark because every side contains one goalkeeper and only two field players.

The average decision cost is well below the Stage 06 `<1 ms/team` target. The max value is retained as a defensive diagnostic and remains below the 12 ms CI guard.

## Preserved regression evidence

Stage 06 keeps prior-stage safety/regression gates intact:

- Stage 04 ball fuzz checksum: `e0afd3f7`
- Stage 05 football fuzz checksum: `fecee5e1`
- Stage 02 reference seed: `1511506142`
- Stage 02 reference ticks: `10,000`
- Stage 02 reference hash: `d55b2d0b968372a5`

The Stage 06 branch did not change the canonical Stage 02 hash.

## Browser acceptance surface

The Tactical Bot Lab is part of the browser build and Chromium suite. Automated checks verify:

- six visible participants;
- live simulation progression;
- passing activity;
- no permanent swarm flag;
- keeper depth remains bounded;
- force-turnover produces an observable turnover event and possession response;
- role overlay is hidden by default and optional when debugging.

The final subjective criterion is deliberately not automated: the owner should first watch with the role overlay **off** and decide whether support, width, pressing, and recovery are understandable from movement alone.

## Research grounding

The implementation was checked against research on:

- dynamic role/formation assignment in RoboCup;
- role-selection stability and anti-thrashing regularization;
- pass feasibility using player orientation and opponent spatial configuration;
- geometric goalkeeper positioning and trajectory-based interception.

See `docs/decisions/STAGE-06-RULINGS.md` for the sources and implementation mapping.

## Non-blocking notes

- The production JS bundle is about `653.98 kB` minified / `171.76 kB` gzip and still triggers Vite's >500 kB chunk warning. It remains far below the global initial-playable transfer ceiling, but code splitting should occur before major later client growth.
- Stage 06 performance evidence is CI-runner evidence. Reference Desktop capture remains useful in later performance/QA stages.
- No independent reviewer subagent is exposed in Chat mode. A focused plan/diff self-review was performed instead; it found and closed the missing role-occupancy export before this gate refresh.

## Pending owner gate

Before Stage 06 can be declared fully accepted and merged, the owner should:

1. run the Tactical Bot Lab locally;
2. leave role labels off initially;
3. verify sensible support/width behavior and lack of ball swarming;
4. use Force Turnover repeatedly and verify press + goal-side recovery are visually sensible;
5. verify keeper positioning feels goal-connected rather than passive or wandering;
6. enable role labels only afterward to compare the inferred behavior with the assigned roles;
7. report any feel/logic defects or explicitly accept the result.

## Gate result

**Engineering: PASS.**  
**Human visual acceptance: PENDING OWNER TEST.**  
**Integration authorization:** The owner explicitly requested a push to `main` on 2026-10-19. The visual acceptance checklist remains pending for later owner review.
