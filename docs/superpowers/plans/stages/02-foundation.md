# Stage 02 — Monorepo, CI, and Deterministic Simulation Shell

## AI execution mode

**Primary AI role:** Lead Integrator + Platform/CI Agent

This stage is executed by AI under `docs/ai/AI_EXECUTION_CONTRACT.md`. Before any change, the worker must read `/DESIGN.md`, the master plan, this stage, the previous gate, and every subsystem document linked below. The AI must produce the cheapest measurable proof first, write tests before implementation where applicable, capture evidence, and stop rather than beginning a future stage when this stage's gate fails.

**Required AI output for this stage:** implementation or artifact changes, automated tests/validators, evidence paths or reproducible seeds, a concise worker handoff, and the stage gate report. “Looks good” and “runs locally” are not acceptance evidence.


> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Use checkbox steps for progress.

**Tech Stack:** TypeScript, pnpm, Vite, Vitest, Playwright, GitHub Actions

**Spec:** `docs/superpowers/specs/2026-10-17-soccershooter-design.md`  
**Master:** `docs/superpowers/plans/2026-10-17-soccershooter-master.md`

## Global Constraints

- No credit card, paid/timed trial, or adult-only account dependency.
- `FICTIONAL_PUBLIC` is the only deployable content mode.
- Simulation correctness outranks presentation shortcuts.
- Tests and measured gate evidence are required before the next stage.
- Do not implement later-stage scope unless a minimal interface is required to test this stage.

## Review Focus

- non-deterministic random/time calls
- cross-package dependency cycles
- browser/server trace mismatch
- private-content imports
- CI relying on local machine state

## Planned File Map

- `pnpm-workspace.yaml`
- `package.json`
- `tsconfig.base.json`
- `apps/web/package.json`
- `apps/server/package.json`
- `packages/sim/src/index.ts`
- `packages/sim/src/prng.ts`
- `packages/sim/src/fixedStep.ts`
- `packages/sim/src/determinism.test.ts`
- `.github/workflows/ci.yml`
- `.gitignore`

---

**Goal:** Create a GitHub-centered project skeleton and deterministic headless simulation that produces identical state from identical inputs.

**Architecture:** pnpm monorepo. Pure TypeScript simulation uses a fixed timestep and seeded PRNG. Browser, server, replay, bots, and tests depend on the same packages.

## Files
- Create `pnpm-workspace.yaml`
- Create root `package.json`, `tsconfig.base.json`
- Create `apps/web/`
- Create `apps/server/`
- Create shared packages from `AGENTS.md`
- Create `.github/workflows/ci.yml`
- Create `.gitignore` with `private/reference-content/`

## Required interfaces

```ts
export type SimTick = number;

export interface SimConfig {
  tickHz: number;
  seed: number;
}

export interface InputIntent {
  moveX: number;
  moveY: number;
  aimYaw: number;
  sprint: boolean;
  actionBits: number;
}

export function createSimulation(config: SimConfig): Simulation;
export function stepSimulation(sim: Simulation, inputs: ReadonlyMap<string, InputIntent>): void;
export function hashSimulationState(sim: Simulation): string;
```

## Tasks
- [ ] Configure workspace boundaries and exact lockfile.
- [ ] Add deterministic seeded PRNG owned by `packages/sim`.
- [ ] Lint/test to prohibit `Math.random()` inside authoritative packages.
- [ ] Implement fixed-step runner and presentation accumulator.
- [ ] Add spiral-of-death cap with visible diagnostic rather than silent time distortion.
- [ ] Add state hashing and input-trace serialization.
- [ ] Add Node headless runner for 10,000+ ticks.
- [ ] Add browser harness that replays the same trace.
- [ ] Add CI: install, lint, typecheck, unit tests, deterministic comparison, web build, server build.
- [ ] Add production-build guard that fails on imports from `private/reference-content`.

## Tests
- same seed + same inputs => same hash
- Node/browser hashes match
- render cadence at 60/120/144 Hz does not change final simulation hash
- malformed input intents are clamped/rejected at protocol boundary
- production build fails when private reference import is forced

## Exit gate
- clean clone installs/builds without manual hidden steps
- 100 repeated 10k-tick deterministic runs pass
- web shell launches
- server shell launches
- production fictional build succeeds
- intentionally importing private content fails CI
