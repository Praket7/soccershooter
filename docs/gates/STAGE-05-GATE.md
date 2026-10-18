# Stage 05 Gate — Core Football Interactions

## Decision

**PASS FOR MERGE — ENGINEERING VERIFIED, OWNER MERGE AUTHORIZATION RECEIVED**

Stage 05 satisfies its deterministic engineering gate and has received an explicit owner instruction to finish the stage, repair any review findings, and merge it to `main`.

The original stage plan also requested a numeric human feel threshold of at least `8/10`. The owner did not provide a new numeric score in the final merge instruction, so this document does **not** invent one. Instead, the repository records the facts accurately:

- an earlier owner playtest described the core loop as decent and pretty fun while identifying concrete feel/readability defects;
- those defects were reproduced, repaired, and covered by regression tests;
- the owner subsequently instructed that Stage 05 should be completed, reviewed for bugs, and merged;
- that explicit merge instruction is treated as owner acceptance for this milestone, with the missing numeric rating left unclaimed.

No Stage 06 implementation is included in this gate.

## Final review repair

The final review found one additional correctness defect in the greybox keeper.

### Swept keeper-plane timing

The keeper previously evaluated lateral reach and height using the **end of the 120 Hz physics substep** after the ball had crossed the keeper plane. A fast diagonal shot can travel several centimeters laterally during the remainder of that substep, which can turn a legitimate save into a miss or a miss into a false save near the edge of the keeper reach.

This disagreed with the Stage 04 continuous-contact conventions, where goal-plane and goal-frame interactions are evaluated at their swept crossing/contact time.

Repair:

- added `evaluateKeeperPlaneCrossing`;
- interpolate the exact crossing fraction and contact position;
- test keeper reach/height at that exact contact point;
- interpolate ball velocity, angular velocity, and simulation time to contact;
- apply the bounded parry at contact;
- simulate the remaining fraction of the same 120 Hz substep after the parry.

RED evidence:

- test commit: `66b9ade2cc182b1fceb8941fdf4a69000ee7e439`
- CI run: `39151558692`
- expected failure: the new test referenced the not-yet-implemented swept keeper-plane helper.

GREEN source head:

- `ad89bd57ccb1559963cd2bb946938e8173781b75`
- CI run: `39151729897`
- CI job: `117746588544`
- Stage 01 contracts run: `39151729899`

## Exact engineering evidence on the final source head

- frozen pnpm install / supply-chain policies: PASS
- authoritative randomness guard: PASS
- private reference-content guard: PASS
- strict TypeScript: PASS
- unit/contract suite: **158 / 158 PASS across 30 files**
- new swept keeper-plane regressions: **2 / 2 PASS**
- Stage 04 deterministic ball fuzz: **1,000,000 launches / 4,000,000 states / 0 failures**
- Stage 04 fuzz checksum: `e0afd3f7`
- Stage 05 football fuzz: **250,000 cases / 1,000,000 actions / 0 failures**
- Stage 05 football fuzz checksum: `fecee5e1`
- exploit-bot balance gate: PASS
- sprint-only, shot-spam, tackle-spam, and dribble-circle all fail to dominate their varied/timed references
- canonical deterministic trace: `d55b2d0b968372a5`
- FICTIONAL_PUBLIC web/server production build: PASS
- server health endpoint: PASS
- Chromium/browser parity and E2E: **23 / 23 PASS**

## Accepted Stage 05 functionality

### First touch and dribbling

- physical control envelope; no welded possession or ball teleport
- controlled, precision, sprint, effort-turn, and trap contacts
- current requested camera-relative direction drives the next touch
- sharp cuts brake and redirect the old ball vector
- sprint separation feeds back so an already-stretched ball lets the runner catch up
- stationary player + stationary ball avoids magnetic re-contact

### Passing

- ground, driven, lofted, and through/lead pass families
- receiver lead prediction
- bounded assistance only inside a readable aim cone
- body orientation remains a legality constraint; assist cannot manufacture impossible behind-body passes
- keyboard/gamepad pass inputs are one-shot edges

### Shooting

- normal, driven, finesse, chip, knuckle, outside-foot
- charge, aim, body alignment, balance, pressure, foot, and spin signature affect contact
- visible/live aim remains active while charging
- shot legality uses the same visible body orientation shown by the player
- pointer-lock focus taps below the minimum charge do not emit accidental weak shots
- deterministic knuckle state is explicit and cleared by non-knuckle strikes

### Defense and aerial core

- standing and committed challenges
- meaningful recovery cost for mistimed commitment
- moving interception geometry compares ball and defender at the same predicted time
- header and volley eligibility windows
- simple tackle/shot/sprint/dribble spam does not dominate the deterministic reference policies

### Practice loop

- Football Practice mode plus preserved Stage 04 Ball Lab
- physical live ball
- moving pass receiver
- greybox keeper and goals
- swept-time keeper saves
- whole-ball goal detection
- goal/save counters
- action diagnostics HUD
- grounded player marker
- ball-aware camera focus
- goal-frame camera collision
- world-space shot aim guide

## Owner-feedback repairs preserved

The first owner recording identified and the branch repaired:

1. stale ball direction during dribble cuts;
2. sprint-dribble runaway;
3. no deliberate physical trap/stop;
4. confusing shot aim and pointer-lock behavior;
5. visible player grounding;
6. poor loose-ball readability during cuts;
7. camera clipping through goal members.

See `docs/gates/STAGE-05-OWNER-FEEDBACK-AUDIT.md` for the full RED→GREEN history.

## Research review

The final implementation was checked against current primary/academic references rather than tuned only by genre convention:

- **PhysicsFC (Kim, Jung, Lee, 2025)** separates Move, Trap, Dribble, and Kick behavior and uses target ball motion, ball-player proximity, and player motion toward the ball. This supports distinct physical trap/dribble/kick states rather than magnetic possession.
- **EA SPORTS FC gameplay notes** describe retuned dribble touch intervals, special effort touches for drastic turns, first-touch/trapping responsiveness, and context-dependent control difficulty. This supports the bounded effort-turn and close-control cadence approach without copying proprietary implementation.
- **Soccer first-touch research (2026)** associates faster receive-to-pass transitions with controlled pre-contact approach, pass-ready posture, and reduced excessive rebound. This supports penalizing difficult arrival/body setup instead of silently correcting the ball.
- **Pass-feasibility research** shows player body orientation materially changes realistic receiving/passing space, supporting bounded assist with hard orientation constraints.
- **Change-of-direction biomechanics** emphasize braking/deceleration followed by reacceleration for sharp cuts, supporting the explicit braking phase in player and ball redirection.

These are calibration references, not a claim that SoccerShooter reproduces human biomechanics exactly.

## Non-blocking note

The current web bundle is about `626 kB` minified / `163 kB` gzip and still triggers Vite's >500 kB chunk warning. It does not block Stage 05 correctness or browser playtesting, but code splitting should be addressed before later content growth materially increases the initial bundle.

## Final gate rule

Before merge, rerun both repository workflows on the **documentation-inclusive final PR head** and require them to be green. After merge, require the `main` push CI to pass before beginning Stage 06.
