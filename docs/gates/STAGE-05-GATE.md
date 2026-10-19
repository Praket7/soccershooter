# Stage 05 Gate — Core Football Interactions

## Decision

**ENGINEERING PASS — OWNER SHOOTING RE-PLAYTEST REQUIRED BEFORE FINAL FEEL ACCEPTANCE**

Stage 05's deterministic engineering requirements are green on the current integrated branch. The owner subsequently found a real human-playtest defect: normal shots worked, but finesse/chip selection was too order-sensitive and the shooting rules were not clear enough in the practice UI. That feedback reopened the human feel portion of the gate.

The defect has now been reproduced, repaired, regression-tested, and verified on the exact source head listed below. This document deliberately does **not** invent a new human score or claim final feel acceptance before the owner plays the repaired build.

The current branch is an integration branch containing later Stage 06/07 work as well. This gate records the Stage 05 subsystem status only; it does not re-accept or redefine later-stage gates.

## Latest owner shooting regression repair

### Reported failure

During owner testing, the practical result was that shots kept coming out normal. Two contributing problems were identified:

1. shot technique was latched too early, so beginning a charge with plain LMB and adding RMB or Ctrl afterward did not reliably change the pending strike;
2. the practice UI showed compact chord notation but did not explain the actual sequence clearly enough for a first-time player.

The Stage 05 plan explicitly requires testers to intentionally produce straight, curve, and chip shots, so this was a gate defect rather than cosmetic polish.

### Runtime repair

The held-shot runtime now supports forgiving, deterministic technique promotion during the charge:

- plain LMB starts a normal shot charge;
- pressing RMB at any point while LMB remains held upgrades the pending shot to finesse;
- pressing Ctrl at any point while LMB remains held upgrades normal or finesse to chip;
- chip has precedence when both modifier families appear;
- once a technique is selected for that charge, releasing the modifier before LMB does not silently revert the strike;
- modifier-first input still works;
- short pointer-lock/focus taps remain below the minimum-shot threshold and do not create accidental weak shots;
- losing the held-shot state without a release cancels stale charge and technique state.

### Aiming repair

The live Football Practice shot call now passes the actual center-reticle 3D world target into the authoritative shot builder when such a target exists. Horizontal aim and reticle height therefore influence the real shot solution, while each technique retains bounded elevation limits.

The optional target is omitted entirely when unavailable so the strict `exactOptionalPropertyTypes` contract remains intact.

### Readability repair

Football Practice now exposes a dedicated visible shooting guide:

- aim with the center reticle;
- hold LMB for power;
- LMB only = NORMAL;
- RMB anytime while charging = FINESSE;
- Ctrl anytime while charging = CHIP;
- release LMB to strike.

Practice-only knuckle and outside-foot contacts remain separate specialist experiments rather than hidden normal-match hotkeys.

## RED → GREEN evidence

### RED behavior proof

Regression tests were added before the visible guide was implemented.

On commit `136b4fa54cbcf5329455a4c861f3b614fecc3331`:

- the new runtime technique-upgrade tests passed;
- browser behavior reached **39 / 40 PASS**;
- the single expected browser failure was the deliberately missing `[data-shot-controls-guide]` element.

CI run: `39184619848`.

This isolated the remaining failure to control explanation/readability rather than masking it with unrelated changes.

### GREEN source head

Exact source head:

- `df27ab6e4fbe69b402f959664c22819d5bcd6630`

CI:

- run `39185295667`
- job `117846338742`

Results:

- frozen pnpm install / supply-chain policies: PASS
- authoritative randomness guard: PASS
- private reference-content guard: PASS
- strict TypeScript: PASS
- unit/contract/integration suite: **280 / 280 PASS across 58 files**
- explicit LMB → RMB finesse upgrade regression: PASS
- explicit LMB → Ctrl chip upgrade and latch regression: PASS
- center-reticle vertical-shot regressions: PASS
- Stage 04 deterministic ball fuzz: **1,000,000 launches / 4,000,000 states / 0 failures**
- Stage 04 fuzz checksum: `e0afd3f7`
- Stage 05 football fuzz: **250,000 cases / 1,000,000 actions / 0 failures**
- Stage 05 football fuzz checksum: `8d66a0ce`
- exploit-bot balance gate: PASS
- sprint-only, shot-spam, tackle-spam, and dribble-circle do not dominate their reference policies
- canonical deterministic trace: `d55b2d0b968372a5`
- FICTIONAL_PUBLIC web/server production build: PASS
- server health endpoint: PASS
- Chromium/browser parity and full E2E: **40 / 40 PASS**

## Professional control-course evidence preserved

The same exact integrated branch also preserves the post-owner-feedback physical control regressions:

- clean carry, slalom, sprint, planted 90-degree cut, close-control exit, and settled carry remain one learnable physical sequence;
- a nearby loose ball can be physically recovered when the player actively turns back toward it;
- a genuinely dropped ball remains free until the player closes the real physical gap;
- pressure creates bounded deterministic heavy-touch error while clean carry stays precise;
- no control contact teleports or welds the ball to the player.

## Accepted Stage 05 engineering functionality

### First touch and dribbling

- physical control envelope with no welded possession or ball teleport;
- controlled, precision, sprint, effort-turn, trap, and receive-exit contacts;
- clean carry is beginner-friendly while high-speed hard cuts, imbalance, pressure, and stretch create a mastery ceiling;
- active nearby turn-back recovery avoids orientation lockouts without widening the true possession radius;
- genuinely loose balls remain physically independent.

### Passing

- ground, driven, lofted, and through/lead pass families;
- receiver lead prediction;
- bounded assistance inside a readable aim cone;
- body orientation remains a legality constraint;
- keyboard/gamepad pass inputs are one-shot edges.

### Shooting

- normal, finesse, chip, knuckle, outside-foot, plus the existing bounded shot-contact families;
- charge, aim, body alignment, balance, pressure, contact foot, spin signature, and reticle target affect contact;
- normal, finesse, and chip are intentionally selectable with forgiving modifier timing during one LMB charge;
- moving the center reticle higher on the goal materially raises the launch within technique bounds;
- pointer-lock focus taps do not emit accidental weak shots;
- deterministic knuckle state is explicit and cleared by non-knuckle strikes.

### Defense and aerial core

- standing and committed challenges;
- meaningful recovery cost for mistimed commitment;
- moving interception geometry compares ball and defender at the same predicted time;
- header and volley eligibility windows;
- simple tackle/shot/sprint/dribble spam does not dominate deterministic references.

### Practice loop

- Football Practice mode plus preserved Stage 04 Ball Lab;
- independent physical live ball;
- moving pass receiver;
- greybox keeper and goals;
- swept-time keeper saves;
- whole-ball goal detection;
- goal/save counters;
- action diagnostics HUD;
- grounded player marker;
- ball-aware camera focus and goal-frame camera collision;
- world-space reticle target drives live shot direction/elevation;
- explicit shooting instructions expose normal, finesse, and chip controls.

## Earlier owner-feedback repairs preserved

The earlier owner recording identified and the branch repaired:

1. stale ball direction during dribble cuts;
2. sprint-dribble runaway;
3. no deliberate physical trap/stop;
4. confusing shot aim and pointer-lock behavior;
5. visible player grounding;
6. poor loose-ball readability during cuts;
7. camera clipping through goal members.

The later owner playtest added:

8. turn-back recovery lockout on nearby loose balls;
9. excessive control slop during ordinary direction changes;
10. shot modifiers being too order-sensitive in real play;
11. insufficiently explicit shooting-control instructions;
12. the visible 3D reticle target not being fully consumed by the live shot builder.

These are now covered by deterministic or browser regressions where automatable. Human feel remains the final owner gate.

## Non-blocking note

The current web bundle is about `713 kB` minified / `189 kB` gzip and still triggers Vite's >500 kB chunk warning. It does not block this Stage 05 correctness/playtest repair, but code splitting should be addressed before later client growth materially increases the initial payload.

## Final gate rule

The repaired implementation is ready for owner playtest. Final Stage 05 feel acceptance requires the owner to confirm that normal, finesse, and chip are intentionally producible and that shooting/control no longer feels confusing or broken. No merge is implied by this gate update; merge requires an explicit owner instruction and a green exact-head verification at that time.
