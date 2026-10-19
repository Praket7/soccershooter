# Stage 06 — Tactical Bot Foundation

## AI execution mode

**Primary AI role:** Tactical Bot Agent

This stage is executed by AI under `docs/ai/AI_EXECUTION_CONTRACT.md`. Before any change, the worker must read `/DESIGN.md`, the master plan, this stage, the previous gate, and every subsystem document linked below. The AI must produce the cheapest measurable proof first, write tests before implementation where applicable, capture evidence, and stop rather than beginning a future stage when this stage's gate fails.

**Required AI output for this stage:** implementation or artifact changes, automated tests/validators, evidence paths or reproducible seeds, a concise worker handoff, and the stage gate report. “Looks good” and “runs locally” are not acceptance evidence.


> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Use checkbox steps for progress.

**Tech Stack:** TypeScript utility AI, deterministic prediction, Vitest/headless tournaments

**Spec:** `docs/superpowers/specs/2026-10-17-soccershooter-design.md`  
**Master:** `docs/superpowers/plans/2026-10-17-soccershooter-master.md`

## Global Constraints

- No credit card, paid/timed trial, or adult-only account dependency.
- `FICTIONAL_PUBLIC` is the only deployable content mode.
- Simulation correctness outranks presentation shortcuts.
- Tests and measured gate evidence are required before the next stage.
- Do not implement later-stage scope unless a minimal interface is required to test this stage.

## Review Focus

- all bots chasing ball
- blocked-lane passes
- idle/stuck bots
- goalkeeper abandonment
- utility oscillation between roles

## Planned File Map

- `packages/bots/src/perception.ts`
- `packages/bots/src/blackboard.ts`
- `packages/bots/src/roles.ts`
- `packages/bots/src/utility.ts`
- `packages/bots/src/intercepts.ts`
- `packages/bots/src/passing.ts`
- `packages/bots/src/goalkeeper.ts`
- `packages/bots/src/scenarios.test.ts`
- `tools/balance/tournament.ts`

---

**Goal:** Create teammates/opponents that understand football space and transitions rather than chase the ball.

**Architecture:** Deterministic hierarchical AI: perception → tactical blackboard → dynamic role assignment → utility action → predictive tools → steering.

## Bot world model
Each bot derives:
- self state
- ball state and predicted path
- teammate/opponent state
- goals/field geometry
- possession probability
- pressure
- passing lanes
- shot quality
- restart/match state

## Dynamic roles
At each tactical cycle assign:
- ball carrier
- immediate support
- width/depth support
- presser
- cover defender
- recovery runner
- goalkeeper

Prefer team-level utility assignment over hardcoded permanent striker/defender logic.

## Carrier utilities
- shoot
- pass
- dribble
- protect
- clear

## Off-ball utilities
- support
- overlap
- width
- half-space
- back-post run
- recycle

## Defense utilities
- press
- cover
- block lane
- block shot
- intercept
- recover goal-side

## Predictive tools
- ball intercept time
- pass-lane occlusion
- receiver lead
- shot-quality estimate
- support-angle score
- simple expected-threat field

## Goalkeeper
- home position
- angle narrowing
- claim/intercept
- dive
- parry
- distribution

## Implementation Task Sequence

The checkboxes below track implementation tasks; owner playtest and subjective acceptance remain recorded separately in the stage gate.


- [x] **Task 1:** Write failing scenario tests for support spacing, turnover recovery, blocked passing lanes, goalkeeper home position, and anti-clustering.
- [x] **Task 2:** Implement perception features and a tactical blackboard from deterministic simulation state.
- [x] **Task 3:** Implement team-level dynamic role assignment and stabilize role switching with hysteresis/cooldowns.
- [x] **Task 4:** Implement pass-lane, intercept-time, shot-quality, and support-angle predictors.
- [x] **Task 5:** Implement carrier, off-ball, and defensive utility evaluators.
- [x] **Task 6:** Implement goalkeeper positioning, claim, dive, parry, and distribution logic.
- [x] **Task 7:** Run headless 3v3 bot matches and export role/pass/cluster statistics.
- [x] **Task 8:** Tune only from recorded metrics and scenario failures, then rerun the full bot regression suite.
## Tests
- support bot leaves carrier lane
- defender recovers goal-side after turnover
- trapped carrier passes to open teammate
- bot avoids obviously blocked lane unless risk profile allows it
- keeper position follows ball angle
- bots can complete a scripted 3-pass attack
- team does not permanently cluster
- no role assignment produces impossible duplicate goalkeeper state

## Headless benchmark
Run thousands of possessions and record role occupancy, pass chains, turnovers, support distance, shots, goals, idle time, and clustering.

## Exit gate
- humans can identify sensible support/recovery without debug overlays
- bots complete academy basics
- bot-only 3v3 matches finish reliably
- passing is common and useful
- no permanent ball swarm
