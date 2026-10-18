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
- E/Q/R and modifiers decode into explicit pass families;
- sharp turns brake/redirect the existing physical ball vector;
- close control reduces movement authority and disables sprint;
- aim-cone receiver selection respects deliberate open space;
- shot feedback exposes preparation/contact/failure states;
- physical bot scrimmage does not weld ball to a carrier;
- physical bot scrimmage produces real contacts, loose-ball windows and control changes;
- difficulty tiers preserve identical physical constants;
- Stage 02 determinism, Stage 04/05 fuzz, Stage 06 tournament and Stage 07 adaptive gates remain green.

## Merge status

Even after the automated gate is green, this branch must **not** be merged into `main` until the owner manually playtests the repaired controls and explicitly approves the feel. The preserved Stage 05/06/07 checkpoint branches remain source-of-truth history until that approval.
