# Stage 04 Worker Handoff — Premium Football Physics

## Task

Execute `docs/superpowers/plans/stages/04-ball-physics.md` from the accepted Stage 03 `main` base. Research physically defensible football flight/contact behavior, implement a deterministic and learnable ball, build an interactive Ball Lab, verify the golden references and one-million-launch stress requirement, preserve all previous-stage behavior, stop before Stage 05, and do not merge without owner approval.

## Source files read

The worker read/re-read the required source-of-truth chain during the stage:
- `AGENTS.md`
- `DESIGN.md`
- `docs/design/DESIGN_PART_01.md`
- `docs/design/DESIGN_PART_02.md`
- `docs/design/DESIGN_PART_03.md`
- `docs/design/DESIGN_PART_04.md`
- `docs/ai/AI_EXECUTION_CONTRACT.md`
- `docs/superpowers/specs/2026-10-17-soccershooter-design.md`
- `docs/superpowers/plans/2026-10-17-soccershooter-master.md`
- `docs/superpowers/plans/stages/04-ball-physics.md`
- `docs/gates/STAGE-03-GATE.md`
- `docs/handoffs/STAGE-03-HANDOFF.md`
- `docs/constraints/FREE_TOOL_MATRIX.md`
- `docs/constraints/CONTENT_MODES.md`

The work also used the installed Superpowers workflows for brainstorming, plan execution, test-driven development, systematic debugging, verification-before-completion, and review preparation.

## Research / calibration basis

Research during implementation used Exa, Parallel Search, SciSpace, and alphaXiv to cross-check the game model against football/sports-ball literature.

The main applied results were:
- regulation soccer-ball scale around 0.22 m diameter and ~0.43–0.45 kg mass;
- quadratic aerodynamic force with a strong soccer-ball drag-crisis region;
- free-flight measurements with `Cd` around ~0.17 in the supercritical speed region;
- spin parameter `S = r * omega / v` as the meaningful control variable for Magnus lift;
- measured lift coefficient growth with spin parameter followed by saturation instead of unbounded lift;
- Magnus direction from `omega × velocity`;
- low-spin knuckle trajectories as bounded unsteady lateral-lift behavior in a limited speed/spin regime;
- numerical drag/Magnus integration and impulse/restitution/friction-based bounce as an appropriate inexpensive game model.

The resulting implementation intentionally avoids CFD and per-frame random wobble.

## Final Stage 04 implementation

### Authoritative ball state

`packages/physics/src/ball/BallState.ts` defines:
- position
- linear velocity
- angular velocity
- deterministic knuckle seed
- authoritative flight time
- grounded state
- last contact metadata

Regulation-scale baseline:
- mass `0.436 kg`
- radius `0.11 m`
- gravity `9.81 m/s²`
- thin-shell rotational inertia approximation

### Flight model

`packages/physics/src/ball/aerodynamics.ts` implements:
- coefficient-table quadratic drag
- smoothed drag-crisis calibration
- Magnus force from `omega × velocity`
- lift coefficient from spin parameter
- high-spin lift saturation
- exponential spin decay
- bounded seeded low-spin knuckle acceleration
- seed `0` as a deliberately stable wake
- no ambient `Math.random()` in authoritative physics

### Ground / rolling model

`packages/physics/src/ball/groundContact.ts` implements:
- vertical restitution
- turf tangential impulse
- translation/spin coupling from slip toward rolling
- rolling resistance
- rotational damping
- deterministic settling at low speed

### Trajectory / goal-frame model

`packages/physics/src/ball/trajectory.ts` implements:
- `120 Hz` authoritative ball substeps
- shared live/predictor `stepBall` integrator
- landing/apex predictor
- whole-ball goal-plane crossing
- rigid posts/crossbar
- swept frame collision checks for legal high-speed launches
- energy-safe frame rebounds
- fixed-step time conservation across fractional swept impacts

The final focused review found and repaired an important edge case where a swept post hit could previously shorten `flightSeconds` to the fractional impact time. The final solver resolves at impact and advances the reflected ball through the remainder of the same authoritative 120 Hz step.

### Golden references

The golden trajectory suite covers:
- driven 10 m reference
- straight 20 m reference
- curl 20 m reference
- power 25 m reference
- lofted reference
- chip reference
- seeded low-spin knuckle reference
- post rebound reference

It also asserts curve direction, spin saturation, top/back-spin differences, knuckle repeatability, stable ground behavior, predictor parity, high-speed frame safety, and energy bounds.

### Deterministic fuzz / stress

`tools/perf/ball-fuzz.ts` provides a seeded legal-launch generator and authoritative substep runner.

The repository now permanently runs the exact one-million-launch requirement in normal CI through:

```text
pnpm ball:fuzz
```

The final implementation run checked `4,000,000` authoritative ball states with zero failures.

### Ball Lab

`apps/web/src/dev/BallLab.ts` is integrated into the existing Stage 03 movement greybox rather than replacing it.

It provides:
- an independent regulation-scale football visual
- goal frame / net reference visual
- live trajectory trail
- expected landing / predicted trajectory
- speed control
- elevation control
- aim offset
- spin rate
- spin axis
- coefficient profile selector
- 1× / 0.5× / 0.25× slow motion
- deterministic knuckle seed
- trail/predictor toggle
- CSV trace export
- hidden deterministic state/projection telemetry for browser regression tests

Preset shortcuts:
- `1` Driven 10m
- `2` Straight 20m
- `3` Curl 20m
- `4` Power 25m
- `5` Loft
- `6` Chip
- `7` Knuckle
- `8` Post rebound

Ball Lab commands:
- `L` launch
- `0` ball reset
- `E` CSV export

Stage 03 movement/camera controls remain available simultaneously.

## Stage boundary

Stage 04 deliberately does **not** add final player-ball actions.

No Stage 05 implementation was introduced for:
- possession/control envelopes
- dribbling
- gameplay passing
- gameplay shooting
- tackling/interception
- aerial player-ball contacts

The Ball Lab `Launch` button is a physics instrument. It is not the final football gameplay kick action.

## Files introduced / materially changed

Primary Stage 04 files:
- `.github/workflows/ci.yml`
- `package.json`
- `pnpm-lock.yaml`
- `packages/physics/package.json`
- `packages/physics/src/index.ts`
- `packages/physics/src/ball/BallState.ts`
- `packages/physics/src/ball/BallState.test.ts`
- `packages/physics/src/ball/vector.ts`
- `packages/physics/src/ball/aerodynamics.ts`
- `packages/physics/src/ball/aerodynamics.test.ts`
- `packages/physics/src/ball/groundContact.ts`
- `packages/physics/src/ball/groundContact.test.ts`
- `packages/physics/src/ball/trajectory.ts`
- `packages/physics/src/ball/goldenTrajectories.test.ts`
- `packages/physics/src/ball/trajectorySafety.test.ts`
- `tools/perf/ball-fuzz.ts`
- `tools/perf/ball-fuzz.test.ts`
- `apps/web/package.json`
- `apps/web/src/dev/BallLab.ts`
- `apps/web/src/dev/BallLab.test.ts`
- `apps/web/src/main.ts`
- `apps/web/src/styles.css`
- `e2e/ball.spec.ts`
- `e2e/ball-lab.spec.ts`
- `docs/gates/STAGE-04-GATE.md`
- `docs/gates/STAGE-04-PLAYTEST.md`
- `docs/handoffs/STAGE-04-HANDOFF.md`

## TDD / debugging evidence

Initial RED head:
- `c38325bf5d22482d061dc3648817c6e46f9e5f22`
- Stage 04 contracts intentionally referenced missing physics modules
- CI failed at the expected missing-module boundary after install/guards succeeded

Important later RED/GREEN cycles:
- zero-spin drift exposed an accidentally active knuckle seed;
- stable flights were separated from explicitly seeded knuckle behavior;
- Chromium exposed accessibility/telemetry mismatches in the first Ball Lab integration;
- those were fixed at the product/UI contract instead of weakening E2E coverage;
- focused review identified swept-impact time loss;
- a regression test was added and observed failing before the collision solver was repaired.

## Final implementation verification

Implementation head before documentation:
- `843db449b76cf854c612bae88df7aaf6424f1acc`

Exact CI:
- run `39130399153`
- job `117684208919`

Results:
- frozen install / supply-chain policy: PASS
- authoritative randomness guard: PASS
- private reference-content guard: PASS
- strict TypeScript: PASS
- **97 / 97 unit/contract tests PASS**
- **16 / 16 test files PASS**
- one-million-launch deterministic fuzz: PASS
- fuzz failures: `0`
- fuzz checksum: `6a97d4e5`
- authoritative states checked: `4,000,000`
- max fuzz speed observed: `44.80623456998427 m/s`
- max fuzz spin observed: `233.76221878122678 rad/s`
- canonical Stage 02 10,000-tick determinism: PASS
- canonical hash: `d55b2d0b968372a5`
- FICTIONAL_PUBLIC server + web build: PASS
- server health endpoint: PASS
- **9 / 9 Chromium E2E tests PASS**

## Final bug sweep

The final focused review checked:
- unexpected lateral drift
- energy gain
- nondeterministic knuckle behavior
- high-speed post tunneling
- whole-ball goal geometry
- fixed-step time conservation through rebounds
- predictor/live integrator parity
- Stage 03 input regressions
- scope creep into Stage 05

The swept-impact time-conservation defect found during this review was repaired and now has a passing regression test.

No unresolved critical or important automated Stage 04 correctness defect is known after the final implementation run.

## Human gate status

Automated Stage 04 acceptance is green.

The plan also contains one inherently subjective criterion:

> Ball Lab alone must feel satisfying to use.

The owner has not yet performed the final Stage 04 Ball Lab playtest in this implementation session. No acceptance score is invented.

Follow `docs/gates/STAGE-04-PLAYTEST.md` to close this final human criterion.

Current gate wording: **AUTOMATED PASS — OWNER BALL LAB FEEL PENDING**.

## Known non-blocking note

The production browser bundle is approximately:
- `591.81 kB` minified
- `152.47 kB` gzip

Vite reports its standard >500 kB chunk warning. It is non-blocking for this stage, but later stages should introduce code splitting before the UI/content footprint grows substantially.

## Independent review limitation

No independent reviewer/subagent runtime is exposed in this chat environment. A focused self-review was performed against the Stage 04 plan, source-of-truth chain, research constraints, changed-file scope, tests, fuzz results, browser behavior, and deterministic invariants.

No independent reviewer result is claimed.

## Exact next action

1. verify the documentation-inclusive Stage 04 branch head is fully green;
2. open/update the Stage 04 draft PR without merging it;
3. owner runs `docs/gates/STAGE-04-PLAYTEST.md` locally;
4. if the owner finds a concrete feel/correctness issue, repair it on this branch and rerun the full gate;
5. if the owner accepts Ball Lab feel, update `docs/gates/STAGE-04-GATE.md` to final PASS;
6. merge only after explicit owner instruction;
7. begin Stage 05 only from the verified post-merge `main` base.
