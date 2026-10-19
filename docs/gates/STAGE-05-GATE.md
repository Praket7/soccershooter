# Stage 05 Gate — Core Football Interactions

## Decision

**ENGINEERING PASS — FINAL OWNER FEEL RE-PLAYTEST REQUIRED**

Stage 05 now passes its deterministic engineering gate after the owner's latest playtest exposed four concrete feel defects: visible ball/athlete penetration, directional-control loss during ordinary direction changes, camera/reticle disagreement while aiming, and shot modifiers that were too order-sensitive to use reliably.

Each defect was reproduced at its responsible layer, converted into a regression, repaired without welding the ball to the player, and verified in the full browser and simulation pipeline. This report does not invent the final subjective feel score. Per the execution contract, the owner still decides whether the live build is genuinely fun and refined enough to accept Stage 05.

The branch contains later Stage 06/07 integration work. This document accepts only the Stage 05 subsystem and does not redefine later-stage gates.

## Final owner-feel repair

### Camera and center-reticle aim

The practice camera previously allowed loose-ball auto-framing to translate the camera anchor while the center reticle remained visually fixed. The reticle ray used the actual camera view, while locomotion/body intent used separately accumulated yaw. A moving loose ball could therefore shift the world-space point under the reticle even when the player supplied no look input.

Repair:

- manual center-reticle mode keeps the player as the stable camera anchor;
- loose-ball bias remains available only for passive framing;
- direct mouse look remains immediate;
- goal-frame camera collision remains active;
- regression coverage proves that a moving loose ball cannot translate the center-reticle goal-plane target without user look input.

### Reticle-driven shooting

Reticle height previously behaved mostly as presentation because the shot builder used a fixed style elevation. The live practice shot now passes the actual 3D center-reticle target into the authoritative shot solution.

Result:

- horizontal direction is resolved from the physical ball toward the reticle target;
- reticle height materially changes launch elevation;
- each shot family retains a bounded football-specific elevation envelope;
- AI and legacy callers without a world target retain the deterministic fallback path.

### Forgiving shot selection

The owner reported that shots kept coming out normal because technique selection depended too heavily on button order.

The held-shot runtime now behaves as follows:

- hold LMB to charge a normal shot;
- press RMB at any point before LMB release to promote the charge to finesse;
- press Ctrl at any point before LMB release to promote normal or finesse to chip;
- chip has precedence if both modifier families appear;
- releasing a modifier before LMB does not silently revert the selected technique;
- modifier-first input still works;
- short pointer-lock focus clicks remain below the minimum-shot threshold and cannot create accidental weak shots.

Football Practice also exposes a visible shooting guide explaining the sequence instead of relying on terse chord notation.

### Ball/athlete penetration repair

The apparent ball-inside-player defect had two independent causes.

First, close-control target geometry could command the physical ball center too close to the rendered boot volume. Measured player geometry places the front of the boot at approximately `0.25 m` in front of the player root. With a regulation ball radius of approximately `0.11 m`, close-control center distance needs approximately `0.36 m` to remain outside the boot face. Precision carry, trap/kill, precision receive-exit, and precision effort-turn now use that shared close-control distance. Normal carry and sprint knock-on distances remain unchanged.

Second, the Football Practice renderer was drawing the ball at `1.35x` the authoritative physics radius. That made a physically legal `0.36 m` pocket still look penetrated. The exact RED regression measured only `0.110 m` of boot-to-ball-center clearance against a rendered radius of `0.1485 m`, leaving approximately `3.85 cm` of visible overlap.

Repair:

- Football Practice now renders the ball at `1.0x` the authoritative physics radius;
- a regression requires the practice visual scale to remain exactly `1`;
- a geometry regression requires precision close control to leave at least one rendered-ball radius beyond the front boot face;
- no possession reach was widened;
- no ball position is snapped or teleported;
- the ball remains independent physical state and is controlled only through bounded contacts.

### Directional-loss repair preserved

The final regression suite preserves the earlier control repairs:

- ordinary eight-direction WASD changes produce no out-of-reach loss cascade;
- repeated 45-degree changes stay playable;
- 90/120/150-degree difficult cuts remain physical and recoverable rather than magnetic;
- an actively chased nearby loose ball can be recovered while body orientation catches up;
- a genuinely dropped ball remains free until the player physically closes the gap;
- pressure, imbalance, speed, stretch, and difficult turns create deterministic bounded error;
- clean centered carry does not invent random lateral jitter.

## RED → GREEN evidence

### Shot-control readability RED

On commit `136b4fa54cbcf5329455a4c861f3b614fecc3331`, runtime shot-technique promotion worked but the browser suite reached only `39 / 40 PASS`; the sole expected failure was the deliberately missing `[data-shot-controls-guide]` element.

### Rendered-ball clearance RED

On proof commit `16671f77ec822aa8461af18b28f5f1a9e434d434`:

- typecheck passed;
- `281` existing tests passed;
- exactly one new test failed;
- measured available clearance: `0.110 m`;
- measured rendered-ball radius: `0.1485 m`.

This reproduced the owner's visible penetration report without changing gameplay rules.

### Final verified code head

Exact verified implementation head:

- `8cee4067f3ab83a47ea0bdb8d69365112077eb17`

CI:

- run `39186543600`
- job `117850057909`

Results:

- frozen pnpm install / supply-chain policies: PASS
- authoritative randomness guard: PASS
- private reference-content guard: PASS
- strict TypeScript: PASS
- unit/contract/integration suite: **283 / 283 PASS across 59 files**
- physical-scale rendered-ball invariant: PASS
- rendered boot-volume close-control regression: PASS
- camera no-drift owner regression: PASS
- eight-direction no-loss-cascade regression: PASS
- LMB → RMB finesse promotion regression: PASS
- LMB → Ctrl chip promotion/latch regression: PASS
- center-reticle vertical-shot regressions: PASS
- professional physical control course: PASS
- Stage 04 deterministic ball fuzz: **1,000,000 launches / 4,000,000 states / 0 failures**
- Stage 04 fuzz checksum: `e0afd3f7`
- Stage 05 football fuzz: **250,000 cases / 1,000,000 actions / 190,591 contacts / 0 failures**
- Stage 05 football fuzz checksum: `7b44b28b`
- maximum observed football contact impulse: `15.500000000000005`
- maximum observed football result speed: `34.9018646963763`
- exploit-bot balance gate: PASS
- sprint-only, shot-spam, tackle-spam, and dribble-circle do not dominate their varied/timed reference policies
- canonical deterministic trace: `d55b2d0b968372a5`
- FICTIONAL_PUBLIC web/server production build: PASS
- server health endpoint: PASS
- Chromium/browser parity and full Playwright E2E: **40 / 40 PASS**

## Accepted Stage 05 engineering functionality

### First touch and dribbling

- free physical ball with no welded possession and no position teleport;
- controlled, precision, sprint, effort-turn, trap, and receive-exit contacts;
- close-control targets remain outside the visible boot volume;
- rendered practice ball matches the authoritative physical radius exactly;
- clean carry is beginner-friendly;
- pressure, imbalance, speed, stretch, and severe turns preserve a mastery ceiling through readable deterministic error;
- nearby turn-back recovery avoids orientation lockouts without widening true possession reach;
- genuinely loose balls stay independent until the player physically closes the gap.

### Passing

- ground, driven, lofted, and through/lead families;
- receiver lead prediction;
- bounded aim assistance inside a readable cone;
- body orientation remains a legality constraint;
- keyboard/gamepad pass actions remain one-shot edges.

### Shooting

- normal, finesse, chip, knuckle, outside-foot, and existing bounded contact families;
- charge, 3D reticle aim, body alignment, balance, pressure, contact foot, and spin affect the result;
- normal, finesse, and chip are intentionally selectable regardless of whether the modifier is pressed before or during the LMB charge;
- reticle vertical placement affects real launch elevation within technique limits;
- visible shooting instructions describe the actual sequence;
- pointer-lock capture taps cannot fire accidental weak shots;
- deterministic knuckle state is explicit and cleared by non-knuckle contacts.

### Defense and aerial core

- standing and committed challenges;
- meaningful mistimed-commitment recovery cost;
- moving interception geometry compares defender and ball at the same predicted time;
- header and volley eligibility windows;
- simple spam policies do not dominate deterministic references.

### Practice loop

- Football Practice plus preserved Stage 04 Ball Lab;
- independent physical live ball;
- moving receiver;
- greybox keeper and goals;
- swept-time keeper saves;
- whole-ball goal detection;
- goal/save counters;
- action diagnostics HUD;
- grounded player marker;
- stable manual-aim camera with passive ball-aware framing;
- goal-frame camera collision;
- world-space center reticle drives live shot direction and elevation;
- explicit normal/finesse/chip shooting guide.

## Owner-feedback regressions now locked

Across Stage 05 owner playtests, the branch now protects against:

1. stale ball direction during cuts;
2. sprint-dribble runaway;
3. missing deliberate trap/stop;
4. confusing shot aim and pointer-lock behavior;
5. visible player grounding problems;
6. poor loose-ball readability during cuts;
7. camera clipping through goal members;
8. turn-back recovery lockout on nearby loose balls;
9. ordinary-direction control loss cascades;
10. random clean-carry lateral jitter;
11. shot modifiers being too order-sensitive;
12. unclear normal/finesse/chip controls;
13. reticle height not affecting the real shot;
14. loose-ball camera framing fighting the center reticle;
15. close-control/trap targets entering the visible boot volume;
16. practice-ball visual scale exceeding the authoritative physical ball and creating fake penetration.

## Non-blocking note

The production web bundle is approximately `713.33 kB` minified / `189.20 kB` gzip and still triggers Vite's >500 kB chunk warning. This does not block Stage 05 correctness or the owner feel re-test, but code splitting should be handled before later client growth materially increases the initial payload.

## Final gate rule

Stage 05 is engineering-complete and ready for the owner feel re-test. Final human acceptance requires the owner to confirm in live play that camera/aim consistency, deliberate normal/finesse/chip selection, close-control handling, difficult-turn recovery, and visual ball/body separation now feel genuinely refined. No merge is implied by this report; merging still requires explicit owner authorization.
