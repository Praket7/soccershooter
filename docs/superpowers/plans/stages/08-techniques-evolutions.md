# Stage 08 — Technique System and Evolutions

## AI execution mode

**Primary AI role:** Gameplay/Technique + Balance Agent

This stage is executed by AI under `docs/ai/AI_EXECUTION_CONTRACT.md`. Before any change, the worker must read `/DESIGN.md`, the master plan, this stage, the previous gate, and every subsystem document linked below. The AI must produce the cheapest measurable proof first, write tests before implementation where applicable, capture evidence, and stop rather than beginning a future stage when this stage's gate fails.

**Required AI output for this stage:** implementation or artifact changes, automated tests/validators, evidence paths or reproducible seeds, a concise worker handoff, and the stage gate report. “Looks good” and “runs locally” are not acceptance evidence.


> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Use checkbox steps for progress.

**Tech Stack:** TypeScript declarative content, shared simulation, Vitest

**Spec:** `docs/superpowers/specs/2026-10-17-soccershooter-design.md`  
**Master:** `docs/superpowers/plans/2026-10-17-soccershooter-master.md`

## Global Constraints

- No credit card, paid/timed trial, or adult-only account dependency.
- `FICTIONAL_PUBLIC` is the only deployable content mode.
- Simulation correctness outranks presentation shortcuts.
- Tests and measured gate evidence are required before the next stage.
- Do not implement later-stage scope unless a minimal interface is required to test this stage.

## Review Focus

- uncounterable moves
- animation overriding physics
- cooldown bypass
- dominant technique meta
- evolutions that are only number inflation

## Planned File Map

- `packages/content/src/techniques/schema.ts`
- `packages/content/src/techniques/catalog.ts`
- `packages/sim/src/techniques/executeTechnique.ts`
- `packages/sim/src/techniques/techniques.test.ts`
- `tools/balance/techniqueTournament.ts`
- `apps/web/src/debug/TechniqueDebugHud.ts`

---

**Goal:** Add spectacular football moves as contextual mastery tools, not uncounterable canned animations.

**Architecture:** Techniques are declarative definitions: eligibility, input, cost, timing, movement constraint, contact profile, failure/recovery, counters, animation key, and VFX/audio hooks.

## Technique data
Each technique defines:
- ID/tags
- input chord
- eligibility predicate
- stamina/cooldown
- anticipation/windup
- contact window
- locomotion constraint
- ball impulse builder
- failure state
- counter window
- unlock/evolution
- animation/VFX/audio IDs

## Initial set
Dribble:
- stepover
- double stepover
- roulette
- elastico
- rainbow
- body feint

Pass/shot:
- finesse curl
- power strike
- knuckle
- trivela
- rabona
- lofted through ball

Aerial:
- volley
- scissor
- bicycle
- diving header

## Evolution examples
- Stepover → Double Stepover → Phantom Step
- Finesse → Whipped Curl → Impossible Angle
- Driven Shot → Power Strike → Thunder Strike
- Volley → Scissor → Acrobat
- Through Ball → Threaded → Split-Line

Use original game labels rather than real-player trademark names.

## Balance rules
Every high-power technique requires:
- contextual eligibility
- execution risk
- stamina/cooldown cost
- visible/readable counterplay
- no guaranteed result

## Implementation Task Sequence

- [x] **Task 1:** Write failing eligibility/cooldown/interruption tests for the first four techniques.
- [x] **Task 2:** Implement technique schema and deterministic execution interface.
- [x] **Task 3:** Implement the first dribble, pass/shot, and aerial technique set using existing physics primitives.
- [x] **Task 4:** Implement technique costs, failure states, counter windows, and recovery.
- [x] **Task 5:** Implement four evolution chains that alter mechanics rather than only numbers.
- [x] **Task 6:** Add technique debug HUD showing eligibility, timing window, and failure reason.
- [x] **Task 7:** Run exploit/balance tournaments and flag dominant technique contribution.
- [x] **Task 8:** Tune and rerun until the stage balance gate passes.

## Tests
- technique cannot trigger outside eligibility
- cooldown/stamina authoritative
- output impulse within physics envelope
- interruption enters correct recovery
- evolution preserves counterplay
- input replay deterministic
- balance tournament tracks technique impact

## Exit gate
- >=12 techniques implemented
- >=4 evolution chains
- no single move becomes uncountersable meta in bot tournaments
- testers can explain when at least two different techniques are appropriate
- spectacular actions feel earned
