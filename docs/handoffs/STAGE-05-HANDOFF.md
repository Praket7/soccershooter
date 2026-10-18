# Stage 05 Handoff — Core Football Interactions

## Status

Stage 05 implementation is feature-complete and the engineering gate is green.

The only remaining acceptance item is the owner feel/playtest gate in `docs/gates/STAGE-05-PLAYTEST.md`.

Do **not** begin Stage 06 and do **not** merge PR #13 until the owner playtest is accepted and the owner explicitly requests merge.

## Source freeze before final documentation

- branch: `stage/05-core-football`
- implementation head: `2674a19c291586dc5b9e5087253d88b86a4427b6`
- PR: `#13`
- issue: `#12`
- CI run: `39143197935`
- CI job: `117721649012`
- result: PASS

## What Stage 05 now contains

### Simulation

- physically independent football interaction model
- first-touch / dribble control envelope
- bounded touch impulses
- pressure / balance / body-angle / incoming-speed quality model
- idle-no-touch anti-magnet rule
- ground, driven, lofted, and through/lead pass solver
- bounded pass assist with behind-body legality
- normal, driven, finesse, chip, knuckle, and outside-foot shooting
- deterministic knuckle-seed lifecycle
- standing challenge and committed tackle
- commitment recovery penalties
- moving interception windows
- header and volley eligibility
- deterministic runtime cooldown / charge cadence

### Web practice surface

- Football Practice mode
- Stage 04 Ball Lab preserved separately
- live physical practice ball
- moving receiver marker
- greybox keeper
- practice goals
- goal/save counters
- shot-style UI
- action diagnostics HUD
- browser-visible state probe for deterministic E2E
- visual spin driven by ball-physics substeps

### Input hardening

- keyboard pass is edge-triggered
- standard-gamepad pass is rising-edge-triggered
- shot charge is hold/release based
- lost release / focus loss cancels stale charge
- mixed keyboard/gamepad behavior preserves prior movement controls

## Verification summary

### Unit / contract

Latest source-freeze run before the final E2E-only cadence adjustment:

- `139 / 139 PASS`
- 24 test files

The final cadence adjustment modified only an E2E threshold and the subsequent full CI passed.

### Stage 04 regression

- one-million-launch fuzz: PASS
- failures: `0`
- states checked: `4,000,000`
- checksum: `e0afd3f7`
- canonical Stage 02 determinism hash: `d55b2d0b968372a5`

### Stage 05 football fuzz

- cases: `250,000`
- action evaluations: `1,000,000`
- contacts applied: `184,057`
- failures: `0`
- checksum: `0b8247ef`
- max impulse: `15.500000000000005 N·s`
- max resulting speed: `34.9018646963763 m/s`

### Exploit bots

All four simple spam policies lose to their timed/varied references:

- sprint-only: does not dominate
- shot-spam: does not dominate
- tackle-spam: does not dominate
- dribble-circle: does not dominate

### Independent local simulation

Supplementary local scratch stress audit:

- 100,000 randomized interaction scenarios
- 0 teleports
- 0 impulse-cap violations
- 0 illegal >36 m/s shots
- 0 NaN / Infinity states
- 0 turf penetrations
- deterministic checksum `3aed0d0d`

### Production / browser

- strict TypeScript: PASS
- security/private-content guards: PASS
- FICTIONAL_PUBLIC build: PASS
- server health: PASS
- Chromium E2E / parity: PASS

## Important repaired defects

The final review did not merely add tests; it exposed and fixed several source-level problems:

1. idle stationary ball could receive repeated cooldown nudges;
2. moving interception reach used the defender's current rather than predicted position;
3. lost shot release could bank hidden charge;
4. pass input could behave as held rather than one-shot;
5. visual ball spin risked render-frame dependence;
6. a trajectory test incorrectly enabled knuckle perturbation for non-knuckle shots;
7. knuckle state could persist unless later contacts explicitly cleared it;
8. browser assertions depended on wall-clock cadence instead of durable state.

## Research rationale

Stage 05 tuning is informed by:

- University of Tsukuba / Football Studies 2026 first-touch biomechanics: controlled approach, receiving posture, and limited rebound support the non-magnetic control model;
- body-orientation pass-feasibility research: supports treating body orientation as a hard realism constraint rather than letting assist manufacture impossible actions;
- elite ball-recovery analysis: supports timing/interception value and recovery cost for mistimed defensive commitment.

See `docs/gates/STAGE-05-GATE.md` for references and interpretation.

## Stage boundary

Not implemented here:

- Stage 06+ team/tactical systems
- production team AI
- multiplayer/network prediction
- final animation system
- advanced bicycle/scissor mechanics
- production goalkeeper behavior
- final content, stadium art, audio, progression, economy, or meta

## Remaining owner action

Run `docs/gates/STAGE-05-PLAYTEST.md`.

If the playtest passes:

1. record owner scores/findings;
2. change Stage 05 gate to final PASS;
3. run exact documentation-inclusive CI;
4. review final PR diff;
5. only after explicit owner instruction, mark PR #13 ready and merge its exact verified head;
6. require post-merge `main` CI PASS before Stage 06 starts.

If the playtest finds a feel defect, keep the PR draft and repair Stage 05 only. Do not hide the problem by weakening the subjective gate.
