# Stage 01 Rulings

## Ruling 01 — Minimal test harness before Stage 02

**Finding:** Stage 01 requires TypeScript schemas and Vitest-backed automated validation, while Stage 02 owns the full pnpm monorepo, root package configuration, and CI foundation.

**Decision:** Stage 01 may add only the smallest root-level test/tooling files needed to execute Stage 01 validators. It must not scaffold simulation, apps, shared runtime packages, workspace package graphs, Vite, Playwright, or the Stage 02 CI matrix.

**Reason:** Stage 01 cannot pass its evidence gate without runnable validators, but pulling forward the full Stage 02 foundation would violate stage discipline.

**Cost if wrong:** Stage 02 may need to normalize or replace the minimal Stage 01 tooling while preserving the Stage 01 tests and contracts.

## Ruling 02 — Chat-mode isolation

**Finding:** The connected GitHub environment exposes branch operations and repository edits but no local filesystem-backed Git worktree or shell execution.

**Decision:** Use dedicated stage branches as the isolation boundary in chat mode. Do not modify `main` or the planning branch directly. Where command execution is required, use GitHub Actions or verifiable repository-native checks when available.

**Cost if wrong:** A later local Work session can recreate the same branch in a literal worktree without changing repository history or stage artifacts.
