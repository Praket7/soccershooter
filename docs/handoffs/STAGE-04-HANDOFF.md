# Stage 04 Worker Handoff — Premium Football Physics

## Task

Execute `docs/superpowers/plans/stages/04-ball-physics.md` from the accepted Stage 03 `main` base, then incorporate the owner's local Ball Lab recording/CSV feedback, perform a focused bug sweep, verify the repaired branch, and merge only after explicit owner authorization.

## Final status

**Stage 04 gate: PASS.**

The owner supplied local playtest evidence, requested all identified issues be repaired, explicitly requested a code sweep, and authorized Stage 04 completion/merge once the repaired branch was green.

No Stage 05 player-ball mechanics were introduced.

## Final Stage 04 implementation

### Authoritative ball model

`packages/physics` now owns deterministic football-specific state and forces:
- mass `0.436 kg`
- physical radius `0.11 m`
- gravity `9.81 m/s²`
- thin-shell rotational inertia approximation
- 120 Hz football substeps
- speed-table quadratic drag through the soccer-ball drag-crisis region
- spin-parameter Magnus lift with saturation
- deterministic spin decay
- bounded seeded low-spin knuckle behavior
- deterministic turf restitution/friction/rolling resistance
- rigid post/crossbar collision
- swept high-speed goal-frame collision protection
- whole-ball goal-plane crossing
- shared live/predictor `stepBall` integrator

### Ball Lab

`apps/web/src/dev/BallLab.ts` provides:
- presets for Driven, Straight, Curl, Power, Loft, Chip, Knuckle, and Post rebound
- launch speed, elevation, aim, spin rate/axis, profile, slow motion, trail, and knuckle-seed controls
- live actual trajectory
- predicted trajectory / expected landing marker
- CSV trace export
- deterministic browser telemetry for regression tests
- `L` launch, `0` reset, `E` export, `1`–`8` presets

The authoritative football remains regulation scale, while the greybox presentation mesh is `1.35×` for readability. The visual center is raised by the presentation-radius delta so the mesh rests cleanly on turf without changing physics/collision size.

## Owner playtest / CSV repair pass

The supplied recording and `Post rebound` CSV revealed three concrete product problems.

### Post preset did not hit the post

The old CSV crossed the goal plane around `x = 4.142 m`, outside the right post at `x = 3.66 m`, and at turf height. The old benchmark therefore did not test a post rebound in normal Ball Lab use.

Repair:
- Post preset changed to `28 m/s`, `12°`, `9.9°` aim, zero sidespin;
- regression now requires a real right-post contact while the ball is airborne.

### Turf model created energy

The CSV showed grounded kinetic energy rising substantially because the old rolling shortcut increased angular speed toward no-slip without taking that energy from translation.

RED regression reproduced this before repair (`~87.07 J → ~87.63 J` in a single grounded step).

Repair:
- removed energy-creating angular interpolation;
- tangential slip correction remains impulse-based and dissipative;
- rolling resistance removes linear and rolling angular motion together;
- residual stationary spin is damped to rest;
- regression requires grounded coupling to never increase kinetic energy.

### Fast ground roll carried too far

Grounded motion bypassed the aerodynamic model. A RED regression showed a 20 m/s grounded ball still moving at `19.66 m/s` after one second.

Repair:
- factored drag into a reusable `dragAcceleration` path;
- grounded balls receive horizontal aerodynamic drag in addition to turf resistance;
- Magnus and knuckle remain flight-only on turf.

## Additional bug-sweep repairs

The requested code sweep found and fixed:
- live actual trail update depending on sample parity, which could leave the green trail stale;
- visual football rotation being render-FPS dependent;
- visual rotation advancing while authoritative simulation was idle;
- already-grounded states being able to retain an elevated Y value;
- horizontally stationary residual spin failing to settle;
- enlarged presentation sphere visually sinking through turf;
- CSV export missing the diagnostics necessary to audit energy/contact reports.

CSV output now includes:
- position / velocity / angular velocity
- speed
- spin magnitude
- total kinetic energy (`energyJ`)
- grounded state
- last contact kind
- last contact id

## TDD / debugging evidence

The feedback repair pass used explicit RED → GREEN cycles.

Important RED points:
- turf energy regression failed before coupling repair;
- grounded drag regression failed with 20 m/s → 19.66 m/s after one second;
- Post benchmark regression failed before the preset was re-aimed;
- CSV diagnostics regression failed before enriched export;
- visual turf-clearance E2E failed before the presentation-center offset.

All are green on the final implementation head.

## Final implementation verification before documentation

Implementation head:
- `19188f7ef0efbc48233b9bed7f874f5266759342`

Exact CI:
- run `39133129985`
- job `117692188354`

Results:
- frozen install / supply-chain policy: PASS
- authoritative-randomness guard: PASS
- private-reference-content guard: PASS
- strict TypeScript: PASS
- **100 / 100 unit/contract tests PASS**
- **16 / 16 unit test files PASS**
- one-million-launch fuzz: PASS
- fuzz failures: `0`
- states checked: `4,000,000`
- fuzz checksum: `508142ab`
- max speed observed: `44.80623456998427 m/s`
- max spin observed: `233.76221878122678 rad/s`
- canonical Stage 02 hash: `d55b2d0b968372a5`
- FICTIONAL_PUBLIC server/web build: PASS
- server health: PASS
- **10 / 10 Chromium E2E PASS**

The changed fuzz checksum is expected because grounded dynamics were intentionally corrected; determinism and zero failures remain intact.

## Stage boundary

Stage 04 deliberately does **not** implement:
- possession/control envelopes
- dribbling
- gameplay passing
- gameplay shooting
- tackling/interception
- aerial player-ball contacts

Ball Lab `Launch` remains a physics instrument rather than a gameplay kick action.

## Known non-blocking note

The production browser JS bundle is approximately `593 kB` minified / `153 kB` gzip. Vite's >500 kB warning remains non-blocking. Later stages should introduce code splitting before the app grows substantially.

## Owner acceptance

The owner explicitly requested that Stage 04 be marked complete and merged after the supplied recording/CSV were analyzed, fixes were made, the code was swept, and verification returned green.

The owner did not separately re-playtest the repaired build before merge, and this handoff does not claim otherwise.

## Exact next action

1. verify the documentation-inclusive Stage 04 branch head is fully green;
2. update PR #9 / Issue #8 with final evidence;
3. mark PR #9 ready for review;
4. merge PR #9 to `main` using the exact verified head SHA;
5. verify post-merge `main` CI and Stage 01 contracts are green;
6. close Issue #8 as completed;
7. begin Stage 05 only from that verified `main` base.