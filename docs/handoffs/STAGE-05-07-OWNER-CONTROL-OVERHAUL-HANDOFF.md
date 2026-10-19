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
- RMB+E is the normal-match driven ground pass;
- Ctrl+Q is the normal-match chipped through ball;
- hold/release LMB is the normal shot;
- RMB+LMB is finesse;
- Ctrl+LMB is chip;
- C is the primary defensive challenge key and B remains a fallback; Ctrl is no longer a tackle alias;
- Z/X no longer act as normal-match advanced-action modifiers;
- finesse/chip shot style is latched at shot start, so releasing the modifier before LMB release cannot silently downgrade the action;
- pass modifiers are captured on the pass key-down edge rather than depending on an exact same-frame chord;
- sharp requested turns get earlier braking/redirect contacts;
- receiver selection is aim-cone constrained and can intentionally return no receiver;
- through lead point and pass lane are exposed to the browser UI;
- shot UI exposes READY/POWER/CONTACT/failure and the recognized technique;
- specialist knuckle/outside-foot contacts remain in practice tooling rather than normal-match hotkeys.

### Dribble-retention repair from owner playtest round 2

The owner recording exposed ordinary open-space ball loss that was not caused by a genuinely bad dribble decision.

Root cause:
- the old control envelope calculated a forward target point but did not use it to correct ball travel;
- lateral offset could therefore persist across contacts;
- at the 5.2 m/s normal jog ceiling, the old normal-touch formula could target only about 5.07 m/s, allowing the player to overrun the ball.

Repair:
- each legal normal/precision/sprint/effort-turn contact now computes a bounded velocity correction toward a moving physical control corridor in front of the player;
- position is never copied, teleported or welded;
- correction strength is mode-specific and remains bounded by the same legal contact impulse path;
- normal and precision touch speeds are carrier-relative so competent ordinary control does not intentionally trail the player;
- touch cadence is now roughly precision 0.16 s, normal 0.20 s, sprint 0.28 s, effort-turn 0.12 s, with receive contacts still shorter;
- sprint remains deliberately looser and high-speed cuts/pressure/body-angle failures can still produce legitimate loss of control.

### Regression coverage added

- single-touch lateral drift correction;
- normal carry target speed versus jogging carrier speed;
- sustained multi-second browser carry sampled against the 1.32 m legal control reach;
- Ctrl versus C/B/Z/X input semantics;
- RMB+E driven and Ctrl+Q chipped-through browser actions;
- RMB+LMB finesse and Ctrl+LMB chip browser actions;
- modifier-release shot latch behavior;
- revised touch cadence and deterministic runtime reproduction.

### Bot embodiment

- existing Stage 06 page is presented as `Tactical Debug`;
- existing Stage 07 cards are presented as `Adaptive Debug`;
- deterministic `physicalScrimmage` headless model runs six bots through shared movement, ball physics and football contacts;
- possession is inferred from the physical state and may be `null`;
- passes, shots, control touches and challenges change the actual ball state;
- Three.js `Physical 3v3` browser mode visualizes the same headless scrimmage;
- difficulty/personality controls affect cognition while a physical-invariance probe verifies unchanged physics.

## Research basis for round 2

- EA's current passing guidance distinguishes driven ground and lobbed/chipped-through intent from their base pass families.
- EA's current shooting guidance distinguishes finesse placement/curl from chips over an advancing goalkeeper.
- EA FC 26 gameplay notes emphasize first-touch responsiveness and a controlled-touch tradeoff rather than free precision at full movement speed.
- Zago et al. (2016), *Dribbling determinants in sub-elite youth soccer players*, found faster youth dribblers used higher foot-ball contact cadence and narrower, less variable paths, supporting repeated recoverable touches rather than either magnetic possession or loosely disconnected kicks.

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

The final accepted implementation must be verified at the exact documentation-inclusive branch head. Earlier green runs are supporting evidence only and are not sufficient for completion.

## Integration and remaining owner review

The owner explicitly requested a push to `main` on 2026-10-19, authorizing integration after verification. The Stage 05R playtest remains a separate pending acceptance gate. When convenient, the owner can review ordinary carry retention, sharp cuts, sprint knock-ons, RMB+E, Ctrl+Q, RMB+LMB, and Ctrl+LMB and record the scorecard without treating automated green as a feel approval.
