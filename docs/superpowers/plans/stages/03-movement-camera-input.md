# Stage 03 — Player Movement, Camera, and Input Feel

## AI execution mode

**Primary AI role:** Camera/Input + Gameplay Agent

This stage is executed by AI under `docs/ai/AI_EXECUTION_CONTRACT.md`. Before any change, the worker must read `/DESIGN.md`, the master plan, this stage, the previous gate, and every subsystem document linked below. The AI must produce the cheapest measurable proof first, write tests before implementation where applicable, capture evidence, and stop rather than beginning a future stage when this stage's gate fails.

**Required AI output for this stage:** implementation or artifact changes, automated tests/validators, evidence paths or reproducible seeds, a concise worker handoff, and the stage gate report. “Looks good” and “runs locally” are not acceptance evidence.


> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Use checkbox steps for progress.

**Tech Stack:** TypeScript simulation, Three.js camera, browser input APIs, Vitest

**Spec:** `docs/superpowers/specs/2026-10-17-soccershooter-design.md`  
**Master:** `docs/superpowers/plans/2026-10-17-soccershooter-master.md`

## Global Constraints

- No credit card, paid/timed trial, or adult-only account dependency.
- `FICTIONAL_PUBLIC` is the only deployable content mode.
- Simulation correctness outranks presentation shortcuts.
- Tests and measured gate evidence are required before the next stage.
- Do not implement later-stage scope unless a minimal interface is required to test this stage.

## Review Focus

- input latency
- diagonal speed exploits
- render-FPS dependence
- camera wall jitter
- controller/keyboard parity

## Planned File Map

- `packages/sim/src/player/PlayerState.ts`
- `packages/sim/src/player/movement.ts`
- `packages/sim/src/player/movement.test.ts`
- `apps/web/src/input/ActionMap.ts`
- `apps/web/src/input/GamepadAdapter.ts`
- `apps/web/src/camera/ThirdPersonCamera.ts`
- `apps/web/src/debug/MovementHud.ts`

---

**Goal:** Make running around an empty greybox field feel excellent before the ball exists.

**Architecture:** Deterministic kinematic player controller in shared simulation. Camera is presentation-only. Keyboard/mouse and gamepad map into the same action intents.

## Systems

Movement:
- acceleration/deceleration curves
- precise low-speed movement
- sprint and stamina
- high-speed turn limits
- collision/slopes/steps
- tackle/jump placeholders only as state hooks

Camera:
- centered/shoulder third-person follow
- yaw/pitch controls
- obstruction/camera collision
- sensitivity/invert options
- optional sprint FOV response
- camera smoothing that never delays gameplay aim intent

## Files
- Create `packages/sim/src/player/PlayerState.ts`
- Create `packages/sim/src/player/movement.ts`
- Create `packages/sim/src/player/movement.test.ts`
- Create `apps/web/src/input/ActionMap.ts`
- Create `apps/web/src/camera/ThirdPersonCamera.ts`
- Create `apps/web/src/debug/MovementHud.ts`

## Tasks

The checkboxes below track implementation tasks; owner playtest and subjective acceptance remain recorded separately in the stage gate.

- [x] Implement capsule/kinematic body state.
- [x] Implement deterministic acceleration, braking, sprint, and turning.
- [x] Implement stamina drain/recovery.
- [x] Implement field collision and benchmark obstacles.
- [x] Implement keyboard/mouse action map.
- [x] Implement gamepad parity.
- [x] Implement camera collision and configurable comfort settings.
- [x] Add movement trace recording/replay.
- [x] Build movement benchmark course: sprint, cut, stop, slalom, tight corridor, wall camera test.
## Tests
- diagonal input normalized
- legal max acceleration never exceeded
- stamina never negative or over max
- movement invariant to render FPS
- collision cannot tunnel at legal top speed
- camera cannot mutate authoritative state
- controller and keyboard can generate equivalent normalized intents

## Exit gate — Playtest
At least five blind scored runs:
- movement responsiveness median >= 8/10
- camera comfort median >= 8/10
- no repeated “floaty/icy/camera fights me” complaint
- slalom time improves with practice, proving learnable control

Final character art remains blocked.
