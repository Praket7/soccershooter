# Stage 04 — Premium Football Physics

## AI execution mode

**Primary AI role:** Ball Physics Agent

This stage is executed by AI under `docs/ai/AI_EXECUTION_CONTRACT.md`. Before any change, the worker must read `/DESIGN.md`, the master plan, this stage, the previous gate, and every subsystem document linked below. The AI must produce the cheapest measurable proof first, write tests before implementation where applicable, capture evidence, and stop rather than beginning a future stage when this stage's gate fails.

**Required AI output for this stage:** implementation or artifact changes, automated tests/validators, evidence paths or reproducible seeds, a concise worker handoff, and the stage gate report. “Looks good” and “runs locally” are not acceptance evidence.


> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Use checkbox steps for progress.

**Tech Stack:** TypeScript, Rapier JS/WASM, deterministic math, Vitest

**Spec:** `docs/superpowers/specs/2026-10-17-soccershooter-design.md`  
**Master:** `docs/superpowers/plans/2026-10-17-soccershooter-master.md`

## Global Constraints

- No credit card, paid/timed trial, or adult-only account dependency.
- `FICTIONAL_PUBLIC` is the only deployable content mode.
- Simulation correctness outranks presentation shortcuts.
- Tests and measured gate evidence are required before the next stage.
- Do not implement later-stage scope unless a minimal interface is required to test this stage.

## Review Focus

- numerical instability
- energy gain
- knuckle randomness nondeterminism
- substep sensitivity
- unlearnably chaotic ball behavior

## Planned File Map

- `packages/physics/src/ball/BallState.ts`
- `packages/physics/src/ball/aerodynamics.ts`
- `packages/physics/src/ball/groundContact.ts`
- `packages/physics/src/ball/trajectory.ts`
- `packages/physics/src/ball/goldenTrajectories.test.ts`
- `apps/web/src/dev/BallLab.ts`
- `tools/perf/ball-fuzz.ts`

---

**Goal:** Build a deterministic ball that rolls, bounces, spins, curves, and knuckles convincingly while remaining learnable.

**Architecture:** Rapier handles broad rigid-body/collision infrastructure. `packages/physics` owns football-specific force/contact models using deterministic fixed substeps and calibration tables.

## Ball state

```ts
interface BallState {
  position: Vec3;
  velocity: Vec3;
  angularVelocity: Vec3;
  lastContact?: ContactTag;
}
```

Baseline values:
- mass: 0.436 kg
- radius: 0.11 m
- gravity: 9.81 m/s²

## Flight
Apply per substep:
- gravity
- quadratic drag
- Magnus force from `omega × velocity`
- spin decay
- bounded seeded low-spin knuckle perturbation

Do not run CFD in the game.

## Ground/contact
- restitution
- turf friction
- rolling resistance
- spin/translation coupling
- post/crossbar rigid collisions
- optional wall rebound profile
- goal plane determines scoring, not visual net deformation

## Ball Lab
Interactive/debug controls for:
- launch speed/angle
- spin axis/rate
- coefficient profile
- slow motion
- trajectory trail
- expected landing point
- CSV trace export

## Tasks

The checkboxes below track implementation tasks; owner playtest and subjective acceptance remain recorded separately in the stage gate.

- [x] Implement coefficient-table driven drag/Magnus/spin model.
- [x] Implement deterministic knuckle noise seeded from simulation.
- [x] Implement bounce and turf rolling model.
- [x] Implement trajectory predictor using the same equations.
- [x] Implement posts/crossbar benchmark.
- [x] Create golden trajectory fixtures.
- [x] Add random stress/fuzz launcher.
- [x] Build Ball Lab UI.
## Golden tests
- zero-spin shot stays near vertical plane
- sidespin curves in correct direction
- topspin drops sooner than zero-spin equivalent
- backspin carries/floats more
- stronger legal spin increases lateral deviation until configured saturation
- low-spin knuckle remains bounded and seed-repeatable
- bounce/roll remain stable
- post impact never creates energy explosion
- no NaN/Infinity across 1,000,000 random legal launches

## Exit gate
Golden reference suite passes for:
- 10 m driven pass
- 20 m straight shot
- 20 m curling shot
- 25 m power shot
- lofted pass
- chip
- low-spin knuckle
- post rebound

Ball Lab alone must feel satisfying to use.
