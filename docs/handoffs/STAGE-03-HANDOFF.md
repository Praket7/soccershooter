# Stage 03 Worker Handoff — Movement, Camera, and Input Feel

## Task

Complete Stage 03 from `docs/superpowers/plans/stages/03-movement-camera-input.md`, incorporate iterative owner playtest feedback, add final presentation-side trackpad zoom, perform a focused final bug sweep, verify the complete branch, and prepare it for merge without beginning Stage 04 ball work.

## Source files read

The worker re-read the repository execution and source-of-truth chain before the final pass:
- `AGENTS.md`
- `DESIGN.md`
- `docs/design/DESIGN_PART_01.md`
- `docs/design/DESIGN_PART_02.md`
- `docs/design/DESIGN_PART_03.md`
- `docs/design/DESIGN_PART_04.md`
- `docs/ai/AI_EXECUTION_CONTRACT.md`
- `docs/superpowers/specs/2026-10-17-soccershooter-design.md`
- `docs/superpowers/plans/2026-10-17-soccershooter-master.md`
- `docs/superpowers/plans/stages/03-movement-camera-input.md`
- `docs/gates/STAGE-02-GATE.md`
- `docs/constraints/FREE_TOOL_MATRIX.md`
- `docs/constraints/CONTENT_MODES.md`

The final bounded change also used the repository's Superpowers workflow for brainstorming, TDD, verification, pre-merge review, and branch finishing.

## Final Stage 03 implementation

### Movement
- deterministic camera-relative kinematic athlete controller
- normalized diagonal movement
- bounded acceleration / stronger braking
- responsive low-speed control
- 8.8 m/s sprint vs 5.2 m/s jog
- stamina drain / exhaustion / recovery
- plant-and-reverse behavior for near-180° reversals
- persistent plant-cut behavior for large high-speed direction changes
- smoother smaller-angle sprint steering
- thin-wall collision protection
- field bounds, slopes, legal steps
- deterministic short airborne falling and landing from raised surfaces
- 60 Hz browser player-controller cadence
- deterministic movement trace record/replay

### Input
- WASD / arrows
- mouse camera
- standard gamepad left/right sticks
- Shift / L3 sprint
- Space / gamepad A jump hook
- C / B / Ctrl / gamepad B tackle hook
- short discrete action buffering until an authoritative simulation tick consumes the request
- clear visual acknowledgement for sprint, jump hook, and tackle hook
- mixed-device merge logic so right-stick camera use cannot erase active keyboard movement

### Camera
- direct manual yaw/pitch
- balanced mouse/gamepad sensitivity after owner playtest
- target follow smoothing at 0.07 s
- shoulder framing
- pitch bounds
- swept-volume-style camera obstruction
- immediate inward correction / smooth outward recovery
- restrained sprint FOV response
- trackpad pinch / wheel zoom
- 5.6 m default distance
- 3.4–8.8 m bounded zoom envelope
- approximately 110 ms nominal zoom settling
- obstruction remains authoritative over zoom-out distance
- zoom is presentation-only and excluded from deterministic movement/replay state and simulation-latency telemetry

## Files changed in the final zoom / bug-sweep pass

- `apps/web/src/input/ActionMap.ts`
- `apps/web/src/input/ActionMap.test.ts`
- `apps/web/src/input/InputMerge.ts`
- `apps/web/src/input/InputMerge.test.ts`
- `apps/web/src/camera/ThirdPersonCamera.ts`
- `apps/web/src/camera/ThirdPersonCamera.test.ts`
- `apps/web/src/main.ts`
- `e2e/movement.spec.ts`
- `docs/gates/STAGE-03-GATE.md`
- `docs/handoffs/STAGE-03-HANDOFF.md`

## TDD evidence

Final-pass RED head: `1fc8396bc2b03b11c993ad86a23b5cb18f891dc4`.

CI run `39126498565` failed for the intended missing contracts before production implementation existed:
- wheel/trackpad zoom normalization
- camera min/max user distance
- smooth camera zoom state
- obstruction-safe zoom behavior
- mixed keyboard/gamepad input merge

Final implementation head before documentation: `60d72700e5ce9d81a8f67158b7e4664353fc4c88`.

Exact-head CI run `39126817802`, job `117673577416` passed:
- frozen install / supply-chain policy
- source and private-content guards
- strict TypeScript
- **74/74 unit/contract tests across 9 files**
- canonical determinism trace
- production server + FICTIONAL_PUBLIC web build
- server health
- **5/5 Chromium E2E tests**
- real browser wheel zoom regression
- movement/camera/action-hook browser regressions
- Node/browser deterministic parity

Stage 01 contract workflow `39126817817` also passed on the same implementation head.

Canonical Stage 02 determinism remains unchanged:
- tick rate 30 Hz
- 10,000 ticks
- seed `1511506142`
- hash `d55b2d0b968372a5`

## Final bug sweep

A mixed-device bug was found during the final review even though it had not been reported during normal owner testing.

Before the fix, any active gamepad frame could replace the complete keyboard gameplay intent. Therefore, keyboard movement plus right-stick-only gamepad camera input could zero the keyboard movement axes and stop the player.

The final merge layer now:
- preserves keyboard movement when the gamepad movement stick is neutral
- allows gamepad movement to take movement authority when it is actually active
- combines camera look correctly
- preserves sprint if either active device requests it
- ORs action bits across both devices

Unit regressions cover both mixed-device cases.

No other critical or important Stage 03 correctness defect was found in the focused final review.

## Playtest / gate decision

The owner performed multiple iterative local playtests, reported concrete issues, retested repaired builds, then stated the movement/camera result was **perfect** and that **everything passes**. The owner explicitly instructed that the final zoom + bug-sweep build should be treated as the final Stage 03 pass and merged to `main` when green.

The original plan's separate five-blind-run scorecard and formal Reference Desktop latency distribution were not independently collected. No scores are fabricated. `docs/gates/STAGE-03-GATE.md` records the owner acceptance as an explicit variance so the repository does not silently pretend those measurements exist.

Final Stage 03 gate: **PASS under explicit human-owner acceptance variance**.

## Known non-blocking note

The final production client bundle is about 564.57 kB minified / 144.01 kB gzip. This is well below the global initial-playable transfer ceiling, but Vite's >500 kB warning remains and later stages should introduce code splitting before the application grows substantially.

## Independent review limitation

No separate reviewer/subagent runtime is exposed in this chat environment. A focused self-review compared the final implementation against the Stage 03 plan, design constraints, automated tests, browser behavior, and diff scope. No unresolved critical/important issue was found.

## Gate impact

Stage 03 is complete and accepted for integration after a final documentation-inclusive CI run.

No Stage 04 ball code has been introduced.

## Exact next action

1. verify the documentation-inclusive Stage 03 branch head is fully green;
2. update PR #7 with the final evidence;
3. mark the PR ready if required by GitHub;
4. merge PR #7 into `main` using the exact expected head SHA;
5. verify `main` points to the merge result and its post-merge workflows are green;
6. begin Stage 04 only from the verified `main` base.