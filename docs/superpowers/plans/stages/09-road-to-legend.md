# Stage 09 — Road to Legend Progression

## AI execution mode

**Primary AI role:** Progression + Gameplay Agent

This stage is executed by AI under `docs/ai/AI_EXECUTION_CONTRACT.md`. Before any change, the worker must read `/DESIGN.md`, the master plan, this stage, the previous gate, and every subsystem document linked below. The AI must produce the cheapest measurable proof first, write tests before implementation where applicable, capture evidence, and stop rather than beginning a future stage when this stage's gate fails.

**Required AI output for this stage:** implementation or artifact changes, automated tests/validators, evidence paths or reproducible seeds, a concise worker handoff, and the stage gate report. “Looks good” and “runs locally” are not acceptance evidence.

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Use checkbox steps for progress.

**Tech Stack:** TypeScript, IndexedDB/local persistence adapter, Vitest

**Spec:** `docs/superpowers/specs/2026-10-17-soccershooter-design.md`  
**Master:** `docs/superpowers/plans/2026-10-17-soccershooter-master.md`

## Global Constraints

- No credit card, paid/timed trial, or adult-only account dependency.
- `FICTIONAL_PUBLIC` is the only deployable content mode.
- Simulation correctness outranks presentation shortcuts.
- Tests and measured gate evidence are required before the next stage.
- Do not implement later-stage scope unless a minimal interface is required to test this stage.

## Review Focus

- loss farming
- save migration loss
- OVR overpowering skill
- campaign difficulty spikes
- postgame dead end

## Planned File Map

- `packages/progression/src/profile.ts`
- `packages/progression/src/campaign.ts`
- `packages/progression/src/rewards.ts`
- `packages/progression/src/legacy.ts`
- `packages/progression/src/save.ts`
- `packages/progression/src/migrations.ts`
- `packages/progression/src/progression.test.ts`
- `apps/web/src/screens/RoadToLegend.ts`

---

**Goal:** Build a complete zero-concurrency solo loop that is beatable, replayable, and continues after campaign completion.

**Architecture:** Data-driven encounter graph, versioned local persistence, technique mastery, deterministic challenge seeds, and postgame Legacy progression.

## Starting state
- around 67 OVR presentation
- limited technique slots
- basic mechanics unlocked
- bounded assist/control forgiveness
- archetype selection without permanent lock-in

## Campaign acts
1. Street Beginner
2. Academy
3. Regional
4. Continental
5. Elite Clubs
6. World Legends
7. Legacy

Each act introduces tactical problems, not just numeric inflation:
- high press
- deep block
- counterattack
- aerial team
- elite keeper
- possession overload
- aggressive man pressure

## Match/run rewards
- XP
- technique-family mastery
- temporary run upgrade choice
- challenge medals
- replay/highlight

Loss gives modest learning/progression but cannot become the optimal farming strategy.

## Legacy
After campaign victory:
- endless mastery levels
- seeded gauntlets
- escalating modifiers
- personal bests
- perfect-clear objectives
- prestige cosmetics

## Persistence
- IndexedDB/local abstraction
- versioned schema
- migration tests
- save export/import JSON
- no mandatory account

## Implementation Task Sequence

- [x] **Task 1:** Write failing tests for fresh profile, reward calculation, save migration, campaign completion, and Legacy continuation.
- [x] **Task 2:** Implement versioned local player profile and save adapter.
- [x] **Task 3:** Implement campaign acts and data-driven encounter definitions.
- [x] **Task 4:** Implement XP, mastery, temporary run choices, medals, and anti-farming reward rules.
- [x] **Task 5:** Implement technique unlock/evolution integration with progression.
- [x] **Task 6:** Implement campaign final and postgame Legacy progression.
- [x] **Task 7:** Implement save export/import and migration fixtures.
- [x] **Task 8:** Complete the machine-verifiable campaign proof. The headless physical campaign now runs all authored encounters against act-specific opponent archetypes, all three player archetypes complete the same campaign with deterministic but distinct physical playstyle signatures, and live campaign challenges apply authored pressure, pitch-space, recovery, and keeper-height conditions without changing the authoritative movement/contact/ball laws. Browser coverage verifies authored tactics reach the live challenge and remain visually distinct from true Legacy modifiers.

## Tests
- fresh save starts correctly
- migrations preserve unlocks
- full campaign is beatable by benchmark skilled bot/player agent
- XP/mastery cannot overflow/NaN
- deliberate loss farming is suboptimal
- no infinite reward loop
- Legacy continues after final campaign win
- technical, pace, and power builds complete the same physical campaign with distinct deterministic contact/possession signatures
- authored tactical problems alter live campaign challenge conditions through bounded existing simulation hooks

## Exit gate
- [x] headless system can simulate start-to-final campaign
- [ ] a new tester completes Act 1 without developer explanation — **human validation deferred by owner; no result is claimed**
- [x] >=3 machine-verified viable build/playstyle paths
- [x] progression choices materially change simulated and live-practice play
- [x] postgame has no fake impossible cap

The Stage 09 engineering foundation is complete when the branch-wide verification suite is green. Human onboarding/usability acceptance remains a separate deferred gate and must not be inferred from automated evidence.
