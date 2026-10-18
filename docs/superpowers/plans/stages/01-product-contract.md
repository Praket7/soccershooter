# Stage 01 — Product Contract, Benchmarks, and Measurement Harness

## AI execution mode

**Primary AI role:** Lead Integrator + Measurement/Research Agent

This stage is executed by AI under `docs/ai/AI_EXECUTION_CONTRACT.md`. Before any change, the worker must read `/DESIGN.md`, the master plan, this stage, the previous gate, and every subsystem document linked below. The AI must produce the cheapest measurable proof first, write tests before implementation where applicable, capture evidence, and stop rather than beginning a future stage when this stage's gate fails.

**Required AI output for this stage:** implementation or artifact changes, automated tests/validators, evidence paths or reproducible seeds, a concise worker handoff, and the stage gate report. “Looks good” and “runs locally” are not acceptance evidence.


> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Use checkbox steps for progress.

**Tech Stack:** TypeScript schemas, Vitest, Markdown quality contracts

**Spec:** `docs/superpowers/specs/2026-10-17-soccershooter-design.md`  
**Master:** `docs/superpowers/plans/2026-10-17-soccershooter-master.md`

## Global Constraints

- No credit card, paid/timed trial, or adult-only account dependency.
- `FICTIONAL_PUBLIC` is the only deployable content mode.
- Simulation correctness outranks presentation shortcuts.
- Tests and measured gate evidence are required before the next stage.
- Do not implement later-stage scope unless a minimal interface is required to test this stage.

## Review Focus

- metrics that can be gamed
- telemetry fields that identify a person
- unlicensed asset provenance
- quality targets with no measurement method
- stage gates that can pass from opinion only

## Planned File Map

- `docs/QUALITY_BAR.md`
- `docs/REFERENCE_HARDWARE.md`
- `docs/PLAYTEST_SCORECARD.md`
- `docs/ASSET_PROVENANCE.md`
- `packages/telemetry/src/events.ts`
- `packages/telemetry/src/schema.test.ts`
- `tools/perf/README.md`
- `tools/balance/README.md`

---

**Goal:** Freeze what “premium,” “fun,” “fair,” “fast,” and “finished” mean before feature work can hide poor foundations.

**Architecture:** Documentation, schemas, benchmark formats, and measurement contracts only. No gameplay code beyond tiny validation schemas.

## Deliverables
- quality-bar document
- reference-hardware declaration
- performance measurement method
- physics golden-test format
- bot benchmark format
- playtest scorecard
- stage-gate process
- asset provenance registry
- privacy-preserving telemetry contract

## Files
- Create `docs/QUALITY_BAR.md`
- Create `docs/REFERENCE_HARDWARE.md`
- Create `docs/PLAYTEST_SCORECARD.md`
- Create `docs/ASSET_PROVENANCE.md`
- Create `packages/telemetry/src/events.ts`
- Create `packages/telemetry/src/schema.test.ts`
- Create `tools/perf/README.md`
- Create `tools/balance/README.md`
- Create `docs/gates/STAGE-01-GATE.md`

## Tasks
- [ ] Define reference desktop and low-spec fallback profiles using hardware already available; no purchase dependency.
- [ ] Define FPS, 1% low, simulation step, render step, long-task, memory, draw-call, and payload measurements.
- [ ] Define network profiles: local, 50/100/150 ms RTT, jitter, 2% loss, 5% loss.
- [ ] Define feel scorecard: movement, camera, first touch, passing, shooting, defense, bot usefulness, readability, rematch desire.
- [ ] Define telemetry event contracts without raw names, email, IP address, or sensitive identifiers.
- [ ] Define provenance fields: source, author, license, URL/path, modifications, original/third-party, shipping status.
- [ ] Define balance tournament outputs: win rate, possession, pass chains, turnovers, shots, technique usage, role distribution, exploit flags.
- [ ] Define exact gate-report structure and naming convention.
- [ ] Define “known defect” rule: a defect can be deferred only if it is outside the current stage gate and recorded explicitly.

## Tests
- telemetry event schema rejects unexpected identifying fields
- provenance entry cannot be marked shippable without license/source fields
- `REFERENCE_PRIVATE` assets cannot be marked public
- all stage IDs 01–20 have gate-file placeholders or generation rule

## Exit gate
Pass only when:
- `QUALITY_BAR.md` contains no unresolved placeholder markers
- every later stage has measurable acceptance criteria
- telemetry contract contains no PII fields
- provenance schema covers images, meshes, textures, audio, animation, fonts, and code
- the gate template is committed

Do not start movement before this passes.
