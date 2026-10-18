# Stage 05 Handoff — Core Football Interactions

## Final status

**READY FOR MERGE AFTER FINAL DOCUMENTATION-INCLUSIVE CI**

- repository: `Praket7/soccershooter`
- branch: `stage/05-core-football`
- PR: `#13`
- issue: `#12`
- base: `main`
- final functional source head before gate-doc refresh: `ad89bd57ccb1559963cd2bb946938e8173781b75`
- source-head CI: `39151729897` — PASS
- source-head Stage 01 contracts: `39151729899` — PASS

The owner explicitly instructed that Stage 05 should be completed, reviewed/fixed, and merged. No numeric owner satisfaction score was supplied with that instruction, so the final gate records authorization without fabricating an `8/10` result.

## What Stage 05 contains

### Physical interaction core

- non-magnetic first touch and dribbling
- precision, sprint, effort-turn, and trap contacts
- ground, driven, lofted, and through passes
- bounded pass assistance with body-orientation legality
- normal, driven, finesse, chip, knuckle, and outside-foot shots
- standing and committed challenges with recovery penalties
- moving interception windows
- header and volley eligibility
- deterministic action cooldown/charge lifecycle

### Football Practice

- independently simulated football
- moving receiver
- greybox keeper
- practice goals and whole-ball scoring
- goal/save counters
- aim guide and shot-style controls
- action diagnostics
- grounded player presentation
- loose-ball camera bias and goal-frame camera collision
- Stage 04 Ball Lab preserved separately

## Owner-feedback repair history

The first owner test reported stale dribble direction, sprint runaway, missing trap/stop, confusing aim/pointer lock, visual hovering, poor ball readability, and goal-frame camera clipping. These were converted into regressions and repaired. See `docs/gates/STAGE-05-OWNER-FEEDBACK-AUDIT.md`.

## Final additional bug found during merge review

The greybox keeper used the ball's end-of-120-Hz-substep x/y after crossing its save plane. Fast diagonal shots could therefore be judged several centimeters away from the real contact point.

Repair:
- exact swept plane-crossing interpolation;
- reach/height evaluated at crossing;
- parry applied at crossing time;
- remaining fractional physics substep simulated afterward.

RED commit: `66b9ade2cc182b1fceb8941fdf4a69000ee7e439`.

GREEN functional head: `ad89bd57ccb1559963cd2bb946938e8173781b75`.

## Source-head verification

CI run `39151729897`, job `117746588544`:

- strict TypeScript: PASS
- unit/contract: **158 / 158 across 30 files**
- Stage 04 ball fuzz: **1,000,000 launches / 4,000,000 states / 0 failures**, checksum `e0afd3f7`
- Stage 05 football fuzz: **250,000 cases / 1,000,000 actions / 0 failures**, checksum `fecee5e1`
- exploit-bot balance: PASS
- deterministic trace: `d55b2d0b968372a5`
- production build / server health: PASS
- Chromium E2E/browser parity: **23 / 23 PASS**

Stage 01 contract workflow `39151729899`: PASS.

## Research conclusions retained

- distinct Move/Trap/Dribble/Kick behavior is preferable to attached possession;
- drastic turns should involve braking/effort rather than instantaneous full-speed redirection;
- first-touch quality should worsen with difficult incoming motion/body setup instead of silently correcting the ball;
- body orientation is a real constraint on pass feasibility;
- sharp change of direction depends on braking followed by reacceleration.

These conclusions align with PhysicsFC, current official EA SPORTS FC gameplay notes, recent soccer first-touch work, pass-orientation research, and change-of-direction biomechanics.

## Non-blocking debt

The current production web chunk is about `626 kB` minified / `163 kB` gzip. It passes the current Stage 05 gate but Vite warns above 500 kB. Plan code splitting before large later content additions.

## Next stage boundary

Only after PR #13 is merged and post-merge `main` CI is green, begin:

`docs/superpowers/plans/stages/06-tactical-bots.md`

Stage 06 owns deterministic tactical bots: perception, blackboard, dynamic team roles, utility decisions, predictive passing/interception/shot tools, goalkeeper behavior, scenario tests, and headless 3v3 tournaments.

Do not fold Stage 06 implementation into the Stage 05 branch.
