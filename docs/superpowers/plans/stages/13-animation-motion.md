# Stage 13 — Animation, Motion Capture, and Contact Synchronization

## AI execution mode

**Primary AI role:** Animation + Contact-Sync Agent

This stage is executed by AI under `docs/ai/AI_EXECUTION_CONTRACT.md`. Before any change, the worker must read `/DESIGN.md`, the master plan, this stage, the previous gate, and every subsystem document linked below. The AI must produce the cheapest measurable proof first, write tests before implementation where applicable, capture evidence, and stop rather than beginning a future stage when this stage's gate fails.

**Required AI output for this stage:** implementation or artifact changes, automated tests/validators, evidence paths or reproducible seeds, a concise worker handoff, and the stage gate report. “Looks good” and “runs locally” are not acceptance evidence.


> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Use checkbox steps for progress.

**Tech Stack:** Blender, FreeMoCap/Pose2Sim/Posetrak optional, Three.js animation system, Vitest

**Spec:** `docs/superpowers/specs/2026-10-17-soccershooter-design.md`  
**Master:** `docs/superpowers/plans/2026-10-17-soccershooter-master.md`

## Global Constraints

- No credit card, paid/timed trial, or adult-only account dependency.
- `FICTIONAL_PUBLIC` is the only deployable content mode.
- Simulation correctness outranks presentation shortcuts.
- Tests and measured gate evidence are required before the next stage.
- Do not implement later-stage scope unless a minimal interface is required to test this stage.

## Review Focus

- foot skating
- contact-frame mismatch
- rollback double events
- bad retargeting
- animation latency hiding input

## Planned File Map

- `art/animation/source/football-actions.blend`
- `art/animation/captures/README.md`
- `packages/content/src/animation/manifest.ts`
- `apps/web/src/animation/AnimationGraph.ts`
- `apps/web/src/animation/ContactEvents.ts`
- `apps/web/src/animation/FootIK.ts`
- `apps/web/src/animation/animation.test.ts`
- `tools/blender/retarget_animation.py`

---

**Goal:** Make the athletes feel expensive through excellent motion, contact timing, and blending rather than polygon count.

**Architecture:** Simulation controls physical motion. In-place clips, blending, additive layers, IK/foot locking, and explicit contact events make animation follow authoritative ball/player state.

## Animation inventory target
Approximate first target: 70–90 polished clips.

Locomotion (~16):
- idle variants
- jog/run/sprint
- 8-way coverage
- starts/stops
- planted turns

Ball/control (~14):
- controlled touches
- sprint touches
- inside/outside receive
- trap
- chest/air receive

Pass/shot (~18):
- short/long
- driven
- lofted
- finesse
- power
- chip
- outside foot
- knuckle
- useful weak-foot variants

Defense/keeper (~16):
- contain
- poke
- slides
- blocks
- keeper set
- dives
- claims/parries
- distribution

Skills/aerial/celebrations (~20+ as needed).

## Capture options
Free/local:
- FreeMoCap
- Pose2Sim
- Posetrak
- phone footage as keyframe reference

Every capture is raw material. Cleanup is mandatory.

## Cleanup pipeline
- remove tracking jitter
- correct foot skating
- repair center of mass
- retarget to shared skeleton
- simplify noisy curves
- adjust anticipation/follow-through
- set contact markers
- verify root/pelvis behavior

## Contact-event contract
Every ball-impact animation defines:
- contact start
- exact contact event time/frame
- contact foot/body surface
- release/follow-through markers when useful

Simulation validates that geometry/context permits the hit. Animation cannot invent a successful contact.

## Locomotion blending
- speed blend
- directional blend
- turn-in-place
- stride/foot correction
- pelvis stabilization
- foot IK
- upper-body aim additive

## Skill animation rule
Signature actions require:
- anticipation
- readable commitment
- contact
- follow-through
- failure/recovery
- defensive counter window

## Implementation Task Sequence

- [ ] **Task 1:** Write failing tests for animation contact-event deduplication, rollback, and interruption recovery.
- [ ] **Task 2:** Create locomotion, control, pass/shot, defense, keeper, skill, aerial, and celebration manifest.
- [ ] **Task 3:** Capture or keyframe the first representative clips using free/local tooling.
- [ ] **Task 4:** Clean jitter, foot sliding, center-of-mass errors, and retargeting artifacts in Blender.
- [ ] **Task 5:** Implement animation graph with speed/direction blending, turns, additive upper-body layer, and foot IK.
- [ ] **Task 6:** Implement explicit contact markers validated against authoritative geometry.
- [ ] **Task 7:** Integrate first-touch, shooting, tackling, and skill animations without allowing root motion to own authority.
- [ ] **Task 8:** Run slow-motion contact review and foot-skate measurements across a full 3v3 match.

## Tests
- benchmark clips stay under foot-skate tolerance
- contact marker lands within allowed foot-ball distance
- render FPS does not alter authoritative contact
- LOD skeleton stays aligned
- rollback/replay cannot double-fire animation contact events
- interrupted technique transitions to legal recovery state

## V2 responsiveness/contact rule

Animation is subordinate to valid player intent and authoritative contact. Use `/DESIGN.md` skill-state and contact-marker rules. The AI must instrument animation onset, plant-foot behavior, contact-frame error, cancellation windows, and foot sliding. Research on responsiveness vs. naturalness is a blocking design principle: a prettier animation that makes control slower fails.

## Exit gate
- full animated 3v3 match is coherent
- shooting contact reads correctly in slow motion
- first touch looks driven by the physical ball rather than a teleport
- no common locomotion state has obvious foot sliding
- tester animation/contact rating median >= 8/10
