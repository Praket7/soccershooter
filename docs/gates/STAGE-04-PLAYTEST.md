# Stage 04 Owner Playtest — Ball Lab

## Purpose

This document records the Stage 04 owner-feel check and the evidence-driven repair pass that followed it. Stage 04 evaluates the standalone football physics instrument only. Stage 05 player-ball mechanics are intentionally excluded.

## Owner evidence supplied

The owner locally tested Ball Lab and supplied:
- a screen recording of the Stage 04 Ball Lab session;
- the exported CSV trace from the `Post rebound` preset;
- direct feedback that the football looked too small relative to the greybox environment;
- explicit instruction to analyze the artifacts, repair the issues, scour Stage 04 for related bugs, mark Stage 04 complete once green, and merge it to `main`.

The owner did not provide numeric 1–10 category scores, so none are invented.

## Findings from the supplied evidence

### Post rebound

The old preset did not perform the benchmark its name promised. The CSV showed the ball reaching the goal plane at approximately `x = 4.142 m`, outside the right post centered at `x = 3.66 m`, and already at turf height. The screen recording was consistent with the ball leaving the useful frame rather than visibly rebounding from the post.

Result: **FAIL in supplied playtest → REPAIRED**.

The preset is now a true in-flight right-post strike and has an automated regression requiring `goal-frame / right-post` contact above turf.

### Bounce / roll credibility

The supplied CSV exposed non-physical grounded behavior. During continuous turf motion, total kinetic energy rose instead of dissipating because rotational velocity was being steered toward a no-slip target without charging that energy against translation.

A RED regression reproduced the defect before the fix. Grounded fast motion also bypassed aerodynamic drag, contributing to excessive carry.

Result: **FAIL in supplied playtest data → REPAIRED**.

The ground model now uses dissipative contact coupling, rolling resistance, residual-spin damping, and horizontal aerodynamic drag. Magnus and knuckle remain flight-only while grounded.

### Ball readability / scale

The screen recording showed the regulation-sized mesh reading too small against the stylized greybox player/environment.

Result: **FAIL in supplied playtest → REPAIRED**.

Authoritative radius remains `0.11 m`; only presentation is scaled to `1.35×`. The rendered center is offset upward by the scale delta so the larger mesh rests on turf without changing collision geometry.

## Code-sweep findings beyond the reported issues

The post-playtest sweep also found and repaired:
- a live actual-trail refresh condition that could leave the green trail stale at common render/physics cadence ratios;
- football mesh rotation that depended on render FPS rather than 120 Hz physics steps;
- visual rotation continuing to advance while authoritative simulation was idle;
- already-grounded states retaining an elevated Y position;
- horizontally stationary residual spin failing to damp toward rest;
- CSV export lacking the speed/spin/energy/ground/contact diagnostics needed to audit future reports.

## Automated evidence after repairs

Final implementation head before gate documentation:
- `19188f7ef0efbc48233b9bed7f874f5266759342`

CI run `39133129985`, job `117692188354`:
- frozen install / security guards: PASS
- strict TypeScript: PASS
- **100 / 100 unit and contract tests PASS**
- **16 / 16 test files PASS**
- one-million-launch deterministic fuzz: PASS
- `4,000,000` authoritative states checked
- fuzz failures: `0`
- fuzz checksum: `508142ab`
- canonical Stage 02 hash remains `d55b2d0b968372a5`
- FICTIONAL_PUBLIC production build: PASS
- server health: PASS
- **10 / 10 Chromium E2E tests PASS**

New browser coverage specifically verifies:
- the `1.35×` presentation ball scale;
- enlarged ball turf clearance;
- live trajectory-trail advancement;
- authoritative-step-driven visual rotation;
- no visual rotation drift while idle/reset.

## Owner acceptance interpretation

The owner explicitly authorized marking Stage 04 complete and merging once the supplied playtest/CSV defects were analyzed, repaired, the code was swept for bugs, and verification returned green.

The final repaired build was not separately re-playtested by the owner before this gate record was written; this document does not claim otherwise. The merge authorization was conditional on the repair-and-verification process described above, and that condition was satisfied on the implementation head.

## Result

**Ball Lab satisfaction gate: PASS under explicit owner acceptance after evidence-driven repair and green verification.**

See `docs/gates/STAGE-04-GATE.md` for the full gate record and `docs/handoffs/STAGE-04-HANDOFF.md` for implementation handoff details.