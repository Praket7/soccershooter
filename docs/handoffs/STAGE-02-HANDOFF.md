# Stage 02 → Stage 03 Handoff

## Completed scope

Stage 02 established the implementation foundation without starting gameplay movement/camera work:
- pinned pnpm/Node/TypeScript/Vite/Vitest/Playwright/tsx toolchain
- pnpm workspace with committed lockfile
- strict TypeScript configuration
- deterministic seeded PRNG owned by `packages/sim`
- Stage 02 simulation API and stable state hashing
- canonical input-trace serialization
- fixed-step simulation / presentation accumulator separation
- visible spiral-cap/backlog diagnostics
- canonical 10,000-tick Node/browser reference trace
- strict input protocol sanitizer
- authoritative `Math.random()` source guard
- private-reference production-source guard
- minimal `FICTIONAL_PUBLIC` web shell
- minimal server `/health` shell
- read-only GitHub Actions foundation CI
- browser parity and runtime launch smoke tests

## Verified implementation head

Implementation commit verified before gate-document creation:

`b0fe3eceb09c03c2d155a1065bddc3c562ef2920`

Full CI:
- workflow run `39096599755`
- job `117584254315`
- result: success

Canonical reference trace:
- tick rate: 30 Hz
- ticks: 10,000
- seed: `1511506142`
- final state hash: `d55b2d0b968372a5`

## TDD record

- Stage 02 RED: run `39095731242`, job `117581658662`
- first Stage 02 GREEN: run `39095824093`, job `117581931718`, 22/22 Stage 02 tests
- final full foundation CI before gate docs: run `39096599755`, job `117584254315`
- full suite: 43/43 tests plus Playwright browser parity

See `docs/gates/STAGE-02-GATE.md` for the acceptance mapping and integration fixes.

## Source-of-truth decisions carried forward

1. `packages/sim` owns authoritative tick/PRNG/deterministic state semantics.
2. Do not use `Math.random()` in authoritative sim/physics/bots/protocol/progression/replay production code.
3. Authoritative ordered collections must use deterministic ordering; do not introduce locale-dependent sorting into state/hash paths.
4. Rendering/presentation cadence may not determine authoritative simulation results.
5. Fixed-step overload/catch-up behavior must remain observable; do not silently throw away simulation time without an explicit reviewed policy change.
6. Protocol inputs are untrusted and must be sanitized before entering simulation.
7. `FICTIONAL_PUBLIC` is the only deployable content mode; `REFERENCE_PRIVATE` remains non-shippable.
8. `pnpm-workspace.yaml` holds project pnpm configuration and explicit build-script approvals.
9. Permanent CI must remain read-only unless a future task has an explicit, reviewed mutation need.
10. Do not use Stage 02 shell timings as representative gameplay FPS/performance evidence.
11. The web shell and server health shell are plumbing proofs; they are not designs to expand into final UI or multiplayer architecture by accident.

## Stage 03 required reading

Before Stage 03 implementation, read in order:
1. `AGENTS.md`
2. `DESIGN.md` and all linked design volumes
3. `docs/ai/AI_EXECUTION_CONTRACT.md`
4. architecture spec
5. master plan
6. `docs/gates/STAGE-01-GATE.md`
7. `docs/gates/STAGE-02-GATE.md`
8. `docs/QUALITY_BAR.md`
9. `docs/REFERENCE_HARDWARE.md`
10. `docs/PLAYTEST_SCORECARD.md`
11. `docs/decisions/STAGE-02-RULINGS.md`
12. `docs/superpowers/plans/stages/03-movement-camera-input.md`
13. content/free-tool constraints

## Stage 03 starting branch

After the Stage 02 documentation-inclusive CI is green, Stage 03 should branch from the final verified Stage 02 head into an isolated branch/worktree such as:

`stage/03-movement-camera-input`

Do not branch Stage 03 from Stage 01 or the planning branch.

## Stage 03 non-negotiable boundaries

Stage 03 owns:
- keyboard/mouse and gamepad intent mapping
- deterministic player movement controller behavior
- acceleration/deceleration and directional-turn behavior defined by the Stage 03 plan
- body orientation relative to camera intent as defined by the design
- third-person camera controller
- camera collision/obstruction response if included by the Stage 03 plan
- input→simulation→render timing instrumentation
- no-ball movement/camera playtest evidence

Stage 03 does **not** own:
- final ball physics/aerodynamics (Stage 04)
- receive/dribble/pass/shoot/tackle gameplay (Stage 05)
- tactical bots (Stage 06)
- final animation/art (later stages)
- multiplayer prediction/reconciliation (Stage 17)

## Preserve Stage 02 regression proofs

Every Stage 03 CI must continue to prove:
- frozen workspace install
- `Math.random()` guard
- private-reference guard
- strict typecheck
- Stage 01/02 unit contracts
- 100 × 10,000 deterministic repeat
- 60/120/144 cadence invariance
- Node/browser canonical trace parity
- public web/server build/launch

If Stage 03 intentionally changes canonical simulation hashing or trace semantics, it must explain the behavior change, update versioning, and preserve a clear migration/regression record. Do not merely replace the expected hash to make a failure green.

## Stop condition

This task stops at Stage 02. Do **not** create a Stage 03 implementation branch or add movement/camera code as part of this execution.
