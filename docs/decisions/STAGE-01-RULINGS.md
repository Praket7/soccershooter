# Stage 01 Rulings

## Ruling 01 — Minimal test harness before Stage 02

**Finding:** Stage 01 requires TypeScript schemas and Vitest-backed automated validation, while Stage 02 owns the full pnpm monorepo, root package configuration, and CI foundation.

**Decision:** Stage 01 may add only the smallest test execution path needed to run Stage 01 validators. It must not scaffold simulation, Vite applications, Playwright, shared runtime package graphs, or the Stage 02 CI matrix.

**Reason:** Stage 01 cannot produce executable evidence without a test runner, but pulling forward the entire foundation would violate stage discipline.

**Cost if wrong:** Stage 02 may normalize the temporary Stage 01 workflow/tooling while preserving the Stage 01 tests and contracts.

## Ruling 02 — Chat-mode isolation uses branches, not a literal filesystem worktree

**Finding:** The connected GitHub environment can create branches and edit repository objects, but this chat does not expose a local filesystem-backed Git checkout/worktree or arbitrary shell execution against the repo.

**Decision:** `stage/01-product-contract` is the isolation boundary. No Stage 01 implementation is written to `main` or the planning branch. Executable evidence is produced with GitHub Actions from the isolated branch.

**Reason:** This preserves repository isolation and reproducible execution while respecting the user's request to complete the work in chat rather than hand off to Work mode.

**Cost if wrong:** A later local session can check out the exact branch into a literal worktree without rewriting Stage 01 history or artifacts.

## Ruling 03 — Do not fabricate exact hardware specifications

**Finding:** The available context establishes an Apple Silicon arm64 macOS development machine but does not establish the exact SoC, RAM, or GPU configuration with sufficient confidence.

**Decision:** `REFERENCE_HARDWARE.md` defines an environment-capture requirement rather than inventing hardware facts. The current machine is the reference development profile after its actual specs are captured by the benchmark environment. The constrained fallback profile is explicitly a pressure test, not a false low-end-hardware claim.

**Reason:** Performance gates are only useful when their environment is truthful and reproducible.

**Cost if wrong:** The exact profile can be tightened later by adding measured hardware metadata; no simulation or quality threshold needs to change.
