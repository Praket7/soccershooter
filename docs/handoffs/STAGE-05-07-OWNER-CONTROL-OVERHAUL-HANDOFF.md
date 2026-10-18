# Stage 05–07 Owner Control Overhaul Handoff

**Date:** 2026-10-18  
**Branch:** `stage/05-07-owner-control-overhaul`  
**Base:** `stage/07-adaptive-bots`

## What changed

### Human football control

- pointer capture separated from LMB shooting;
- permanent center reticle while locked;
- camera-center ray converted to world aim;
- RMB/LT close control uses shorter touches, lower movement authority and no sprint;
- F receive/trap is explicit and buffered;
- F with no movement kills incoming momentum;
- F with movement produces a bounded controlled exit;
- E/Q/R are dedicated ground/through/lofted passes;
- Z modifies ground/through to driven/chipped-through and LMB to finesse;
- X modifies LMB to chip;
- sharp requested turns get earlier braking/redirect contacts;
- receiver selection is aim-cone constrained and can intentionally return no receiver;
- through lead point and pass lane are exposed to the browser UI;
- shot UI exposes READY/POWER/CONTACT/failure state;
- six normal-match shot-mode hotkeys are removed from the core vocabulary; specialist contacts stay in practice tooling.

### Bot embodiment

- existing Stage 06 page is presented as `Tactical Debug`;
- existing Stage 07 cards are presented as `Adaptive Debug`;
- new deterministic `physicalScrimmage` headless model runs six bots through shared movement, ball physics and football contacts;
- possession is inferred from the physical state and may be `null`;
- passes, shots, control touches and challenges change the actual ball state;
- new Three.js `Physical 3v3` browser mode visualizes the same headless scrimmage;
- difficulty/personality controls affect cognition while a physical-invariance probe verifies unchanged physics.

## Main files

- `apps/web/src/input/ActionMap.ts`
- `apps/web/src/input/FootballControl.ts`
- `apps/web/src/input/InputMerge.ts`
- `apps/web/src/input/WorldAim.ts`
- `apps/web/src/dev/FootballPractice.ts`
- `apps/web/src/dev/PhysicalBotScrimmage.ts`
- `packages/sim/src/football/receive.ts`
- `packages/sim/src/football/actionIntent.ts`
- `packages/sim/src/football/controlEnvelope.ts`
- `packages/sim/src/football/passing.ts`
- `packages/sim/src/football/runtime.ts`
- `packages/bots/src/physicalScrimmage.ts`

## Verification policy

Use the gate in `docs/gates/STAGE-05-07-OWNER-CONTROL-OVERHAUL-GATE.md`. Browser pointer-lock tests use a deterministic Playwright harness because headless Chromium does not reliably grant native pointer lock; production code still uses the native Pointer Lock API.

## Stop condition

Do not merge this branch into `main` merely because CI is green. The next action after engineering verification is an owner browser playtest of Football Practice and Physical 3v3. If the feel is approved, decide whether to merge the integration branch as one repair or split/rebase accepted changes into stage history.
