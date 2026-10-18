# Stage 05 Gate — Core Football Interactions

## Decision

**ENGINEERING PASS — OWNER FUN GATE PENDING**

Stage 05 implementation is complete against the deterministic engineering requirements in `docs/superpowers/plans/stages/05-core-football.md`.

The branch must **not** be merged yet. The Stage 05 plan also contains subjective human-playtest exit criteria: a 10-minute solo loop must remain engaging, straight/curve/chip must be intentionally producible, defending timing must read well, and combined movement + ball satisfaction must reach a median of at least 8/10. Automated simulation cannot honestly certify those human judgments.

Implementation is therefore frozen pending the owner playtest in `docs/gates/STAGE-05-PLAYTEST.md`.

## Verified implementation head before documentation

- branch: `stage/05-core-football`
- implementation head: `2674a19c291586dc5b9e5087253d88b86a4427b6`
- PR: `#13`
- CI run: `39143197935`
- CI job: `117721649012`
- result: **PASS**

### Exact CI evidence

- supply-chain / private-content guards: PASS
- strict TypeScript: PASS
- unit + contract tests: PASS
- Stage 04 one-million-launch ball fuzz: PASS
- Stage 05 250,000-case football action fuzz: PASS
- Stage 05 exploit-bot balance gate: PASS
- standalone deterministic trace: PASS
- FICTIONAL_PUBLIC production build: PASS
- server health: PASS
- Chromium E2E / browser parity: PASS

Latest source-freeze unit/contract suite before the final cadence-safe E2E-only commit contained **139 / 139 PASS** across 24 files. The final commit changed only the timing-sensitive browser assertion, and the full final CI passed.

## Stage 04 regression preservation

The prior physics gate remains intact.

One-million-launch deterministic ball fuzz on the Stage 05 head:

- launches: `1,000,000`
- checked states: `4,000,000`
- failures: `0`
- checksum: `e0afd3f7`
- max speed observed: `44.80623456998427 m/s`
- max spin observed: `236.40180232339176 rad/s`

Canonical deterministic trace remains:

- tick rate: `30 Hz`
- ticks: `10,000`
- seed: `1511506142`
- hash: `d55b2d0b968372a5`

## Stage 05 deterministic football fuzz

The repository now runs a dedicated action-level stress gate against the real Stage 05 contact builders.

- randomized cases: `250,000`
- action evaluations: `1,000,000`
- contacts applied: `184,057`
- failures: `0`
- checksum: `0b8247ef`
- max legal impulse observed: `15.500000000000005 N·s`
- max resulting speed observed: `34.9018646963763 m/s`

The fuzz gate checks finite values, bounded impulses, contact invariants, and deterministic repeatability across control touches, passes, shots, challenges, interceptions, and aerial-related contact paths.

## Independent local simulation audit

In addition to repository CI, a separate deterministic scratch simulation was run locally in the chat runtime using the Stage 04 aerodynamic/ground equations and Stage 05 action semantics.

Across **100,000 randomized football interaction scenarios**:

- teleports: `0`
- impulse-cap violations: `0`
- illegal shot speeds above the 36 m/s Stage 05 envelope: `0`
- NaN / Infinity states: `0`
- turf penetrations: `0`
- deterministic checksum: `3aed0d0d`

This local harness is supplementary evidence. Repository tests and CI remain the source of truth.

## Exploit-bot balance gate

The canonical deterministic CI tournament rejects the four simple dominant strategies called out in the stage plan.

| Strategy | Spam utility | Varied/timed reference | Dominates? |
| --- | ---: | ---: | --- |
| sprint-only | `0.2562354251` | `0.6093465536` | no |
| shot-spam | `-5.0433605814` | `8.3214991685` | no |
| tackle-spam | `-2.7400000000` | `10.6600000000` | no |
| dribble-circle | `0.2226269923` | `0.6093465536` | no |

The independent local stress tournament also produced a large separation between blind tackle spam and timed challenges, reinforcing the same conclusion.

## Core implementation accepted

### First touch and dribbling

- front/body control envelope
- physical velocity impulse only; ball position is never snapped or welded
- controlled, precision, and sprint touches are mechanically distinct
- sprint touches are deliberately longer/harder
- pressure, incoming speed, body angle, and balance reduce control quality
- stationary player + stationary ball produces `idle-no-touch`, preventing repeated magnetic nudges
- genuinely incoming balls remain trappable by a stationary player
- touch cooldown prevents 60 Hz re-contact spam

### Passing

- ground, driven, lofted, and through/lead pass families
- moving receiver prediction
- user aim blended with bounded assist
- assist cannot authorize impossible behind-body passes
- pass inputs are one-shot edges on keyboard and gamepad rather than cooldown-hidden held spam

### Shooting

- normal
- driven
- finesse
- chip
- knuckle
- outside-foot

Shot output depends on aim, charge, body alignment, balance, pressure, foot, and technique spin signature.

Additional hardening completed during final review:

- nominal normal shots stay intentionally close to the aim plane
- finesse and outside-foot contacts create deliberate lateral curvature
- chip produces a materially higher apex
- full-charge output is bounded to the legal Stage 05 envelope
- lost-focus / disconnected-input charge is cancelled instead of banked invisibly
- knuckle perturbation is now explicit shot metadata: non-knuckle strikes clear the seed to `0`; knuckle strikes receive a deterministic event seed

### Defense

- standing challenge
- committed tackle
- recovery penalty for mistimed commitment
- interception windows
- moving-defender interception geometry compares ball and defender at the **same predicted timestamp**
- committed tackle spam loses expected value in deterministic balance tests

### Aerial core

- readable header eligibility
- readable volley eligibility
- physical contact hooks retained for later advanced aerial techniques without implementing later-stage bicycle/scissor scope

### Practice loop

- Stage 05 Football Practice mode
- physically independent live ball
- moving pass receiver
- greybox keeper
- practice goals
- whole-ball goal scoring from Stage 04 physics
- bounded keeper parry
- goal/save counters
- shot-style controls
- action diagnostics HUD
- reset flow
- Stage 04 Ball Lab preserved as a separate instrument
- visual ball rotation advances on authoritative 120 Hz physics substeps, not render FPS

## Important defects found and repaired during final audit

1. **Idle magnetic nudge** — idle player + idle ball could re-trigger a control impulse after cooldown. Fixed at the control-envelope source.
2. **Moving interception geometry** — relative timing was correct, but reach was initially checked against the defender's current position. Both actors are now compared at the same predicted time.
3. **Stale shot charge** — losing a held input without a release could bank charge for a later shot. It now cancels.
4. **Held pass repeat** — keyboard E / gamepad X could remain asserted while held. Both are now rising-edge / keydown-edge actions.
5. **Visual spin render dependence** — presentation rotation risk was audited and locked to authoritative 120 Hz ball substeps.
6. **Straight-shot drift regression fixture** — the integration fixture incorrectly enabled knuckle perturbation for ordinary shots. The fixture now matches production semantics.
7. **Knuckle seed lifecycle** — a returned ball could theoretically inherit a prior knuckle seed unless a later strike cleared it. Shot solutions now explicitly carry deterministic knuckle state.
8. **E2E cadence assumptions** — browser checks were rewritten to validate deterministic state progress and active recovery rather than runner wall-clock timing.

## Research basis

The final tuning and review were checked against research rather than relying only on genre convention.

### First touch / receiving

University of Tsukuba / Football Studies (2026) reported that quicker receive-to-pass transitions were associated with a controlled pre-contact foot approach, more pass-ready posture, and limiting excessive post-contact ball rebound. This supports Stage 05's penalties for uncontrolled arrival and excess rebound rather than magnetic correction.

- DOI: `10.1016/j.footst.2026.100071`
- https://www.tsukuba.ac.jp/en/research-news/20260806143000.html

### Body orientation and pass feasibility

Research modeling soccer pass feasibility explicitly identifies player body orientation as an important constraint on whether a pass is realistically receivable. Stage 05 therefore allows bounded assist but does not let assist manufacture impossible behind-body actions.

- https://openaccess.thecvf.com/content_CVPRW_2020/papers/w53/Arbues-Sanguesa_Using_Players_Body-Orientation_to_Model_Pass_Feasibility_in_Soccer_CVPRW_2020_paper.pdf

### Defensive timing

Match-analysis research on elite soccer ball recovery links the defender's timing/delay behavior and interception behavior with effective recoveries. Stage 05 therefore rewards timed standing/contain/interception decisions and attaches recovery cost to mistimed commitment instead of making tackle spam free.

- https://pmc.ncbi.nlm.nih.gov/articles/PMC7386141/

These sources are calibration/interaction references, not claims that the game reproduces human biomechanics exactly.

## Scope boundary

Stage 05 intentionally does **not** begin later stages. In particular, this gate does not claim:

- full team AI
- multiplayer/network prediction
- advanced animation locomotion
- bicycle/scissor implementation
- production goalkeeper AI
- tactical formations
- career/meta systems
- final art/audio/polish

## Non-blocking engineering note

The production web bundle is approximately `620 kB` minified / `161 kB` gzip and still triggers Vite's >500 kB chunk warning. It does not block Stage 05 correctness, but client code splitting should be addressed before substantial later-stage growth.

## Gate result

**Stage 05 engineering gate: PASS.**

**Stage 05 human fun gate: PENDING OWNER PLAYTEST.**

Do not merge PR #13 until:

1. the owner completes the Stage 05 playtest protocol;
2. subjective gate criteria are accepted or resulting defects are repaired;
3. documentation-inclusive CI is green on the exact PR head;
4. the owner explicitly requests merge.
