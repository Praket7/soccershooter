# Stage 05 Gate — Core Football Interactions

## Decision

**ENGINEERING PASS — FINAL OWNER FEEL RE-PLAYTEST REQUIRED**

Stage 05 now passes its deterministic engineering gate after the latest owner playtest exposed three concrete feel defects: ball/athlete visual penetration during close control, directional-control loss during ordinary changes of direction, and clunky shooting caused by camera/reticle disagreement plus order-sensitive shot modifiers.

Those defects were reproduced, repaired at their responsible layers, converted into regressions, and verified on the exact source head below. This document deliberately does **not** invent the Stage 05 human feel score. The final subjective acceptance remains the owner's next playtest, as required by the project execution contract.

The current branch also contains later Stage 06/07 integration work. This report accepts the Stage 05 subsystem only and does not redefine later-stage gates.

## Final owner-feel repair

### Camera and center-reticle aim

The practice camera previously allowed loose-ball framing to translate the camera anchor while the center reticle remained visually fixed. Because the reticle ray used the actual camera view while locomotion/body intent used separately accumulated yaw, a moving loose ball could make the world-space aim drift even when the player supplied no look input.

Repair:

- manual center-reticle mode keeps the player as the stable camera anchor;
- loose-ball bias remains available only for passive framing;
- direct mouse look remains immediate;
- goal-frame camera collision remains active;
- regression coverage proves a moving loose ball cannot translate the center-reticle goal-plane target without user look input.

### Reticle-driven shooting

The reticle height previously behaved mostly as presentation because the shot builder used fixed style elevation. The live practice shot now passes the actual 3D center-reticle world target into the authoritative shot solution.

Result:

- horizontal direction is resolved from the physical ball toward the reticle target;
- reticle height materially changes launch elevation;
- each shot family still has a bounded football-specific elevation envelope;
- AI/legacy callers without a world target retain the deterministic fallback path.

### Forgiving shot selection

The owner reported that shots kept coming out normal because technique selection was too sensitive to button order.

The held-shot runtime now behaves as follows:

- hold LMB to charge a normal shot;
- press RMB at any point before LMB release to promote that charge to finesse;
- press Ctrl at any point before LMB release to promote normal or finesse to chip;
- chip has precedence if both modifier families appear;
- releasing a modifier before LMB does not silently revert the selected technique;
- modifier-first input still works;
- short pointer-lock focus clicks remain below the minimum-shot threshold and cannot create accidental weak shots.

Football Practice also exposes a visible shooting guide explaining the sequence instead of relying on terse chord notation.

### Ball/athlete penetration repair

The apparent ball-inside-player defect was not a welded-possession bug. The physical ball remained independent, but close-control target geometry could command the ball center too close to the rendered boot volume.

Measured geometry:

- rendered boot front is approximately 0.25 m in front of the player root;
- regulation ball radius is approximately 0.11 m;
- therefore a deliberate front-foot target needs approximately 0.36 m of center distance to avoid visible boot/ball penetration.

The old precision/trap targets were approximately 0.27–0.30 m. They are now bounded to a shared `0.36 m` close-control contact distance for:

- precision carry;
- trap/kill touch;
- precision receive-exit;
- precision effort-turn minimum distance.

Normal carry (`0.52 m`) and sprint knock-on distances remain unchanged. The change does not enlarge physical possession reach, snap position, or attach the ball. It only moves the intended bounded-impulse contact pocket outside the rendered boot face.

### Directional-loss repair preserved

The final regression suite also preserves the earlier control fixes:

- ordinary eight-direction WASD changes produce no out-of-reach loss cascade;
- repeated 45-degree changes stay playable;
- 90/120/150-degree difficult cuts remain physical and recoverable rather than magnetic;
- an actively chased nearby loose ball can be recovered while body orientation catches up;
- a genuinely dropped ball remains free until the player physically closes the gap;
- pressure, imbalance, speed, stretch, and difficult turns create deterministic bounded error;
- clean centered carry does not invent random lateral jitter.

## RED → GREEN evidence

### Shooting readability RED

On commit `136b4fa54cbcf5329455a4c861f3b614fecc3331`:

- the new runtime technique-promotion tests passed;
- browser behavior reached **39 / 40 PASS**;
- the sole expected failure was the deliberately missing `[data-shot-controls-guide]` element.

CI run: `39184619848`.

### Final GREEN source head

Exact verified source head before this gate-document update:

- `7fcf6dd8a8bc1531b1b3baa4ff4d883ab0bffe9d`

CI:

- run `39185768143`
- job `117847769155`

Results:

- frozen pnpm install / supply-chain policies: PASS
- authoritative randomness guard: PASS
- private reference-content guard: PASS
- strict TypeScript: PASS
- unit/contract/integration suite: **281 / 281 PASS across 58 files**
- camera no-drift owner regression: PASS
- rendered boot-volume close-control regression: PASS
- eight-direction no-loss-cascade regression: PASS
- LMB → RMB finesse promotion regression: PASS
- LMB → Ctrl chip promotion/latch regression: PASS
- center-reticle vertical-shot regressions: PASS
- professional physical control course: PASS
- Stage 04 deterministic ball fuzz: **1,000,000 launches / 4,000,000 states / 0 failures**
- Stage 04 fuzz checksum: `e0afd3f7`
- Stage 05 football fuzz: **250,000 cases / 1,000,000 actions / 0 failures**
- Stage 05 football fuzz checksum: `7b44b28b`
- maximum observed football contact impulse: `15.500000000000005`
- maximum observed football result speed: `34.9018646963763`
- exploit-bot balance gate: PASS
- sprint-only, shot-spam, tackle-spam, and dribble-circle do not dominate their varied/timed reference policies
- canonical deterministic trace: `d55b2d0b968372a5`
- FICTIONAL_PUBLIC web/server production build: PASS
- server health endpoint: PASS
- Chromium/browser parity and full E2E: **40 / 40 PASS**

## Accepted Stage 05 engineering functionality

### First touch and dribbling

- free physical ball with no welded possession and no position teleport;
- controlled, precision, sprint, effort-turn, trap, and receive-exit contacts;
- close-control targets remain outside the visible boot volume;
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
- simple spam policies do not dominate the deterministic references.

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

Across the Stage 05 owner playtests, the branch now protects against:

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
15. close-control/trap targets entering the visible boot volume.

## Non-blocking note

The production web bundle is approximately `713.35 kB` minified / `189.21 kB` gzip and still triggers Vite's >500 kB chunk warning. This does not block Stage 05 correctness or the owner feel re-test, but code splitting should be handled before later client growth materially increases the initial payload.

## Final gate rule

The Stage 05 implementation is engineering-complete and ready for the owner feel re-test. Final Stage 05 human acceptance requires the owner to confirm that the repaired build is fun and refined enough in actual play, especially camera/aim consistency, deliberate normal/finesse/chip selection, and close-control ball handling. No merge is implied by this report; merging still requires explicit owner authorization.
