# Stage 03 Worker Handoff — Movement, Camera, and Input Feel

## Task

Implement Stage 03 from `docs/superpowers/plans/stages/03-movement-camera-input.md`: deterministic athlete locomotion, device-neutral input, third-person camera, movement diagnostics/trace replay, and the greybox benchmark course. Do not begin Stage 04 ball work.

## Source files read

Before implementation the worker read the repository execution contract and binding design chain, including:
- `AGENTS.md`
- `DESIGN.md`
- all four `docs/design/DESIGN_PART_*.md` volumes
- `docs/ai/AI_EXECUTION_CONTRACT.md`
- architecture/design spec
- master implementation plan
- Stage 03 plan
- Stage 02 gate/handoff/rulings
- `docs/QUALITY_BAR.md`
- `docs/REFERENCE_HARDWARE.md`
- `docs/PLAYTEST_SCORECARD.md`
- free-tool/content-mode constraints

Research also covered current browser Gamepad behavior/deadzones, responsive third-person camera/obstruction practice, game-feel research, and PhysicsFC's football-locomotion lessons. Research informed design choices but did not introduce copied game assets or private reference content.

## Files changed

Primary Stage 03 implementation:
- `packages/sim/src/player/PlayerState.ts`
- `packages/sim/src/player/movement.ts`
- `packages/sim/src/player/movement.test.ts`
- `packages/sim/src/player/movementTick.test.ts`
- `apps/web/src/input/ActionMap.ts`
- `apps/web/src/input/ActionMap.test.ts`
- `apps/web/src/input/GamepadAdapter.ts`
- `apps/web/src/camera/ThirdPersonCamera.ts`
- `apps/web/src/camera/ThirdPersonCamera.test.ts`
- `apps/web/src/debug/MovementHud.ts`
- `apps/web/src/main.ts`
- `apps/web/src/styles.css`
- `apps/web/src/vite-env.d.ts`
- `apps/web/index.html`
- `e2e/movement.spec.ts`
- `e2e/determinism.spec.ts`
- `packages/sim/package.json`
- `apps/web/package.json`
- `pnpm-lock.yaml`
- `vitest.config.ts`

Evidence/documentation:
- `docs/gates/STAGE-03-GATE.md`
- `docs/gates/STAGE-03-PLAYTEST.md`
- `docs/handoffs/STAGE-03-HANDOFF.md`

A temporary write-enabled workflow was used only to let pnpm generate the exact lockfile after Three.js was introduced; it was removed immediately afterward. Permanent CI remains read-only.

## Tests / evidence

Verified implementation commit before this documentation commit: `1209db36267ea0051b4bccf4c51c3a00a3fb90b1`.

Verified GitHub Actions run: `39122239166`, job `117660010750`.

Evidence:
- frozen pnpm install and supply-chain policy pass
- security/content guards pass and negative private-import probe is rejected
- strict TypeScript passes
- **61/61 unit/contract tests** pass across 8 files
- movement diagonal normalization, legal acceleration, stamina bounds, render-rate invariance, tunneling, slopes/steps, speed-dependent turning, and deterministic replay pass
- keyboard/gamepad normalization parity and deadzone tests pass
- camera authority separation, direct look response, obstruction recovery, and FOV envelope tests pass
- Stage 03 player controller is fixed at **60 Hz**, satisfying the structural <=16.67 ms scheduling interval requirement
- Stage 02 canonical 30 Hz deterministic trace remains unchanged at 10,000 ticks / seed 1511506142 / hash `d55b2d0b968372a5`
- server and FICTIONAL_PUBLIC production web build pass
- Chromium browser suite passes **3/3**
- browser runtime proves actual 60 Hz movement cadence, controllable movement, finite latency telemetry, and preserved Node/browser canonical parity

## Decisions

1. **Keep Stage 02's canonical deterministic shell intact.** Stage 03 adds the athlete controller as a pure deterministic subsystem rather than rewriting the proven Stage 02 parity trace.
2. **Use 60 Hz for Stage 03 athlete authority.** Final review caught that a 30 Hz movement controller could not structurally satisfy the binding one-render-frame acknowledgement budget at 60 FPS. A RED test was added first, then the runtime was moved to 60 Hz.
3. **Camera remains presentation-only.** It reads player state and cannot mutate authority; direct manual look is not hidden behind target smoothing.
4. **Movement intent and facing are separable.** Input intent is transformed relative to aim yaw; high-speed direction changes are rate-limited while low-speed control stays agile.
5. **Use swept-volume-style camera obstruction.** The camera tests the target-to-camera segment against radius-expanded AABBs, retracts immediately when blocked, and recovers outward smoothly.
6. **Do not pull ball mechanics forward.** Jump/tackle are only request bits/state hooks. No ball, dribble, pass, shot, tackle mechanic, tactical AI, or final animation/art was added.
7. **Do not fake the feel gate.** The formal Stage 03 report is `FAIL` until real Reference Desktop and five-run blind human evidence exists.

## Assumptions

- Stage 03 remains a greybox feel lab rather than a visually representative final game scene.
- Standard Gamepad mapping is the supported controller contract for this stage.
- Benchmark obstacle geometry is simple and deterministic by design; richer arena collision belongs later.
- The current user development machine is the declared Apple Silicon macOS Reference Desktop, but exact hardware/browser facts must be captured at execution time rather than inferred.

## Known limitations

- No valid Reference Desktop latency distribution or frame-time evidence has been collected from chat/GitHub CI.
- Five blind human playtest runs have not been performed.
- Vite reports a large-chunk warning for the first Three.js bundle: ~560 kB minified / ~142.6 kB gzip. This is far below the <20 MB global initial playable transfer ceiling but should be watched as later systems arrive.
- Independent agent review is unavailable in this chat environment; whole-branch self-review was performed against the binding stage plan and quality bar.

No known critical/important automated correctness defect remains on the verified implementation commit.

## Gate impact

Automated Stage 03 implementation: complete and green.

Formal Stage 03 gate: **FAIL until empirical evidence is supplied**. This is intentional enforcement of the existing gate, not a code-regression result.

Do not merge Stage 03 and do not begin Stage 04 until `docs/gates/STAGE-03-PLAYTEST.md` is completed, thresholds pass, the gate report is updated to `PASS`, and a final green verification run is recorded.

## Exact next action

On the local Reference Desktop:

1. check out `stage/03-movement-camera-input`;
2. run the full command sequence in `docs/gates/STAGE-03-PLAYTEST.md`;
3. launch the movement lab at `http://127.0.0.1:4173`;
4. collect the Reference Desktop responsiveness evidence;
5. conduct at least five blind scored runs and record every valid run;
6. if a repeated feel defect appears, reproduce/fix it before passing the gate;
7. when all thresholds pass, update `STAGE-03-GATE.md` to `PASS`, rerun full CI, review, and only then merge with explicit approval.
