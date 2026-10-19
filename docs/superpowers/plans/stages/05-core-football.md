# Stage 05 — First Touch, Dribbling, Passing, Shooting, Tackling, and Aerial Core

## AI execution mode

**Primary AI role:** Gameplay/Simulation Agent

This stage is executed by AI under `docs/ai/AI_EXECUTION_CONTRACT.md`. Before any change, the worker must read `/DESIGN.md`, the master plan, this stage, the previous gate, and every subsystem document linked below. The AI must produce the cheapest measurable proof first, write tests before implementation where applicable, capture evidence, and stop rather than beginning a future stage when this stage's gate fails.

**Required AI output for this stage:** implementation or artifact changes, automated tests/validators, evidence paths or reproducible seeds, a concise worker handoff, and the stage gate report. “Looks good” and “runs locally” are not acceptance evidence.


> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Use checkbox steps for progress.

**Tech Stack:** TypeScript shared simulation, Rapier contacts, Vitest

**Spec:** `docs/superpowers/specs/2026-10-17-soccershooter-design.md`  
**Master:** `docs/superpowers/plans/2026-10-17-soccershooter-master.md`

## Global Constraints

- No credit card, paid/timed trial, or adult-only account dependency.
- `FICTIONAL_PUBLIC` is the only deployable content mode.
- Simulation correctness outranks presentation shortcuts.
- Tests and measured gate evidence are required before the next stage.
- Do not implement later-stage scope unless a minimal interface is required to test this stage.

## Review Focus

- magnetic possession
- shot/tackle spam
- assist making impossible actions
- first-touch teleporting
- defense with no recovery cost

## Planned File Map

- `packages/sim/src/football/controlEnvelope.ts`
- `packages/sim/src/football/passing.ts`
- `packages/sim/src/football/shooting.ts`
- `packages/sim/src/football/defending.ts`
- `packages/sim/src/football/aerial.ts`
- `packages/sim/src/football/football.test.ts`
- `apps/web/src/debug/ActionDebugHud.ts`
- `tools/balance/exploitBots.ts`

---

**Goal:** Turn movement + ball into a complete greybox football loop with a high skill ceiling and no magnetic possession lock.

**Architecture:** Contextual actions create legal target impulses. The ball remains physically independent. Animation hooks are data events only at this stage.

## Possession/control envelope

Use:
- front-of-body control region
- target touch point
- maximum correction impulse
- pressure sensitivity
- bad-angle penalty
- sprint touch distance
- break conditions from tackle/opponent impulse/high ball speed

Never teleport or rigidly attach the ball.

## Passing
Types:
- ground
- driven
- lofted
- through/lead

Target solving considers aim, teammate, open-space lead, pressure, and user assist. Assist cannot authorize impossible behind-the-back actions without an eligible technique.

## Shooting
User controls:
- aim
- charge/power
- contact style
- optional spin input
- body balance/context

Families:
- normal
- driven
- finesse
- chip
- knuckle
- outside foot

## Defense
- contain/shape
- standing challenge
- committed tackle
- interception
- recovery penalty for mistimed commitment

## Aerial
- jump/contest
- header
- volley eligibility
- hooks for later bicycle/scissor

## Tasks

The checkboxes below track implementation tasks; owner playtest and subjective acceptance remain recorded separately in the stage gate.

- [x] Implement dribble control envelope.
- [x] Implement pass target solver.
- [x] Implement shot impulse/spin builder.
- [x] Implement tackling and recovery.
- [x] Implement interception windows.
- [x] Implement aerial contact eligibility.
- [x] Add greybox keeper and practice goals.
- [x] Add debug HUD explaining action success/failure.
- [x] Add exploit bots: sprint-only, shot-spam, tackle-spam, dribble-circle.
## Tests
- no action teleports ball
- kick impulse cannot exceed legal envelope
- contact output changes with body/foot/aim context
- pass lead predicts receiver motion
- tackle spam loses expected value because of commitment
- possession breaks under sufficient opponent impulse
- sprint dribble produces longer/harder touches than controlled dribble
- all action traces remain deterministic

## Exit gate — Fun
- 10-minute solo dribble/shoot loop remains engaging
- testers can intentionally produce straight, curve, and chip
- first touch shows skill variance
- defending has readable timing
- simple spam strategies do not dominate varied play
- combined movement + ball satisfaction median >= 8/10
