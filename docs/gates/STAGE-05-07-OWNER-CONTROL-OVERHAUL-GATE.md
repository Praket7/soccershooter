# Stage 05–07 Owner Control Overhaul Gate

**Branch:** `stage/05-07-owner-control-overhaul`  
**Gate type:** engineering + owner feel acceptance

## Automated blocking checks

The final branch head must pass, from a fresh checkout:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm ball:fuzz
pnpm football:fuzz
pnpm football:balance
pnpm bots:tournament
pnpm bots:adaptive-tournament
pnpm bots:learning-lab
pnpm determinism:headless
pnpm build
pnpm test:e2e
```

The CI workflow additionally verifies authoritative-source/private-content guards and the FICTIONAL_PUBLIC shell.

## Required behavioral evidence

- capture click emits no football action;
- permanent locked reticle and camera-center world aim are present;
- F receive buffer supports kill and controlled-exit semantics;
- E/Q/R decode into explicit ground/through/lofted pass families;
- RMB+E decodes as driven ground pass;
- Ctrl+Q decodes as chipped through pass;
- RMB+LMB latches finesse at shot start and remains finesse if RMB is released before LMB;
- Ctrl+LMB latches chip at shot start and remains chip if Ctrl is released before LMB;
- Ctrl is no longer a tackle alias; C remains the primary tackle key and B remains a fallback;
- Z/X do not activate the normal advanced pass/shot modifiers;
- a laterally displaced but legally reachable ball receives a bounded correction toward the requested control corridor without any position snap;
- a correctly positioned normal dribble touch does not intentionally target a ball speed below the jogging carrier speed;
- sustained ordinary browser dribbling keeps player-to-ball separation inside the 1.32 m legal control reach and avoids excessive straight-line lateral drift;
- sprint touches remain longer/riskier than normal or precision touches;
- sharp turns brake/redirect the existing physical ball vector;
- close control reduces movement authority and disables sprint;
- aim-cone receiver selection respects deliberate open space;
- shot feedback exposes preparation/contact/failure and technique states;
- physical bot scrimmage does not weld ball to a carrier;
- physical bot scrimmage produces real contacts, loose-ball windows and control changes;
- difficulty tiers preserve identical physical constants;
- Stage 02 determinism, Stage 04/05 fuzz, Stage 06 tournament and Stage 07 adaptive gates remain green.

## Regression tests added for owner playtest round 2

The owner recording's two failure classes are now explicit automated regressions:

1. `packages/sim/src/football/controlEnvelope.owner.test.ts` checks lateral recentering, carrier-relative normal touch speed and existing sharp-turn/sprint behavior.
2. `packages/sim/src/football/runtime.test.ts` checks shot-technique latching and the revised repeated-touch cadence.
3. `apps/web/src/input/ActionMap.owner-overhaul.test.ts` checks Ctrl/C/B/Z/X keyboard semantics.
4. `packages/sim/src/football/actionIntent.test.ts` checks RMB/precision and Ctrl/lift intent composition.
5. `e2e/football-practice.spec.ts` checks the real browser chords and sustained multi-second dribble retention.

## Merge status

Even after the automated gate is green, this branch must **not** be merged into `main` until the owner manually playtests the repaired controls and explicitly approves the feel. The preserved Stage 05/06/07 checkpoint branches remain source-of-truth history until that approval.
