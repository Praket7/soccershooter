# Stage 02 Rulings

## Ruling 01 — Chat-mode isolation uses a dedicated stage branch

**Finding:** This chat can mutate GitHub branches and execute GitHub Actions, but cannot mount a local filesystem-backed Git worktree.

**Decision:** `stage/02-foundation` is the isolated Stage 02 workspace and was created from the verified Stage 01 head `457164abcd829dbac9359eb6ce3b260fe441d97b`. No Stage 02 implementation is written directly to Stage 01, the planning branch, or `main`.

**Cost if wrong:** A future local session can materialize this branch as a literal worktree without rewriting any stage history.

## Ruling 02 — Pin the Stage 02 toolchain rather than float `latest`

**Decision:** Stage 02 pins the package manager and development toolchain in repository metadata/lockfile. The foundation was implemented and verified with Node 24, pnpm 12.9.1, TypeScript 7.0.2, Vite 8.3.4, Vitest 5.0.5, Playwright 1.64.1, and tsx 4.23.15.

**Reason:** Determinism and reproducible CI are weakened by floating build/test tooling.

**Cost if wrong:** Future upgrades should be explicit PRs with a full foundation CI rerun and any required lockfile/tooling migration.

## Ruling 03 — Stage 02 simulation state is deliberately abstract

**Finding:** Stage 02 needs deterministic stepping, hashing, input ordering, PRNG ownership, and fixed-step presentation separation, but Stage 03 owns locomotion/camera and Stage 04 owns ball physics.

**Decision:** The Stage 02 `Simulation` tracks deterministic abstract input accumulators and RNG/tick state only. It does not implement player acceleration, collision, stamina, camera, ball state, passes, shots, tackles, or football rules.

**Reason:** This proves the deterministic architecture without pre-implementing later stages.

**Cost if wrong:** Later stages may extend/replace internal state while preserving Stage 02 public contracts and determinism tests.

## Ruling 04 — One canonical trace drives Node/browser parity

**Decision:** `packages/sim/src/referenceTrace.ts` defines one versioned seed/input trace and both the standalone Node runner and browser shell execute it.

**Reason:** Comparing two separately implemented scenarios can produce a meaningless “parity” pass.

**Additional safeguard:** Authoritative ID ordering uses direct code-point ordering (`a < b`) rather than locale-sensitive `localeCompare`, avoiding ICU/locale-dependent ordering differences between runtimes.

## Ruling 05 — Retain fixed-step backlog rather than silently discard time

**Decision:** The spiral cap limits work per presentation frame but does not silently delete accumulated simulation time. Diagnostics expose cap count, backlog, step count, interpolation alpha, and current simulation tick.

**Reason:** A protection mechanism that silently changes elapsed authoritative time makes determinism/debugging misleading.

**Cost:** Under a severe stall the simulation may need multiple presentation frames to catch up. Later networking/performance stages may define stronger overload policy, but any change must remain explicit and tested.

## Ruling 06 — `Math.random()` is forbidden in authoritative packages

**Decision:** Seeded randomness is owned by `packages/sim`; a repository guard rejects ambient `Math.random()` in authoritative sim/physics/bots/protocol/progression/replay production source.

**Reason:** Ambient randomness makes replays, cross-runtime equality, regression reproduction, and network authority unreliable.

**Cost:** New authoritative randomness must be explicitly threaded through deterministic seeded state.

## Ruling 07 — Protocol input is strict at the trust boundary

**Decision:** Required input-intent fields are checked explicitly. Movement is bounded, yaw normalized, malformed/non-finite values rejected, action bits constrained to uint32, and unexpected fields rejected.

**Reason:** Protocol drift and client-supplied malformed state should fail at the boundary rather than contaminate simulation code.

## Ruling 08 — Private reference content is blocked before production build

**Decision:** `FICTIONAL_PUBLIC` is the only deployable content mode. A source guard scans application/shared production source for direct `private/reference-content` references, and CI proves the guard fails by creating a temporary forbidden import before removing it and re-running clean.

**Reason:** The repo is public and private reference material must never become a production dependency.

**Limit:** This is a Stage 02 import-boundary guard, not a complete malicious-code taint analysis. Later release/security stages can strengthen it as the build graph grows.

## Ruling 09 — Minimal server shell only; Colyseus remains Stage 17

**Decision:** Stage 02 server code is a minimal Node HTTP health shell. It does not introduce multiplayer rooms, persistence, auth, matchmaking, networking prediction, or Colyseus.

**Reason:** Stage 02 must prove build/launch boundaries without pulling Stage 17 architecture forward.

## Ruling 10 — pnpm 12's lockfile format is intentional

**Finding:** With pnpm's package-manager environment pinning, the generated pnpm 12 lockfile contains an environment/package-manager document and the normal workspace dependency document.

**Decision:** Preserve pnpm-generated lockfile structure. Validate it operationally with a clean `pnpm install --frozen-lockfile` and pnpm's supply-chain policy check rather than rewriting YAML structure by hand.

**Reason:** The package manager owns its lockfile serialization. Hand-normalizing it would make reproducibility worse.

## Ruling 11 — Approve only the required install script

**Finding:** pnpm's supply-chain policy rejected esbuild's postinstall until it was explicitly allowed.

**Decision:** `pnpm-workspace.yaml` allows the `esbuild` build script and does not globally enable dependency scripts.

**Reason:** Vite requires esbuild's platform binary, but broad script execution is unnecessary.

## Ruling 12 — pnpm project settings belong in `pnpm-workspace.yaml`

**Finding:** Current pnpm configuration separates registry/auth `.npmrc` data from normal project settings.

**Decision:** Remove the Stage 02 `.npmrc` and keep `engineStrict`, `saveExact`, workspace patterns, and build-script approval in `pnpm-workspace.yaml`.

**Reason:** This follows current pnpm configuration semantics and keeps a future `.npmrc` reserved for registry/auth use if ever needed.

## Ruling 13 — Permanent CI is read-only

**Finding:** Chat mode needed a one-shot GitHub Action to have pnpm itself generate the lockfile because no local shell/worktree was available.

**Decision:** The temporary contents-write lockfile bootstrap workflow was removed after lockfile generation. Permanent `.github/workflows/ci.yml` has `contents: read` only.

**Reason:** Build/test CI should not mutate repository state.

## Ruling 14 — Do not fabricate local hardware performance evidence

**Decision:** Stage 02 proves simulation/runtime correctness and CI execution, but does not claim target local Mac FPS or 1% lows from a GitHub-hosted runner. The actual reference development machine must be measured by the benchmark harness when representative rendering/gameplay exists.

**Reason:** CI timing and GitHub-hosted hardware are not substitutes for the declared reference-hardware measurement contract.
