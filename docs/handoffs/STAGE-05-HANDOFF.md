# Stage 05 Handoff — Core Football Interactions

## Current status

**Engineering implementation and the first owner-feedback repair pass are complete. Revised owner feel retest is still required before merge.**

- repository: `Praket7/soccershooter`
- branch: `stage/05-core-football`
- PR: `#13` — `[Stage 05] Core football interactions`
- issue: `#12`
- base: `main`
- base SHA: `7e4841f9132d7190c50fc30229c755d23b7332df`
- latest verified documentation-inclusive head before this handoff refresh: `a8daef00a38f35b69d03578489e19a147b7c33aa`
- final functional source head recorded by the owner-feedback audit: `8c3059a737ff61b33f0a64b4edb75bc7e3376f8f`

**Do not merge PR #13 and do not begin Stage 06 until the owner retests the revised build, accepts the feel gate, and explicitly requests merge.**

## Why this handoff exists

The first owner playtest found Stage 05 basically playable and fun enough to continue, but the supplied recording exposed several serious control/readability defects. Those findings were converted into regression tests, repaired, and re-verified.

The remaining work is not another broad implementation pass. It is a focused owner retest of the repaired controls and camera behavior.

## Owner feedback that was repaired

### 1. Dribble direction change

Problem:
- the ball could preserve its old velocity direction while the player changed direction;
- this forced the player to circle around or chase the ball after sharp cuts.

Repair:
- each control touch now consumes the current camera-relative movement request;
- sharp changes enter bounded `effort-turn` behavior that brakes the old ball vector before redirecting it;
- the fix stays physical and does not weld or teleport the ball.

### 2. Sprint dribble runaway

Problem:
- sustained sprint touches could gradually increase player-ball separation until control was lost.

Repair:
- sprint cadence: `0.14 s`;
- normal / close-control cadence: `0.12 s`;
- sprint target speed now feeds back from current player-ball separation;
- a close ball may receive a small knock-on lead;
- an already stretched ball receives less speed so the player can recover.

Scratch validation recorded in the owner-feedback audit:
- 6 s straight sprint: max separation about `1.07 m`;
- 90° sprint cut: max separation about `1.10 m`;
- 180° reversal: max separation about `1.16 m`;
- hard control reach: `1.32 m`.

Repeated full-speed zigzags can still lose the ball. That is intentional and prevents magnetic sprint possession.

### 3. Physical trap / stop

Problem:
- there was no deliberate way to kill a moving ball while standing over it.

Repair:
- hold `RMB` / precision control with no movement request near a controllable ball;
- the controller enters a physical `trap` mode;
- trap uses bounded velocity/spin correction rather than teleporting the ball;
- stationary nearby balls are not repeatedly nudged.

### 4. Shot aim and pointer lock

Problems:
- a tiny click used only to capture the mouse could create a weak minimum-power shot;
- shot contact could use a hidden stale body yaw that did not match the visible player orientation;
- while moving, the shot integration could still pass a velocity-derived yaw instead of the actual rendered `player.facingYaw`.

Repairs:
- very short focus clicks below roughly `60 ms` do not release a shot;
- a deliberate held first click can still acquire pointer lock and begin charging in one gesture;
- a world-space aim guide appears during charge;
- mouse/right-stick aim remains live while charging;
- shot contact uses the same visible body orientation shown by the player mesh, including while moving;
- body alignment still affects legality and quality, so impossible contacts are not authorized.

### 5. Player grounding

Problem:
- the greybox player appeared visually detached from the pitch.

Repair:
- the actual `main.ts` player marker now uses the shared grounded visual layout;
- the lower visible player plane aligns with the movement support plane;
- browser E2E includes a foot-plane probe so the real integration is protected.

### 6. Ball readability and goal camera collision

Problems from the recording:
- the ball became difficult to read during cuts;
- the practice camera could pass through visible goal posts/crossbars and fill the view with white goal geometry.

Repairs:
- Football Practice adds a capped ball-aware focus bias of at most `0.9 m`;
- the player remains the primary anchor;
- both visible goal frames now provide post/crossbar collision volumes to the existing third-person camera spring-arm solver;
- the generic `ThirdPersonCamera` remains DOM-independent and Football Practice explicitly composes the goal obstacles and ball focus.

## Core Stage 05 functionality preserved

### Football interaction simulation

- physical first touch / dribble control envelope
- no welded possession and no ball teleporting
- controlled, precision, sprint, effort-turn, and trap contacts
- ground pass
- driven pass
- lofted pass
- through / lead pass
- bounded pass assistance with behind-body legality
- normal shot
- driven shot
- finesse shot
- chip
- knuckle shot
- outside-foot shot
- deterministic knuckle seed lifecycle
- standing challenge
- committed tackle
- recovery penalties
- moving interception windows
- header eligibility
- volley eligibility
- deterministic touch / kick cooldowns
- deterministic shot-charge lifecycle

### Practice surface

- Football Practice mode
- Stage 04 Ball Lab preserved as a separate instrument
- physical practice ball
- moving receiver marker
- greybox keeper
- both practice goals
- goal/save counters
- shot-style controls
- diagnostics HUD
- browser-visible deterministic probes
- ball spin visual driven by authoritative physics substeps
- world-space shot aim guide
- grounded player visual
- ball-aware practice camera framing
- goal-frame camera collision

## Exact verification evidence

The latest documentation-inclusive head before this handoff refresh was:

`a8daef00a38f35b69d03578489e19a147b7c33aa`

Fresh workflow status checked immediately before writing this handoff:

- CI run `39148766571` — **PASS**
- CI job `117737927209` — **PASS**
- Stage 01 contracts run `39148766574` — **PASS**

CI steps confirmed green:

- frozen workspace install
- authoritative-randomness / private-content guards
- strict TypeScript
- unit and contract tests
- Stage 04 million-launch deterministic ball fuzz
- Stage 05 football action fuzz
- Stage 05 exploit-bot balance gate
- standalone determinism trace
- production private-import failure proof
- FICTIONAL_PUBLIC web/server build
- server health
- Chromium install
- browser and Node determinism parity / E2E

Recorded exact-head totals from the owner-feedback audit / PR status:

- unit/contract: `156 / 156` PASS across 29 test files
- Stage 04 fuzz: `1,000,000` launches / `4,000,000` states / `0` failures
- Stage 05 fuzz: `250,000` cases / `1,000,000` action evaluations / `0` failures
- exploit bots: sprint-only, shot-spam, tackle-spam, and dribble-circle all fail to dominate their timed/varied references
- canonical determinism hash: `d55b2d0b968372a5`
- Chromium E2E/browser parity: `23 / 23` PASS

Supplementary randomized control audit recorded in the owner-feedback report:

- `100,000` touch states
- `0` non-finite outputs
- fresh high-speed sprint touch target: about `+0.25 m/s` relative to runner speed
- stretched high-speed sprint touch target: about `-0.26 m/s` relative to runner speed

## Important files to read next session

Read these before changing anything:

1. `AGENTS.md`
2. `docs/superpowers/plans/stages/05-core-football.md`
3. `docs/gates/STAGE-05-GATE.md`
4. `docs/gates/STAGE-05-PLAYTEST.md`
5. `docs/gates/STAGE-05-OWNER-FEEDBACK-AUDIT.md`
6. `docs/handoffs/STAGE-05-HANDOFF.md`

Most relevant implementation files:

- `packages/sim/src/football/controlEnvelope.ts`
- `packages/sim/src/football/controlEnvelope.owner.test.ts`
- `packages/sim/src/football/runtime.ts`
- `packages/sim/src/football/runtime.test.ts`
- `apps/web/src/input/FootballControl.ts`
- `apps/web/src/input/FootballControl.test.ts`
- `apps/web/src/input/ActionMap.ts`
- `apps/web/src/dev/FootballPractice.ts`
- `apps/web/src/camera/FootballPracticeCamera.ts`
- `apps/web/src/camera/FootballPracticeCamera.test.ts`
- `apps/web/src/camera/ThirdPersonCamera.ts`
- `apps/web/src/presentation/PlayerVisualLayout.ts`
- `apps/web/src/main.ts`
- `e2e/football-practice.spec.ts`

## Required owner retest

Retest the revised build specifically against the original complaints:

1. Dribble straight and make a deliberate 90° turn. The ball should brake/redirect rather than continue down the old line.
2. Perform a 180° reversal. The ball should become recoverable without forcing a large circle around it.
3. Sprint-dribble straight for 5–6 seconds. The ball should remain recoverable and should not progressively run away.
4. Near a moving controllable ball, release movement and hold `RMB`. The ball should physically trap/slow close to the player.
5. Make a tiny LMB click only to capture the mouse. It should not create a weak shot.
6. Hold LMB deliberately, move the mouse during charge, confirm the aim guide moves, then release. The shot should respond to that aim while respecting the body orientation visible on screen.
7. Repeat the moving shot while running so hidden velocity-derived facing cannot reappear.
8. Confirm the player visually touches the pitch.
9. Dribble/turn near both goals and rotate the camera. Goal posts/crossbars should no longer clip through and dominate the view.
10. During cuts, confirm the ball-aware framing makes the ball easier to track without making the camera feel ball-dragged.
11. Retest all four pass types and confirm assistance feels usable while impossible behind-body passes are still rejected.
12. Give fresh scores for movement, ball control, shooting/aim, camera/readability, and overall fun.

## Decision tree after retest

### If the owner accepts the revised feel

1. Record the owner result in the Stage 05 gate/playtest docs.
2. Mark Stage 05 owner feel gate PASS.
3. Re-run exact documentation-inclusive CI on the final branch head.
4. Inspect the final PR diff.
5. Only after the owner explicitly requests merge, mark PR #13 ready and merge the exact verified head into `main`.
6. Verify post-merge `main` CI is fully green.
7. Only then read and begin the exact Stage 06 plan.

### If any original feel defect remains

1. Keep PR #13 draft.
2. Reproduce the specific symptom from the new recording/description.
3. Add a targeted RED regression test or browser contract.
4. Fix Stage 05 only.
5. Run the full exact-head gate again.
6. Repeat the owner retest for that behavior.

Do not weaken the subjective owner gate simply because automated tests are green.

## Stage boundary

Do **not** add Stage 06+ work from this branch.

Out of Stage 05 scope:

- full team/tactical AI
- production goalkeeper AI
- multiplayer/network prediction
- final animation system
- advanced bicycle/scissor mechanics
- stadium/content production
- audio
- progression/economy/meta systems

## Merge status

PR #13 remains **draft and unmerged**.

That is intentional. Automated engineering evidence is green, but Stage 05 is not considered owner-accepted until the revised feel retest passes and the owner explicitly authorizes the merge.
