# Stage 02 Gate — Monorepo and Deterministic Simulation Foundation

**Stage:** 02  
**Decision:** PASS  
**Verified implementation commit:** `b0fe3eceb09c03c2d155a1065bddc3c562ef2920`  
**Full verification workflow run:** `39096599755`  
**Full verification job:** `117584254315`  
**Runner:** GitHub-hosted Ubuntu 24.04.5  
**Node:** 24.21.0  
**pnpm:** 12.9.1  
**Review mode:** self-review in chat; no independent reviewer/subagent runtime is exposed in this environment

## 1. Stage objective

Create the reproducible project foundation before gameplay implementation expands:
- pnpm workspace and committed lockfile
- deterministic seeded simulation shell
- fixed-step simulation separated from presentation cadence
- stable state hash / input trace format
- strict input protocol boundary
- authoritative randomness guard
- private-reference production guard
- minimal browser/server runtime shells
- cross-runtime Node/browser determinism proof
- read-only CI that proves install, type, test, build, launch, security, and browser parity

Stage 02 intentionally does **not** implement Stage 03 movement/camera or Stage 04 football/ball physics.

## 2. TDD evidence

### RED — tests before implementation

Workflow run `39095731242`, job `117581658662` ran the Stage 02 expectations before the foundation implementation existed.

Expected failures included:
- missing simulation module
- missing fixed-step implementation
- missing input protocol sanitizer
- missing authoritative-randomness guard
- missing private-reference import guard

The clean-source guard tests also prevented a false green: a nonexistent guard script exited nonzero, so the corresponding positive acceptance tests failed until real scripts existed.

### First Stage 02 GREEN — foundation behavior

Workflow run `39095824093`, job `117581931718` passed **22/22 Stage 02 foundation tests**.

That run proved:
- same seed + same ordered inputs → same hash after 10,000 ticks
- **100 repeated 10,000-tick runs** → baseline hash every time
- different seeds participate in authoritative state
- input-trace serialization is independent of `Map` insertion order
- 60, 120, and 144 Hz presentation cadence → identical final simulation hash/tick count
- spiral cap is visible and preserves backlog rather than silently deleting simulation time
- protocol movement clamping / yaw normalization
- malformed/non-finite protocol fields rejected
- missing/unexpected protocol fields rejected
- clean authoritative source accepted
- `Math.random()` in authoritative source rejected
- clean public source accepted
- direct production reference to `private/reference-content` rejected

## 3. Integration failures found and fixed

The stage did not treat the first unit-test green as completion. Full workspace CI exposed several real integration issues.

### pnpm supply-chain policy blocked esbuild

A frozen install recognized the lockfile but refused esbuild's required postinstall because no build-script permission had been granted.

**Fix:** add a narrow `allowBuilds: { esbuild: true }` policy in `pnpm-workspace.yaml`. No global dependency-script bypass was enabled.

### Strict TypeScript 7 indexed lookup

TypeScript 7 correctly flagged Stage 01 telemetry code where `EVENT_KEYS[eventType]` could be undefined under strict indexed-access analysis.

**Fix:** explicitly retrieve/narrow the allowed-key set and reject unsupported event types before use. Validation was strengthened rather than disabled.

### Vitest discovered a Playwright spec

The unit test runner initially discovered `e2e/determinism.spec.ts`, so Playwright's `test()` API was invoked under Vitest even though the actual unit tests passed.

**Fix:** add explicit `vitest.config.ts` include/exclude boundaries so unit/contract and browser-e2e suites remain separate.

### pnpm 12 lockfile structure investigation

The generated lockfile contains pnpm's package-manager environment document plus the normal workspace dependency document. It was initially mistaken for accidental duplication.

**Resolution:** preserve pnpm-generated structure and validate it operationally with a clean `pnpm install --frozen-lockfile` plus pnpm's supply-chain-policy verification. The temporary write-enabled lockfile bootstrap workflow was removed; permanent CI is read-only.

### Package-boundary cleanup

`packages/protocol` initially referenced `../../sim/src/index` directly even though `@soccershooter/sim` was a declared workspace dependency.

**Fix:** consume the public workspace package boundary instead. The full CI passed after this cleanup.

## 4. Final full CI evidence

Workflow run `39096599755`, job `117584254315` completed successfully on implementation commit `b0fe3eceb09c03c2d155a1065bddc3c562ef2920`.

| Check | Evidence | Result |
|---|---|---|
| Checkout / read-only token | GitHub token `Contents: read` | PASS |
| Exact runtime | Node `v24.21.0`; pnpm `12.9.1` | PASS |
| Frozen install | all 12 workspace projects; lockfile up to date | PASS |
| Supply-chain policy verification | 114 lockfile entries verified | PASS |
| Dependency build scripts | only explicitly approved esbuild postinstall executed | PASS |
| Authoritative randomness guard | `Math.random()` production scan | PASS |
| Private reference guard | clean source scan | PASS |
| TypeScript typecheck | `tsc -p tsconfig.json --noEmit` | PASS |
| Unit/contract suite | 4 files, **43/43 tests** | PASS |
| Stage 02 behavior subset | **22/22 Stage 02 tests** within full suite | PASS |
| 100 × 10,000 deterministic repeat | deterministic test | PASS |
| 60/120/144 presentation invariance | deterministic test | PASS |
| Standalone Node headless trace | 10,000 ticks, seed `1511506142` | PASS |
| Canonical Node state hash | `d55b2d0b968372a5` | PASS |
| Negative private-import proof | injected forbidden import caused guard failure | PASS |
| Guard recovery after probe removal | clean guard rerun | PASS |
| Server build | strict TypeScript emitted server shell | PASS |
| Public web build | Vite 8.3.4 `FICTIONAL_PUBLIC` build | PASS |
| Web output | `index.html` 0.38 kB; JS 4.74 kB (2.28 kB gzip) | PASS — shell evidence only, not gameplay payload claim |
| Server launch | built server listened on `127.0.0.1:3011` | PASS |
| Server health | `status=ok`, `contentMode=FICTIONAL_PUBLIC` | PASS |
| Chromium install | Playwright browser/deps installed | PASS |
| Browser/Node parity | browser executed the canonical trace and matched Node expected hash/ticks | PASS |
| Browser shell launch | Playwright found `SoccerShooter Foundation` page | PASS |

## 5. Determinism contract evidence

### Canonical trace

`packages/sim/src/referenceTrace.ts` is the single parity scenario used by both runtimes.

Current reference result:
- simulation version: 1
- tick rate: 30 Hz
- ticks: 10,000
- seed: `1511506142` (`0x5a17c0de`)
- state hash: **`d55b2d0b968372a5`**

The browser test does not contain a separately hard-coded simulation implementation. It loads the web shell, which executes the same shared sim package; Playwright computes the expected Node result and checks the browser-exposed tick count/hash.

### Presentation-cadence independence

The fixed-step test runs the same simulation over 10 presentation seconds at:
- 60 Hz
- 120 Hz
- 144 Hz

Every path reaches 300 simulation ticks and the same final state hash.

### Spiral/catch-up behavior

A one-second stall with a 5-step cap:
- executes only the configured maximum in that presentation frame
- reports `capped: true`
- increments `capCount`
- exposes retained `backlogSeconds`
- does **not** silently discard authoritative elapsed time

Subsequent zero-delta advances consume the backlog to the correct tick count.

## 6. Protocol / trust-boundary evidence

`sanitizeInputIntent`:
- accepts only `moveX`, `moveY`, `aimYaw`, `sprint`, `actionBits`
- requires every field
- rejects unexpected fields such as client-supplied score-like data
- rejects NaN and infinities
- clamps movement to `[-1, 1]`
- normalizes yaw to `[-π, π)`
- requires Boolean sprint
- requires unsigned 32-bit integer action bits

This keeps malformed client intent outside authoritative simulation code.

## 7. Content/security evidence

### Authoritative randomness

The production-source guard scans:
- `packages/sim`
- `packages/physics`
- `packages/bots`
- `packages/protocol`
- `packages/progression`
- `packages/replay`

Tests prove both acceptance of clean source and rejection of `Math.random()` in authoritative source.

### Private reference content

The production-source guard scans `apps` and `packages` for direct `private/reference-content` references.

CI creates a temporary forbidden import:

`apps/web/src/__private_import_probe.ts`

The guard must return nonzero. CI then removes the probe and requires the guard to pass again before building.

The production web build is therefore validated only after the fictional-public boundary is clean.

## 8. Monorepo / runtime boundaries

Workspace packages created:
- `apps/web`
- `apps/server`
- `packages/sim`
- `packages/physics`
- `packages/bots`
- `packages/protocol`
- `packages/content`
- `packages/progression`
- `packages/replay`
- `packages/telemetry`
- `packages/ui-contracts`

The server is intentionally a health-check shell, not a multiplayer implementation. Colyseus, rooms, prediction, reconciliation, auth, persistence, leaderboards, and matchmaking remain later-stage work.

The web shell exists to prove build/launch/browser execution and shared-simulation parity. It is not a gameplay UI and contains no Stage 03 movement/camera implementation.

## 9. Scope review

Comparison of `stage/01-product-contract...stage/02-foundation` found the Stage 02 diff limited to:
- workspace/toolchain configuration
- committed pnpm lockfile
- package boundaries
- deterministic sim/fixed-step/reference-trace shell
- protocol boundary
- source/security guards
- minimal browser/server shells
- Node/browser test harnesses
- read-only CI
- Stage 02 documentation

Explicitly **not present**:
- player movement controller
- third-person camera
- input-to-motion gameplay mapping
- ball object/ball physics
- Rapier integration
- dribbling, passing, shooting, tackling
- bots/tactical behavior
- Road to Legend gameplay
- Three.js gameplay renderer
- final UI/art/audio
- multiplayer/netcode/Colyseus
- auth/cloud saves/leaderboards

No Stage 03 implementation has begun.

## 10. Performance measurements

Stage 02 does **not** claim local-reference-desktop FPS/1% low numbers. The CI runner is not the declared reference game machine, and the runtime is only a foundation shell rather than representative gameplay/rendering.

Measured CI execution time for the Node 10,000-tick trace was ~26.8 ms in the verified run, but this is recorded only as diagnostic evidence, **not** as the gameplay performance target or a local-hardware benchmark.

Actual FPS, 1% low, long-task, draw-call, memory, and gameplay payload gates begin when a representative runtime exists and must follow `docs/REFERENCE_HARDWARE.md`.

## 11. Known limitations / deferred items

### Literal local worktree unavailable in chat
Branch isolation was used because the GitHub connector does not expose a filesystem-backed local `git worktree`. Repository history remains compatible with creating one later.

### Independent reviewer unavailable
The whole-branch review is a self-review in the authoring context. A fresh human/agent reviewer before merging the stacked PR is stronger and recommended, but no unresolved critical/important defect was found in the self-review.

### Stage 02 private-content guard is intentionally bounded
It catches direct source references/imports. It is not a general malicious-code dataflow analyzer. Release/security stages should expand build-graph/content-manifest validation as the asset pipeline becomes real.

### No real-game rendering performance claim
The web shell proves browser execution/parity only. Stage 03+ must add real responsiveness/performance instrumentation rather than extrapolate from this shell.

## 12. Deferred work ownership

| Deferred item | Owner stage |
|---|---|
| movement/input gameplay controller | 03 |
| third-person camera | 03 |
| representative input-to-visible latency | 03 |
| ball/Rapier/aerodynamics | 04 |
| receive/dribble/pass/shoot/defense | 05 |
| tactical/adaptive bots | 06–07 |
| techniques/progression/content systems | 08–10 |
| production art/animation/arena/rendering | 11–15 |
| full UI/onboarding/accessibility | 16 |
| Colyseus/netcode | 17 |
| auth/cloud/verified leaderboards | 17A |
| replay/highlight product | 18 |
| full performance/security/balance hardening | 19 |
| alpha cohort metrics | 20 |

## 13. Gate decision

**PASS.** Stage 02 establishes a reproducible, strict, deterministic, cross-runtime foundation and production-content boundary without entering Stage 03 gameplay scope.

The Stage 02 branch should receive one final documentation-inclusive CI run after this gate/handoff documentation is committed. Stage 03 must not begin unless that final branch-head CI remains green.