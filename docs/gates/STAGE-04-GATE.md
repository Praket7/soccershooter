# Stage 04 Gate — Premium Football Physics

## Decision

**PASS — FINAL OWNER DATA AND CALIBRATION AUDIT COMPLETE**

Stage 04 is accepted subject only to documentation-inclusive CI, exact-SHA merge, and post-merge `main` verification.

The complete historical implementation/repair evidence remains in the earlier Stage 04 history. The authoritative final-pass evidence is now recorded in:

- `docs/gates/STAGE-04-FINAL-AUDIT.md`
- `docs/handoffs/STAGE-04-FINAL-HANDOFF.md`

## Final acceptance summary

Completed and verified:
- deterministic regulation-scale ball state (`0.436 kg`, `0.11 m`, `9.81 m/s²`)
- 120 Hz render-independent football substeps
- coefficient-table quadratic drag through the soccer-ball drag crisis
- spin-parameter Magnus lift with saturation
- deterministic spin decay
- bounded seed-repeatable low-spin knuckle behavior
- energy-dissipative bounce, friction, slide-to-roll coupling, rolling resistance, angular damping, and settlement
- professional-surface rebound/roll calibration regressions
- post/crossbar collision plus swept high-speed tunneling protection
- whole-ball goal-plane scoring geometry
- trajectory predictor using the authoritative integrator
- all eight required golden launch families
- deterministic random fuzz launcher and one-million-launch CI gate
- interactive Ball Lab with launch/spin/profile/slow-motion/trail/prediction/landing/CSV controls
- complete CSV audit traces covering flight, bounce, roll, and settlement
- live Ball Lab settlement logic that no longer freezes a still-moving roll at the former 8 s cap
- visually readable `1.35×` presentation ball while authoritative radius remains regulation scale
- Stage 01–03 regressions and canonical Stage 02 hash preserved

## Final owner CSV finding

The owner's final custom chip CSV was stable but ended at `t = 0.900 s` while grounded and still moving at approximately `3.4107 m/s`. That exposed a final export-lifecycle defect: the CSV omitted Stage 04's rolling/settling phase.

The owner launch was reproduced exactly from:
- speed `4.5 m/s`
- elevation `34°`
- angular velocity `+34 rad/s` around X (`top` axis)

The repaired exporter advances the same authoritative 120 Hz `stepBall` equations until translational settlement, with a deterministic 20 s safety cap. Live Ball Lab playback uses the same stop policy.

## Final turf calibration

The old stable-but-under-calibrated profile produced approximately:
- `0.571 m` rebound from a 2 m underside drop
- `13.93 m` travel from a 1 m ramp-equivalent no-slip roll probe

Final profile:
- `groundRestitution = 0.62`
- `rollingResistance = 0.80`
- `turfFriction = 0.72`
- `groundAngularDamping = 0.24`

Exact Stage 04 simulation now produces approximately:
- `0.699 m` rebound
- `6.653 m` ramp-equivalent roll

Flight aerodynamics were deliberately not retuned because the evidence did not show a flight-model defect.

## Final direct simulation audit

The actual shared Stage 04 TypeScript physics was compiled and executed headlessly in the chat runtime.

10,000 full randomized legal trajectories at 120 Hz produced:
- `0` NaN/Infinity failures
- `0` turf penetrations
- `0` positive mechanical-energy events
- `0` trajectories still translating after 15 s
- `0 / 100` duplicate determinism mismatches

A 120 Hz vs 240 Hz numerical-sensitivity audit over representative 1.25 s flights showed roughly `0.020–0.035 m` positional difference and about `0.09–0.11 m/s` velocity difference, supporting 120 Hz as the fixed runtime cadence.

## Exact automated implementation verification

Implementation head before final documentation:
- `2716874d5421da6799c3882f8767bdb6690bc071`

CI:
- run `39137595123`
- job `117705179893`

Results:
- frozen install / supply-chain policy: PASS
- randomness/private-content guards: PASS
- strict TypeScript: PASS
- **105 / 105 unit and contract tests PASS** across 16 files
- one-million-launch fuzz: PASS
- fuzz failures: `0`
- states checked: `4,000,000`
- fuzz checksum: `e0afd3f7`
- max fuzz speed: `44.80623456998427 m/s`
- max fuzz spin: `236.40180232339176 rad/s`
- Stage 02 deterministic hash: `d55b2d0b968372a5`
- FICTIONAL_PUBLIC server/web build: PASS
- server health: PASS
- **11 / 11 Chromium E2E PASS**

## Stage boundary

Still deferred to Stage 05:
- possession/control envelopes
- dribbling
- gameplay passing
- gameplay shooting/contact techniques
- tackling/interceptions against the ball
- aerial player-ball contacts

## Non-blocking note

The browser bundle remains about `593 kB` minified / `153 kB` gzip. The Vite >500 kB warning remains non-blocking for Stage 04; code splitting should happen before substantial later client growth.

## Gate result

**Stage 04: PASS.**

Merge only after the exact documentation-inclusive PR head is green. After merge, post-merge `main` CI must also pass before Stage 05 begins.
