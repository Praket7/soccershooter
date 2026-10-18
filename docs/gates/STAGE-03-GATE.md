# Stage 03 Gate Report

**Stage:** 03  
**Date:** 2026-10-18  
**Final implementation head before this documentation update:** `60d72700e5ce9d81a8f67158b7e4664353fc4c88`  
**Verified CI run:** `39126817802`  
**Verified CI job:** `117673577416`  
**Agent / reviewer:** GPT-5.6 Sol, self-review in chat; no independent reviewer runtime exposed  
**Decision:** **PASS — human-owner acceptance variance recorded explicitly**

## Decision basis

Stage 03 exists to make movement, camera, and input feel excellent before Stage 04 introduces the ball. The implementation is automated-test green, has been refined through repeated local owner playtests, and the human owner explicitly directed that the current result be treated as the **final Stage 03 pass** and merged to `main` after the final zoom feature and bug sweep are green.

The original stage plan requested at least five blind scored runs plus formal Reference Desktop latency evidence. Those data were **not** independently collected in this chat, so this report does not invent scores or pretend they exist. Instead, the owner’s explicit final-pass and merge instruction is recorded as a visible acceptance variance. This satisfies the human product-acceptance decision for this development stage without silently lowering or fabricating the original measurement target. A larger blind cohort remains useful validation for later alpha/QA work.

## Human playtest history

The owner performed iterative local playtests and supplied concrete feel feedback that was converted into reproducible regressions and fixes.

### Playtest round 1

Reported issues:
- A/D camera-relative left/right were inverted
- large direction changes produced awkward U-turns
- sprint differentiation was too subtle
- jump/tackle hooks appeared nonfunctional

Resulting fixes:
- corrected camera-relative right basis
- added plant/brake/reverse behavior for near-180° changes
- increased sprint target to 8.8 m/s while preserving 5.2 m/s jog
- buffered discrete action hooks until the 60 Hz simulation consumes them
- added visible jump/tackle/sprint acknowledgement and clearer control labels

### Playtest round 2

Reported issues:
- camera movement felt burdensomely slow
- leaving ramps/raised surfaces snapped vertically to the ground
- sprint cardinal changes produced large circular paths

Resulting fixes:
- raised mouse/gamepad look responsiveness while keeping immediate manual look
- reduced camera target settling to 0.07 s
- added deterministic vertical velocity, gravity, airborne state, and landing detection
- added persistent plant-cut behavior for large high-speed direction changes while preserving smoother small-angle sprint steering

### Final owner acceptance

After the second repair round, the owner reported that the result was **“perfect”** and that **“everything passes.”** The only additional requested Stage 03 feature was presentation-side trackpad zoom. The owner then explicitly instructed that, after the zoom feature, bug sweep, and green verification, this should be the **final Stage 3 pass** and be merged to `main`.

## Final Stage 03 functionality

### Deterministic athlete movement

- normalized camera-relative movement
- legal acceleration and stronger braking
- responsive low-speed control
- differentiated sprint and stamina
- plant/reverse handling for large reversals
- persistent plant cuts for large high-speed cardinal changes
- smooth smaller-angle steering with athletic sprint weight
- deterministic wall/bounds collision
- legal slopes and steps
- deterministic short airborne falls from raised surfaces
- action request hooks for later jump/tackle mechanics
- record/replay movement traces
- 60 Hz Stage 03 player-controller cadence

### Input

- keyboard/mouse and standard gamepad normalize into the same gameplay intent
- mouse and right-stick camera look
- Shift/L3 sprint
- Space/gamepad A jump hook
- C/B/Ctrl/gamepad B tackle hook
- buffered discrete actions so short taps cannot disappear between render/simulation frames
- fixed mixed-device integration so right-stick camera use cannot erase active keyboard movement

### Camera

- direct yaw/pitch response with bounded pitch
- responsive smoothed follow target
- shoulder framing
- swept-volume-style obstruction handling
- immediate inward collision correction and smooth recovery
- restrained sprint FOV boost
- **trackpad pinch / wheel camera zoom**
- default camera distance 5.6 m
- user zoom envelope 3.4 m to 8.8 m
- smooth ~110 ms zoom settling
- obstruction collision always overrides requested zoom-out distance
- zoom remains presentation-only and does not enter deterministic movement/replay state

## Final automated verification

Verified on implementation head `60d72700e5ce9d81a8f67158b7e4664353fc4c88` in GitHub Actions run `39126817802`, job `117673577416`.

| Check | Result |
|---|---|
| Frozen pnpm install / supply-chain policy | PASS |
| Authoritative randomness guard | PASS |
| Private-content guard + negative probe | PASS |
| Strict TypeScript | PASS |
| Unit / contract suite | **74/74 PASS across 9 files** |
| Camera zoom direction / delta-mode normalization | PASS |
| Smooth bounded zoom 3.4–8.8 m | PASS |
| Zoom-out vs camera obstruction | PASS |
| Mixed keyboard + gamepad input regression | PASS |
| A/D camera-relative basis | PASS |
| No-orbit reverse regression | PASS |
| 90° sprint plant-cut regression | PASS |
| Graceful deterministic fall regression | PASS |
| Sprint differentiation | PASS |
| Movement render-rate invariance | PASS |
| Thin-wall tunneling protection | PASS |
| Stamina bounds | PASS |
| Camera authority separation | PASS |
| Camera direct-look / follow responsiveness | PASS |
| Production server + FICTIONAL_PUBLIC web build | PASS |
| Server health | PASS |
| Chromium E2E | **5/5 PASS** |
| Real browser wheel/trackpad-style zoom event | PASS |
| Stage 02 deterministic reference | **PASS, unchanged** |

Canonical Stage 02 determinism remains:
- tick rate: 30 Hz
- ticks: 10,000
- seed: `1511506142`
- hash: `d55b2d0b968372a5`

The Stage 03 browser player controller remains 60 Hz.

## TDD evidence for the final pass

The final zoom/bug-sweep change followed RED → GREEN.

RED head: `1fc8396bc2b03b11c993ad86a23b5cb18f891dc4`.

Workflow `39126498565` failed at TypeScript because the tests intentionally referenced behavior that did not yet exist:
- `normalizeWheelZoomDelta`
- camera `minDistance` / `maxDistance`
- `adjustZoom`
- `userDistance` / `desiredDistance`
- mixed-input `InputMerge`

After implementation, exact-head workflow `39126817802` passed all 74 unit/contract tests and all 5 Chromium tests.

## Bug sweep result

One additional correctness issue was found even though the owner had not noticed it during ordinary play: using keyboard movement while touching only the gamepad right stick could replace the active keyboard movement with zero-valued gamepad movement axes.

Fix:
- added a dedicated mixed-input merge layer
- gamepad movement only takes movement authority when its movement stick is actually active
- right-stick camera input can coexist with keyboard movement
- sprint and action bits are preserved across both devices
- regression tests cover both look-only and movement-active mixed-device cases

No other critical or important Stage 03 correctness defect was identified in the final focused review.

## Performance / non-blocking note

The final production client bundle is about **564.57 kB minified / 144.01 kB gzip**. Vite emits its >500 kB chunk warning. This remains far below the project’s global initial-playable transfer ceiling, but later stages should code-split before the client grows substantially.

## Acceptance variance

The planned five-blind-run scorecard and formal Reference Desktop latency distribution were not collected as a separate data set. They are not represented here as completed measurements.

The human owner instead:
1. repeatedly playtested the local build;
2. supplied concrete movement/camera defects;
3. retested the repaired controller;
4. declared the result perfect / passing;
5. explicitly instructed that this be the final Stage 03 pass and be merged after the last zoom feature and bug sweep are green.

This explicit owner acceptance is the basis for closing Stage 03 in this repository. The missing blind-cohort data should be treated as deferred product-validation evidence, not as fabricated Stage 03 evidence.

## Gate decision

**PASS.**

Stage 03 is accepted for integration to `main` under the human-owner acceptance variance above. The implementation is fully automated-test green, the known owner-reported feel defects are resolved, trackpad zoom is covered in real Chromium, and the additional mixed-device bug found during the final sweep is regression-tested.

Stage 04 may begin only after this documentation-inclusive branch head is green and PR #7 is merged to `main`.