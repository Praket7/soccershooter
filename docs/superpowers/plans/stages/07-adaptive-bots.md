# Stage 07 — Adaptive Bot Intelligence, Personalities, and Learning Lab

## AI execution mode

**Primary AI role:** Adaptive Bot + Balance Agent

This stage is executed by AI under `docs/ai/AI_EXECUTION_CONTRACT.md`. Before any change, the worker must read `/DESIGN.md`, the master plan, this stage, the previous gate, and every subsystem document linked below. The AI must produce the cheapest measurable proof first, write tests before implementation where applicable, capture evidence, and stop rather than beginning a future stage when this stage's gate fails.

**Required AI output for this stage:** implementation or artifact changes, automated tests/validators, evidence paths or reproducible seeds, a concise worker handoff, and the stage gate report. “Looks good” and “runs locally” are not acceptance evidence.


> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Use checkbox steps for progress.

**Tech Stack:** TypeScript bot system; optional local Python/RL tooling only in isolated research lane

**Spec:** `docs/superpowers/specs/2026-10-17-soccershooter-design.md`  
**Master:** `docs/superpowers/plans/2026-10-17-soccershooter-master.md`

## Global Constraints

- No credit card, paid/timed trial, or adult-only account dependency.
- `FICTIONAL_PUBLIC` is the only deployable content mode.
- Simulation correctness outranks presentation shortcuts.
- Tests and measured gate evidence are required before the next stage.
- Do not implement later-stage scope unless a minimal interface is required to test this stage.

## Review Focus

- hidden physical cheating
- rubber-banding mid-possession
- overfitting to one human style
- reward hacking
- learned policy becoming a hard dependency

## Planned File Map

- `packages/bots/src/playerModel.ts`
- `packages/bots/src/difficulty.ts`
- `packages/bots/src/personalities.ts`
- `packages/bots/src/adaptiveDirector.ts`
- `packages/bots/src/difficulty.test.ts`
- `tools/balance/learning-lab/README.md`
- `tools/balance/learning-lab/evaluate.ts`

---

**Goal:** Make bots scale from beginner-friendly to elite while staying fair, readable, and useful as teammates.

**Architecture:** Production bot stays deterministic/hybrid. A rolling player model modifies cognition parameters. Optional learned policies live in a separate local research lane.

## Player model
Track rolling gameplay estimates only:
- pass accuracy
- shot conversion
- pressured turnovers
- dribble success
- defensive timing
- reaction proxy
- favored zones
- technique diversity

No biometric data and no identity-sensitive profile.

## Allowed difficulty controls
- reaction delay
- observation noise
- tactical evaluation interval
- prediction horizon
- aim/spin error
- pass-risk tolerance
- skill repertoire
- coordinated run frequency
- defensive anticipation

## Forbidden difficulty controls
- hidden speed bonus
- stamina cheating
- larger tackle collider
- altered ball physics
- pre-reading human input before it becomes simulation-visible

## Personality profiles
Data-driven utility weights:
- playmaker
- winger
- poacher
- anchor
- aggressive presser
- calm keeper
- balanced

## PvE adaptation
Adjust only at safe boundaries such as encounter start/restart. Do not rubber-band live within a possession to force outcomes.

## Learning lab
Optional local experiments:
- simplified headless football environment
- production bots as baseline
- self-play/PPO/MARL if local hardware allows
- learned model may propose high-level role/action only

Promotion metrics:
- cooperation
- corner-case safety
- exploit rate
- inference time
- predictability/readability
- win rate
- human fun preference

## Implementation Task Sequence

- [ ] **Task 1:** Write failing tests proving novice and elite bots use identical physical movement, stamina, collider, and ball parameters.
- [ ] **Task 2:** Implement rolling gameplay-only player model with confidence/decay.
- [ ] **Task 3:** Implement inspectable difficulty parameter profiles for reaction, perception, precision, tactical depth, and repertoire.
- [ ] **Task 4:** Implement data-driven bot personalities as utility-weight profiles.
- [ ] **Task 5:** Implement PvE adaptation only at legal boundaries such as encounter start or restart.
- [ ] **Task 6:** Create isolated local learning-lab interface that can replace only high-level role/action choice.
- [ ] **Task 7:** Benchmark learned experiments against deterministic bots on cooperation, exploits, latency, corner cases, win rate, and tester preference.
- [ ] **Task 8:** Keep learned policies disabled by default unless the promotion gate is explicitly passed.

## Tests
- novice/elite bots have identical physical stats
- every difficulty difference is inspectable in a parameter snapshot
- adaptive changes occur only at legal boundaries
- same seed reproduces decisions
- learned lane is fully disableable
- no reward-farming loop from pass spam or non-winning behavior

## Exit gate
- novice is beatable without appearing broken
- standard is a useful teammate
- elite forces tactical adaptation
- all levels use identical physical laws
- teammate usefulness median >= 7.5/10
