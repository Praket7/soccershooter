# Stage 04 Gate — Premium Football Physics

## Decision

**AUTOMATED PASS — OWNER BALL LAB FEEL PENDING**

Stage 04 implementation satisfies its measurable automated acceptance criteria on exact implementation head `843db449b76cf854c612bae88df7aaf6424f1acc`.

The one remaining exit criterion is intentionally human and subjective:

> Ball Lab alone must feel satisfying to use.

No owner result is fabricated. Use `docs/gates/STAGE-04-PLAYTEST.md` to close that final criterion after local testing. Until then, do not treat this document as authorization to begin Stage 05 merely because CI is green.

## Implementation scope

Completed:
- [x] deterministic regulation-scale `BallState`
- [x] 120 Hz fixed football substeps independent of rendering
- [x] coefficient-table quadratic drag around the soccer-ball drag crisis
- [x] Magnus lift from `omega × velocity`
- [x] lift coefficient driven by spin parameter with configured saturation
- [x] deterministic spin decay
- [x] bounded, continuous, seed-repeatable low-spin knuckle perturbation
- [x] stable bounce restitution
- [x] turf friction and slide-to-roll coupling
- [x] rolling resistance and settling
- [x] post/crossbar rigid collision benchmark
- [x] swept high-speed goal-frame collision protection
- [x] whole-ball goal-plane crossing utility
- [x] trajectory predictor using the same authoritative integrator
- [x] required golden reference launch families
- [x] deterministic random stress/fuzz launcher
- [x] one-million-launch finite-state fuzz in normal CI
- [x] integrated interactive Ball Lab
- [x] launch speed, elevation, aim, spin axis/rate, coefficient profile, slow motion, trajectory/predictor, knuckle seed, and CSV export controls
- [x] Stage 01–03 regressions preserved
- [x] canonical Stage 02 deterministic hash preserved

Explicitly not implemented in Stage 04:
- player-ball possession or magnetic control
- dribbling
- gameplay pass input/targeting
- gameplay shooting input/contact styles
- tackling/interceptions against the ball
- aerial player-ball contacts

Those are Stage 05 scope.

## Golden reference suite

Automated golden coverage passes for:
- [x] 10 m driven reference
- [x] 20 m straight reference
- [x] 20 m curling reference
- [x] 25 m power reference
- [x] lofted reference
- [x] chip reference
- [x] low-spin seeded knuckle reference
- [x] post rebound reference

Behavioral assertions pass for:
- [x] zero-spin flight stays near its vertical plane
- [x] sidespin curves in the `omega × velocity` direction
- [x] topspin drops sooner than the zero-spin equivalent
- [x] backspin carries/floats longer than the zero-spin equivalent
- [x] stronger legal sidespin increases deviation until the configured lift saturation region
- [x] same-seed knuckle flight repeats exactly and remains bounded
- [x] bounce/roll remain stable
- [x] post/crossbar impact cannot create an energy explosion
- [x] high-speed legal launch cannot tunnel through a post in one 120 Hz substep
- [x] swept frame impact consumes exactly one authoritative fixed step
- [x] predictor uses the authoritative `stepBall` equations rather than a separate approximation

## Exact automated evidence

Implementation head before gate documentation:
- commit: `843db449b76cf854c612bae88df7aaf6424f1acc`
- CI run: `39130399153`
- job: `117684208919`

Environment:
- Node `v24.21.0`
- pnpm `12.9.1`
- frozen workspace install: PASS
- supply-chain policy verification: PASS
- authoritative-randomness guard: PASS
- private-reference-content guard: PASS
- strict TypeScript: PASS

Unit / contract suite:
- **97 / 97 tests PASS**
- **16 / 16 test files PASS**

Million-launch deterministic ball fuzz:

```text
launches: 1000000
failures: 0
checksum: 6a97d4e5
maxSpeedObserved: 44.80623456998427
maxSpinObserved: 233.76221878122678
statesChecked: 4000000
```

Canonical deterministic simulation regression:

```text
runner: node-headless
simVersion: 1
tickHz: 30
ticks: 10000
seed: 1511506142
hash: d55b2d0b968372a5
```

Production verification:
- FICTIONAL_PUBLIC server build: PASS
- FICTIONAL_PUBLIC browser build: PASS
- server `/health`: PASS
- Chromium E2E / browser parity: **9 / 9 PASS**

## TDD and debugging evidence

The stage was developed with explicit RED → GREEN cycles rather than test-after coding.

Notable evidence:
- initial RED head `c38325bf5d22482d061dc3648817c6e46f9e5f22` failed because the Stage 04 API did not exist yet;
- early physics calibration exposed unintended zero-spin lateral drift caused by accidentally enabling the knuckle seed for stable references;
- stable flights were separated from explicitly seeded knuckle flights rather than relaxing the straight-shot test;
- browser E2E exposed missing accessibility/telemetry contracts, which were added to the Ball Lab rather than weakening browser coverage;
- final focused review found a swept-post collision could shorten authoritative flight time;
- a regression test was added first and failed;
- the collision solver was then repaired so impact plus post-impact remainder consumes exactly one 120 Hz step.

## Research / calibration basis

The implementation was calibrated against published soccer-ball and sports-ball physics rather than arbitrary force constants. Research used during the stage included:
- Goff & Carré, soccer-ball trajectory/aerodynamic measurements, including the drag crisis and free-flight lift coefficients;
- Asai and collaborators on spinning soccer-ball trajectories and Magnus force;
- Darbois Texier et al. on low-spin knuckleball/unsteady-lift behavior;
- Mencke et al. on flight and bounce of spinning sports balls;
- modern analytical work on quadratic drag plus vertical-axis Magnus motion for deterministic invariants and debugging intuition.

Applied conclusions:
- drag remains quadratic but its coefficient varies through the soccer-ball drag crisis;
- Magnus direction is `omega × velocity`;
- lift magnitude depends on spin parameter `r * omega / v` and saturates instead of increasing without bound;
- knuckle motion is a bounded low-spin unsteady-lift effect and therefore uses deterministic continuous seeded variation rather than frame-level randomness;
- the trajectory predictor and live ball must share one integrator.

## Architecture note

Stage 04 keeps football-specific forces and contacts as pure, headless deterministic TypeScript in `packages/physics`. This makes the same equations usable by prediction, tests, fuzzing, browser presentation, and future authoritative simulation.

The wider project architecture still reserves Rapier for general rigid-body / broad collision infrastructure. This stage does not pretend Rapier owns the football-specific aerodynamic/contact model, nor does it introduce a WASM-only dependency into the golden/predictor path merely to satisfy a technology label.

## Final review status

A focused diff and invariant review found and fixed the swept-frame time-conservation bug described above. No unresolved critical or important Stage 04 correctness defect is known after the final implementation CI run.

No independent reviewer/subagent runtime was exposed in this chat environment, so no independent-review result is claimed.

## Known non-blocking note

The production browser JS bundle is approximately:
- `591.81 kB` minified
- `152.47 kB` gzip

Vite emits its standard >500 kB chunk warning. This is not a Stage 04 correctness failure and remains well below the project transfer ceiling, but later stages should introduce code splitting before application/UI scope grows substantially.

## Remaining human gate

Run `docs/gates/STAGE-04-PLAYTEST.md` and record the owner result.

Required final question:

**Does Ball Lab alone feel satisfying to use?**

Until the owner answers `PASS`, Stage 04 is automated-green but its final subjective exit gate remains pending.
