# Stage 01 → Stage 02 Handoff

## Completed scope

Stage 01 established the product-quality and evidence contract before runtime implementation:
- measurable definitions for premium/fun/fair/fast/finished
- all-stage acceptance matrix
- reference/constrained hardware policy
- frame/simulation/render/long-task/memory/draw-call/payload definitions
- required network fault profiles
- privacy-preserving telemetry validation
- asset-provenance shipping validation
- stage-gate ID/path contract
- human playtest scorecard and behavioral signals
- performance/determinism/physics-golden evidence format
- balance tournament/exploit evidence format

## Source documents read before implementation

- `AGENTS.md`
- `DESIGN.md`
- all four design volumes
- `docs/ai/AI_EXECUTION_CONTRACT.md`
- architecture specification
- master implementation plan
- Stage 01 plan
- Stage 02 plan
- free-tool matrix
- content-mode contract
- stage-gate template
- plan self-review

## Stage 01 TDD record

- RED import failure: workflow `39095082614`
- meaningful RED: workflow `39095112131`, 19 failed / 2 passed
- first full implementation: 20 passed / 1 brittle case-sensitive documentation assertion
- GREEN: workflow `39095440936`, **21 passed / 21**

See `docs/gates/STAGE-01-GATE.md` for exact job IDs and acceptance mapping.

## Decisions carried into Stage 02

1. Stage 01's direct `npx vitest` workflow is temporary. Stage 02 owns the real pnpm workspace, committed lockfile, and CI foundation.
2. Chat-mode execution uses isolated GitHub branches rather than a literal filesystem-backed worktree.
3. Do not invent exact development-machine specs. The executable benchmark environment must capture them before making hardware claims.
4. `FICTIONAL_PUBLIC` is the only deployable content mode. `REFERENCE_PRIVATE` remains local-only and production-blocked.
5. No `Math.random()` may enter authoritative simulation packages once Stage 02 creates them.
6. Every deterministic result must be traceable to version, seed, tick count, inputs, and state hash.

## Stage 02 required reading

Before modifying Stage 02 files, read in order:
1. `AGENTS.md`
2. `DESIGN.md` and linked volumes
3. `docs/ai/AI_EXECUTION_CONTRACT.md`
4. architecture spec
5. master plan
6. `docs/gates/STAGE-01-GATE.md`
7. `docs/QUALITY_BAR.md`
8. `docs/REFERENCE_HARDWARE.md`
9. `docs/superpowers/plans/stages/02-foundation.md`
10. content/free-tool constraints

## Stage 02 non-negotiable proofs

- clean pnpm frozen-lockfile install
- lint / authority-random guard
- TypeScript typecheck
- unit tests
- same seed + same ordered inputs = identical final hash
- 100 repeated 10,000-tick deterministic runs pass
- presentation cadence at 60/120/144 Hz does not alter final sim hash
- Node and browser execute the same trace to the same hash
- malformed protocol inputs are rejected/clamped at boundary
- public fictional web build succeeds
- forced `private/reference-content` import causes production validation failure
- web shell launches in CI
- server shell launches in CI

## Stop condition

Stage 02 must stop at `docs/gates/STAGE-02-GATE.md`. Do not begin Stage 03 movement/camera implementation until that gate has a verified PASS.