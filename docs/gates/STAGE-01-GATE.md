# Stage 01 Gate — Product Contract, Benchmarks, and Measurement Harness

**Stage:** 01  
**Decision:** PASS  
**Implementation verification commit:** `c1aebcf453d6f60e76f3e170933032d2b006e7bf`  
**Verification workflow:** Stage 01 contracts  
**Workflow run:** `39095440936`  
**Job:** `117580797458`  
**Execution environment:** GitHub-hosted Ubuntu 24.04, Node 24.21.0, Vitest 3.2.4  
**Review mode:** self-review in chat because no independent subagent reviewer is exposed in this execution environment

## 1. Stage objective

Freeze the quality vocabulary, performance/network measurement definitions, playtest scorecard, privacy-safe telemetry/provenance contracts, balance/performance evidence formats, and exact stage-gate semantics before gameplay implementation expands.

## 2. Required artifacts

| Artifact | Result |
|---|---|
| `docs/QUALITY_BAR.md` | PASS — operational definitions, thresholds, known-defect rule, physics-golden format, and all 21 stage acceptance rows |
| `docs/REFERENCE_HARDWARE.md` | PASS — truthful available-hardware policy, FPS/1% low/sim/render/long-task/memory/draw-call/payload methods, network profiles |
| `docs/PLAYTEST_SCORECARD.md` | PASS — required feel dimensions, behavioral signals, privacy rule, alpha thresholds |
| `docs/ASSET_PROVENANCE.md` | PASS — source/author/license/modifications/shipping contract for all required asset classes |
| `packages/telemetry/src/events.ts` | PASS — event/provenance/gate types plus runtime validation |
| `packages/telemetry/src/schema.test.ts` | PASS — privacy, provenance, gate, and documentation contract tests |
| `tools/perf/README.md` | PASS — benchmark, determinism, responsiveness, golden-case evidence format |
| `tools/balance/README.md` | PASS — tournament, exploit, role, and reproducibility output format |
| `docs/decisions/STAGE-01-RULINGS.md` | PASS — scope/isolation/hardware rulings recorded |

## 3. TDD evidence

### RED 1 — missing implementation

Workflow run `39095082614`, job `117579740569` failed before test collection because `./events` did not exist. This proves the contract tests were introduced before the implementation module.

### RED 2 — meaningful behavioral failures

Workflow run `39095112131`, job `117579825337`:
- test files: 1 failed
- tests: **19 failed, 2 passed, 21 total**

Observed failures covered:
- identifying-field rejection
- nested identifying-field rejection
- unexpected telemetry-field rejection
- shippable provenance completeness
- `REFERENCE_PRIVATE` shipping/public-safety rules
- complete asset-kind coverage
- complete gate-stage IDs
- missing quality/hardware/scorecard/provenance documents

### Debugging correction

The first full implementation run reached **20 passed / 1 failed**. The remaining assertion searched Markdown case-sensitively for lowercase `jitter`, while the document correctly used `Jitter` as a table heading. Root cause was test brittleness, not a missing network contract. The test was normalized to lowercase without changing the product contract.

### GREEN

Workflow run `39095440936`, job `117580797458`:
- test files: **1 passed / 1**
- tests: **21 passed / 21**
- process exit: 0
- GitHub action versions: `actions/checkout@v7`, `actions/setup-node@v7`
- Node line: 24 LTS

## 4. Acceptance criteria

| Criterion | Evidence | Result |
|---|---|---|
| QUALITY_BAR contains no unresolved placeholder markers | automated test | PASS |
| Every later stage has measurable acceptance evidence | automated inspection of 21 stage plans + quality matrix | PASS |
| Telemetry rejects direct identifying fields | automated parameterized tests | PASS |
| Telemetry rejects nested identifying fields | automated test | PASS |
| Telemetry rejects unexpected collection fields | automated test | PASS |
| Provenance covers image/mesh/texture/audio/animation/font/code | automated set equality test | PASS |
| Shippable provenance requires source/author/license | automated negative tests | PASS |
| `REFERENCE_PRIVATE` cannot be public-safe/shippable | automated negative test | PASS |
| Canonical gate IDs include 01–20 plus 17A | automated exact-array test | PASS |
| Canonical gate path rule is deterministic | automated test | PASS |
| FPS, 1% low, sim/render, long task, memory, draw call, payload methods defined | automated documentation contract | PASS |
| 50/100/150 ms RTT, jitter, 2%/5% loss profiles defined | automated documentation contract | PASS |
| Required feel-score dimensions and rematch signal defined | automated documentation contract | PASS |
| Known-defect rule defined | `QUALITY_BAR.md` review | PASS |
| Balance-tournament output contract defined | `tools/balance/README.md` review | PASS |
| Performance/golden evidence format defined | `tools/perf/README.md` review | PASS |

## 5. Scope review

Comparison `setup/ai-build-plan...stage/01-product-contract` at implementation verification showed:
- branch ahead by 13 commits, behind by 0 at review time
- changed files limited to Stage 01 documentation, `packages/telemetry` contracts/tests, and the temporary Stage 01 CI workflow
- no Vite app scaffold
- no root pnpm workspace
- no simulation implementation
- no server implementation
- no gameplay/physics/bot implementation

This preserves Stage 02 ownership of the project foundation.

## 6. Performance measurements

Not applicable as a numeric runtime gate in Stage 01 because no render/game runtime exists yet. Stage 01 defines the measurement method and thresholds that later stages must execute. Fabricated hardware or frame-rate measurements were explicitly prohibited.

## 7. Playtest measurements

Not applicable to Stage 01 because no playable runtime exists. The scorecard, privacy rules, aggregation method, and north-star targets are now frozen for stages that have a playable loop.

## 8. Known defects / limitations

### Chat execution has no literal local worktree
The GitHub connector exposes isolated branch writes and GitHub Actions, but not a filesystem-backed local worktree. Isolation was implemented with `stage/01-product-contract`, and neither `main` nor the planning branch received Stage 01 implementation files.

### Reference machine exact specs not yet captured
The known environment is Apple Silicon arm64 macOS, but exact SoC/RAM/GPU facts were not fabricated. The first executable performance harness must capture those facts before a benchmark is called `reference-desktop`.

### Stage 01 CI is intentionally narrow
It uses a temporary direct Vitest invocation because Stage 02 owns the committed pnpm workspace, lockfile, full lint/typecheck/build CI, Vite, and Playwright foundation. This is an intentional stage-boundary decision, not a missing Stage 01 deliverable.

## 9. Deferred items and owner

| Item | Owner stage |
|---|---|
| pnpm workspace and frozen lockfile | 02 |
| full lint/typecheck/build CI | 02 |
| deterministic simulation/runtime execution | 02 |
| browser/headless determinism comparison | 02 |
| actual reference-hardware performance samples | first stage with representative runtime, beginning 02 for foundation diagnostics |
| human feel measurements | 03+ |

## 10. Gate decision

**PASS.** Stage 01 establishes executable privacy/provenance/gate checks and a measurable quality contract without implementing Stage 02 early.

Stage 02 may begin from this branch head after the final documentation-only gate/handoff commit receives the same Stage 01 contract suite successfully.