# SoccerShooter — AI Execution Contract

**Purpose:** Make the entire build plan executable by AI agents without losing product intent, quality, or repository discipline.

## 1. Agent topology

Use one **Lead Integrator Agent** and specialized workers.

### Lead Integrator
Owns:
- current stage
- source-of-truth spec
- task decomposition
- worktree/branch assignment
- acceptance gates
- cross-agent conflict resolution
- final verification

The Lead does not delegate taste or acceptance responsibility.

### Specialist roles
Use as needed:
- Gameplay/Simulation Agent
- Ball Physics Agent
- Camera/Input Agent
- Tactical Bot Agent
- Balance/Exploit Agent
- Blender/Asset Agent
- Character/Rig Agent
- Animation Agent
- Environment/Lighting Agent
- UI/UX Agent
- Auth/Persistence Agent
- Multiplayer/Netcode Agent
- Replay/Highlight Agent
- Performance Agent
- QA/Red-Team Agent

## 2. Mandatory read order for every worker

1. `/AGENTS.md`
2. `/DESIGN.md`
3. `docs/superpowers/specs/2026-10-17-soccershooter-design.md`
4. `docs/superpowers/plans/2026-10-17-soccershooter-master.md`
5. current stage file
6. immediately previous gate report
7. any subsystem spec linked from the current stage
8. `docs/constraints/FREE_TOOL_MATRIX.md`

A worker must state the exact files it read in its handoff note.

## 3. Worker prompt template

Every worker receives:

```text
ROLE
STAGE
GOAL
WHY THIS STAGE EXISTS
FILES TO READ
FILES ALLOWED TO MODIFY
FILES FORBIDDEN TO MODIFY
INTERFACES THAT MUST NOT CHANGE
TESTS TO WRITE FIRST
MEASURABLE ACCEPTANCE CRITERIA
PERFORMANCE BUDGET
VISUAL/REFERENCE TARGETS IF ANY
TOOL ORDER
STOP CONDITIONS
REQUIRED HANDOFF
```

Never dispatch “make this better.”

## 4. Execution loop

For code:
1. inspect current state
2. write failing test
3. verify failure is meaningful
4. implement smallest correct change
5. run focused tests
6. run regression tests
7. benchmark if relevant
8. inspect diff
9. commit coherent unit
10. write evidence

For visual/Blender work:
1. inspect refs and current `.blend`
2. checkpoint/version up
3. create cheapest proof
4. capture viewport/render/wireframe evidence
5. run automated validation
6. compare with golden target
7. fix failed criteria
8. export runtime asset
9. validate in engine
10. performance test
11. commit metadata/source references

## 5. Parallelism rules

Parallel work is allowed only when:
- tasks have non-overlapping file ownership, or
- shared interfaces are already locked and tested

Do not run two agents against the same implementation file unless the Lead intends to compare independent proposals rather than merge both.

Good parallelism:
- UI concepts vs bot exploit tests
- character model vs arena greybox after shared scale contract exists
- several maps from one locked modular kit and schema

Bad parallelism:
- two agents changing the simulation state schema simultaneously
- animation agent changing contact semantics while physics agent changes the same event contract

## 6. Agent evidence requirement

No completion claim without evidence.

Code evidence:
- tests run
- exact command
- pass/fail count
- benchmark/result if required
- diff summary

Visual evidence:
- target reference IDs
- current contact sheet/render path
- measured geometry/material/performance results
- pass/fail rubric

Gameplay evidence:
- deterministic replay code or seed
- clip/screenshot path
- telemetry values
- subjective scorecard if a human playtest was part of gate

## 7. Handoff format

Every worker writes:

```markdown
# Worker Handoff

## Task
## Source files read
## Files changed
## Tests/evidence
## Decisions made
## Assumptions
## Known limitations
## Gate impact
## Exact next action
```

## 8. AI quality behavior

The agent must:
- prefer a smaller working proof over large speculative scope
- preserve determinism
- make failures reproducible
- turn discovered exploits into tests
- turn recurring visual criticism into a checklist/reference update
- keep public/private content boundaries intact
- use current specs instead of recollecting product intent from chat

The agent must not:
- add packages because they are fashionable
- replace a mature runtime subsystem without benchmark evidence
- add paid/trial/adult-only critical tools
- store secrets in Git
- hide technical debt in “temporary” production code without an issue
- expand content before the representative pipeline passes
- mark a gate passed from screenshots alone when the gate requires instrumentation

## 9. Human/AI division of labor

AI owns:
- research synthesis
- code
- tests
- automated play
- profiling
- first-pass modeling
- repeated visual comparison
- asset validation
- documentation
- branch/PR hygiene

Human owner decides:
- whether moment-to-moment play is genuinely fun
- whether the art has identity
- whether a major style pivot is wanted
- whether the difficulty feels fair
- whether the product promise is still right

When human feedback is “it feels wrong,” the Lead AI translates it into concrete hypotheses and tests rather than asking the human to debug implementation.

## 10. Stage gate behavior

If a gate fails:
- stop future-stage work
- identify failed metric
- open/update blocking issue
- fix at the earliest responsible layer
- rerun the gate

Do not lower the target silently to achieve a green status.
