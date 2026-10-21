# Athlete Movement Realism Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make starts, running, cuts, reversals, and stops read as one believable athlete while preserving the working controls, legal ball contacts, and approved skill moves.

**Architecture:** Keep movement deterministic in `packages/sim`; pass realized movement cues into the existing athletic motion state. Refine the Three.js procedural proxy to consume those cues for body posture, gait, foot plants, and arm swing. The renderer remains presentation-only, and contact plans remain authoritative.

**Tech Stack:** TypeScript, fixed-step simulation, Three.js, Vitest.

**Spec:** `docs/superpowers/specs/2026-10-20-athlete-movement-realism-design.md`

## Global Constraints

- Simulation controls physical motion.
- Presentation-only state can never determine authoritative outcomes.
- Render cadence never controls simulation results.
- Preserve input semantics, ball retention/contact legality, and approved Elastico/step-over behavior.
- Do not add a critical-path paid, timed-trial, or adult-only dependency.
- Keep this pass to the existing deterministic movement model and procedural athlete proxy; do not begin the full Stage 13 animation inventory.
- Preserve unrelated dirty-worktree changes and do not reset, stash, or overwrite them.

## Review Focus

- Sprint release: braking posture must appear before the athlete settles; check a full-speed input release in `movementRealism.test.ts` and the proxy pose test.
- Fast reversal: support planting and trunk rotation must remain continuous without a one-frame facing or foot snap; check the 180-degree reversal in movement and proxy regression tests.
- Lateral/backward travel: pose must show a deliberate turned/side-on movement mode rather than a sideways body glide; check both directions in proxy regression tests.
- Idle and low-speed transition: gait must settle without phase popping or residual bobbing; check walk-to-idle and jog-to-stop cases.
- Planned touch during a cut: visible contact foot must remain inside the plan's geometry tolerance; preserve and exercise the contact-plan proxy regression.

---

## File Map

- `packages/sim/src/player/athleticMotion.ts` — carry realized acceleration and momentum-aware gait/posture cues in deterministic state.
- `packages/sim/src/player/PlayerState.ts` — preserve/deep-clone any added athletic motion vector field.
- `packages/sim/src/player/movement.ts` — provide the realized acceleration computed by the authoritative velocity step.
- `packages/sim/src/player/athleticMotion.test.ts` — verify cue direction, boundedness, and fixed-step consistency.
- `packages/sim/src/player/movement.test.ts` — verify existing movement envelopes remain unchanged through starts, turns, and stops.
- `apps/web/src/presentation/ProceduralAthleteProxy.ts` — apply smooth momentum-aware trunk, hip, gait, support, and arm pose changes.
- `apps/web/src/presentation/ProceduralAthleteProxy.regression.test.ts` — verify pose continuity, directional movement, stance, and contact synchronization.

## Tasks

### Task 1: Add realized movement cues to athletic motion state

**Files:**
- Modify: `packages/sim/src/player/athleticMotion.ts`
- Modify: `packages/sim/src/player/PlayerState.ts`
- Modify: `packages/sim/src/player/movement.ts`
- Test: `packages/sim/src/player/athleticMotion.test.ts`
- Test: `packages/sim/src/player/movement.test.ts`

**Interfaces:**
- `stepAthleticMotion(previous, input)` receives the actual horizontal acceleration for the completed movement tick.
- `AthleticMotionState` stores a finite `{ x, z }` realized-acceleration vector alongside its existing gait and posture signals; creation and cloning initialize/copy it.

- [x] Add failing assertions for forward acceleration lean, braking lean, lateral-cut response, finite bounds, and zero acceleration at rest.
- [x] Run the two focused simulation test files and confirm the new assertions fail for the missing cue.
- [x] Compute realized acceleration in `stepPlayerMovement` from the old and new horizontal velocity over `deltaSeconds`; pass it into `stepAthleticMotion` and derive bounded, smoothly changing posture cues from actual acceleration plus existing turn/plant signals.
- [x] Run the two focused simulation test files; confirm existing sprint, braking, reversal, and deterministic movement expectations remain intact.

### Task 2: Make the procedural athlete respond as a coordinated runner

**Files:**
- Modify: `apps/web/src/presentation/ProceduralAthleteProxy.ts`
- Test: `apps/web/src/presentation/ProceduralAthleteProxy.regression.test.ts`
- Test: `apps/web/src/presentation/ProceduralAthleteProxy.test.ts`

**Interfaces:**
- Consume `AthleticMotionState` only; do not add a render-to-simulation write path.
- Keep public `ProceduralAthleteProxy.update()` and `ProceduralAthletePose` contracts unchanged unless the existing pose diagnostics require a backward-compatible field.

- [x] Add failing proxy regressions for turn counter-rotation and swing-knee recovery; retain existing direction, idle, planted-foot, and contact regressions as baselines.
- [x] Run the focused proxy test files and confirm the new pose assertions fail before implementation.
- [x] Update force-driven trunk/head posture, pelvis counter-rotation, swing-knee recovery, and opposing arm balance using realized acceleration, speed, gait phase, and body yaw. Keep the already calibrated stride cadence, foot placement, and support-foot behavior unchanged.
- [x] Preserve technique cue overrides and planned-foot contact placement; skill animations must not overwrite ordinary locomotion state or contact legality.
- [x] Run the focused proxy test files and verify the new regressions plus existing foot-lock and contact-plan checks pass.

### Task 3: Integrate and review the complete movement envelope

**Files:**
- Review: `packages/sim/src/player/movementProfessionalRebuild.test.ts`
- Review: `packages/sim/src/player/movementRealism.test.ts`
- Review: `apps/web/src/presentation/turnCarry.integration.test.ts`
- Review: `apps/web/src/presentation/ProceduralAthleteProxy.regression.test.ts`
- Update: `docs/gates/STAGE-05R-GATE.md` only if the active stage contract confirms this follow-up belongs in that gate.

- [x] Confirm the active stage, immediately previous gate, and all required design/AI/constraint documents listed by `AGENTS.md`; stop before product-code edits if the requested scope belongs to a blocked later stage.
- [x] Run the stage-appropriate focused movement, turn-carry, and presentation regression suite; record the existing failing ball-retention integration bounds in the Stage 05R gate.
- [x] Run typecheck and production build; confirm no renderer state changes authoritative movement or ball state.
- [ ] Replay forward start/sprint/release, jog/sprint cuts, reverse, lateral/backpedal, tight turns, and ball-carry contacts in Safari; inspect body/feet and ball contact together at normal speed and slow playback.
- [x] Record concrete remaining limitations in the gate report; do not claim motion-captured or fully professional realism from procedural animation alone.

## Self-review

- Spec coverage: deterministic simulation authority is covered by Tasks 1 and 3; gait/body/stance changes by Task 2; ball/contact synchronization by Task 2 and Task 3; dependency and stage limits are global constraints.
- Type consistency: realized acceleration is `{ x: number; z: number }`, stored in `AthleticMotionState`, populated by `stepPlayerMovement`, and consumed read-only by the proxy.
- Failure cases: all five review-focus cases map to named simulation or presentation tests.
- Scope: no new animation subsystem, rig, asset pipeline, control remap, or ball physics behavior is introduced.
