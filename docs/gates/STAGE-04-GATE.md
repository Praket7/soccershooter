# Stage 04 Gate — Premium Football Physics

## Decision

**PASS — OWNER PLAYTEST INCORPORATED AND MERGE AUTHORIZED**

Stage 04 satisfies the measurable automated gate and the owner-feel gate after an evidence-driven repair pass based on the owner's supplied screen recording and exported Ball Lab CSV.

The owner explicitly instructed that, after analyzing those artifacts, fixing the discovered defects, completing a code sweep, and obtaining a green verification run, Stage 04 should be marked complete and merged to `main`.

No claim is made that the owner manually retested the post-fix build before merge. The acceptance basis is the owner's supplied playtest evidence plus explicit merge authorization conditioned on repairing the evidence-backed issues and returning the full automated gate to green.

## Final implementation scope

Completed:
- [x] deterministic regulation-scale `BallState`
- [x] 120 Hz fixed football substeps independent of rendering
- [x] coefficient-table quadratic drag around the soccer-ball drag crisis
- [x] Magnus lift from `omega × velocity`
- [x] lift coefficient driven by spin parameter with configured saturation
- [x] deterministic spin decay
- [x] bounded, continuous, seed-repeatable low-spin knuckle perturbation
- [x] stable bounce restitution
- [x] dissipative turf friction and slide-to-roll coupling
- [x] rolling resistance, aerodynamic ground drag, rotational damping, and settling
- [x] post/crossbar rigid collision benchmark
- [x] swept high-speed goal-frame collision protection
- [x] whole-ball goal-plane crossing utility
- [x] trajectory predictor using the same authoritative integrator
- [x] required golden reference launch families
- [x] deterministic random stress/fuzz launcher
- [x] one-million-launch finite-state fuzz in normal CI
- [x] integrated interactive Ball Lab
- [x] launch speed, elevation, aim, spin axis/rate, coefficient profile, slow motion, trajectory/predictor, knuckle seed, and CSV export controls
- [x] visually readable ball scale without altering authoritative collision radius
- [x] live actual trajectory trail
- [x] fixed-step visual ball rotation independent of render FPS
- [x] enriched CSV diagnostics for speed, spin, kinetic energy, grounded state, and contact metadata
- [x] Stage 01–03 regressions preserved
- [x] canonical Stage 02 deterministic hash preserved
- [x] owner playtest feedback analyzed and repaired
- [x] owner explicitly authorized Stage 04 completion and merge after repairs and green verification

Explicitly not implemented in Stage 04:
- player-ball possession or magnetic control
- dribbling
- gameplay pass input/targeting
- gameplay shooting input/contact styles
- tackling/interceptions against the ball
- aerial player-ball contacts

Those remain Stage 05 scope.

## Owner playtest evidence and repairs

### 1. Post-rebound preset missed the frame

The supplied CSV showed the old `Post rebound` preset crossing the goal plane at approximately:
- `x = 4.142 m`
- `y = 0.110 m`

The right post is centered at `x = 3.66 m`, so the preset missed wide and reached the frame region only after dropping to turf height. The screen recording visually matched this behavior.

Repair:
- replaced the old low, spinning post preset with a true in-flight right-post benchmark;
- preset now uses `28 m/s`, `12°` elevation, `9.9°` aim, and zero sidespin;
- regression requires an actual `goal-frame / right-post` contact above turf.

### 2. Turf coupling created kinetic energy

The supplied CSV exposed a non-physical increase in total kinetic energy during continuous grounded motion. The rolling shortcut was steering angular velocity toward a no-slip target without removing the corresponding translational energy.

A RED regression independently reproduced the defect in one grounded step:
- before: approximately `87.07 J`
- after: approximately `87.63 J`

Repair:
- removed the energy-creating angular interpolation;
- retained dissipative tangential impulse for slip;
- rolling resistance now removes translation and rolling spin together;
- stationary residual spin is damped and eventually settles;
- regression requires turf slide-to-roll evolution to never increase kinetic energy.

### 3. Fast ground roll ignored aerodynamic drag

A second RED regression showed a grounded ball beginning at `20 m/s` still moving at approximately `19.66 m/s` after one second because flight aerodynamics were bypassed entirely once `grounded=true`.

Repair:
- extracted the drag-only acceleration from the aerodynamic model;
- grounded balls now receive horizontal aerodynamic drag plus turf resistance;
- Magnus and knuckle forces remain flight-only while grounded;
- regression requires the 20 m/s one-second ground roll to fall below the old unrealistic result.

### 4. Ball was visually too small

The owner's recording showed that the regulation-scale sphere read too small against the stylized greybox athlete/environment.

Repair:
- authoritative physical radius remains `0.11 m`;
- presentation mesh uses a `1.35×` visual scale only;
- rendered center is raised by the visual-radius delta so the enlarged mesh rests on the turf instead of sinking through it;
- browser coverage verifies both scale and visual turf clearance.

### 5. Actual trajectory trail could stay stale

The review found that the green actual trail was updated according to sample-array parity. At a stable presentation cadence that advances two 120 Hz physics steps per rendered frame, the sample count could remain odd indefinitely and leave the trail stale.

Repair:
- actual trail now refreshes whenever at least one authoritative physics substep ran;
- browser coverage requires the live trail to accumulate real points during flight.

### 6. Visual spin was render-FPS dependent

The review found the football mesh was previously rotated once per render frame using a fixed 1/120-second rotation increment. That made visual spin rate depend on monitor FPS and allowed the visual to rotate while authoritative physics was idle.

Repair:
- visual rotation is now advanced inside the same 120 Hz substep loop as ball physics;
- idle/reset frames never alter the visual quaternion;
- browser coverage checks both moving and idle cases.

### 7. Ground-state cleanup

The sweep also repaired two edge cases:
- a state already marked grounded is clamped back to the physical turf height;
- a horizontally stationary but still-spinning grounded ball now damps residual angular velocity instead of retaining it forever.

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
- [x] stronger legal sidespin increases deviation until configured lift saturation
- [x] same-seed knuckle flight repeats exactly and remains bounded
- [x] bounce/roll remain stable
- [x] turf coupling cannot create kinetic energy
- [x] fast grounded motion receives drag
- [x] post/crossbar impact cannot create an energy explosion
- [x] high-speed legal launch cannot tunnel through a post in one 120 Hz substep
- [x] swept frame impact consumes exactly one authoritative fixed step
- [x] Ball Lab post preset actually contacts the right post
- [x] predictor uses the authoritative `stepBall` equations rather than a separate approximation

## Final implementation verification before gate documentation

Implementation head:
- commit: `19188f7ef0efbc48233b9bed7f874f5266759342`
- CI run: `39133129985`
- job: `117692188354`

Environment:
- Node `v24.21.0`
- pnpm `12.9.1`
- frozen workspace install: PASS
- supply-chain policy verification: PASS
- authoritative-randomness guard: PASS
- private-reference-content guard: PASS
- strict TypeScript: PASS

Unit / contract suite:
- **100 / 100 tests PASS**
- **16 / 16 test files PASS**

Million-launch deterministic ball fuzz:

```text
launches: 1000000
failures: 0
checksum: 508142ab
maxSpeedObserved: 44.80623456998427
maxSpinObserved: 233.76221878122678
statesChecked: 4000000
```

The fuzz checksum changed from the pre-playtest implementation because grounded ball dynamics were intentionally corrected. The zero-failure deterministic result remains the gate criterion.

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
- Chromium E2E / browser parity: **10 / 10 PASS**

## TDD / debugging evidence

The owner-feedback repair pass continued to use RED → GREEN verification:
- turf-energy regression failed on the old model before the dissipative coupling fix;
- grounded-drag regression failed on the old grounded path before drag was added;
- post-preset regression failed before the benchmark was re-aimed;
- CSV diagnostics regression failed before export was enriched;
- visual turf-clearance browser regression failed before the enlarged mesh center was offset;
- each repair subsequently passed on the final implementation head.

## Research / architecture basis

The implementation remains a deterministic inexpensive game model grounded in published soccer/sports-ball physics:
- speed-dependent quadratic drag through the soccer-ball drag crisis;
- Magnus direction from `omega × velocity`;
- spin-parameter-dependent lift with saturation;
- bounded deterministic low-spin unsteady lift for knuckle behavior;
- dissipative contact/rolling behavior;
- one shared authoritative integrator for live simulation and prediction.

Football-specific forces and contacts remain pure headless TypeScript in `packages/physics`. General rigid-body infrastructure remains reserved for Rapier in later integration layers.

## Final review status

The post-playtest code sweep checked:
- energy gain
- excessive ground carry
- contact/preset validity
- high-speed tunneling
- fixed-step time conservation
- nondeterministic knuckle behavior
- predictor/live parity
- trajectory display freshness
- render-FPS-dependent visual state
- enlarged-ball ground clipping
- Stage 03 regressions
- Stage 05 scope creep

No unresolved critical or important Stage 04 correctness defect is known after CI run `39133129985`.

No independent reviewer/subagent runtime was exposed in this chat environment, so no independent-review result is claimed.

## Known non-blocking note

The production browser JS bundle is approximately `593 kB` minified / `153 kB` gzip. Vite's standard >500 kB chunk warning remains non-blocking for Stage 04, but later stages should introduce code splitting before the application grows substantially.

## Gate result

**Stage 04: PASS.**

The branch may be merged to `main` after the final documentation-inclusive head is verified green. Stage 05 must begin only from that verified post-merge `main` base.