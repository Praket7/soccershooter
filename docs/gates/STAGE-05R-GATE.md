# Stage 05R — Engineering Gate

**Branch:** `stage/05-07-owner-control-overhaul-continuation`
**Scope:** gait-timed physical dribbling, contact provenance, presentation QA, strikes, camera response, control assistance, and regression/exploit coverage.

## Automated evidence

- `pnpm lint` — PASS.
- `pnpm typecheck` — PASS.
- `pnpm test` — PASS, 80 files / 336 tests.
- `pnpm test:e2e` — PASS, 47 tests.
- `pnpm ball:fuzz` — PASS, 1,000,000 launches / 4,000,000 states / 0 failures; checksum `e0afd3f7`.
- `pnpm football:fuzz` — PASS, 250,000 mixed cases / 1,000,000 contact-plan states / 0 failures; checksum `8758b230`.
- `pnpm football:balance` — PASS; all eight spam/exploit policies score below their timed or varied references.
- `pnpm determinism:headless` — PASS, 10,000 ticks; hash `d55b2d0b968372a5`.
- Stage 04 golden ball trajectories remain on the existing unchanged physics implementation; the contact planner only changes velocity/angular velocity at legal events.
- Carry tests and browser probes confirm planned foot/tick/surface IDs, free-ball frames, non-teleporting contacts, longer sprint spacing, and recoverable misses.
- `pnpm dribble:calibration` — PASS, 16 deterministic scenarios and 125 measured contacts; distributions are recorded below and in the reproducible runner.

## Owner gate still required

The prescribed Task 3 micro-playtest before migrating sprint/skills has no recorded owner result. The final 12-step Stage 05R human playtest and 8/10 feel scorecard also have not been performed. Automated evidence cannot certify responsiveness, contact believability, or mastery depth. The owner requested integration to `main`; that authorizes the requested push, but does not turn the pending sequencing or subjective playtests into passing results.

## Calibration evidence and remaining gaps

`pnpm dribble:calibration` records deterministic simulator distributions at seed `0x05a8c1` across 16 cases: straight carry, precision/slalom, 30/90/120/180-degree jog cuts, 30/60/90/120/180-degree sprint cuts, pressure from both sides, weak-foot selection, loose-ball recovery, and trap-to-exit. The report is reproduced by `tools/perf/dribble-calibration.test.ts`.

- Touch cadence: median 2.692 contacts/s across cases (p10 2.609, p90 3.000, max 3.750).
- Contact timing error: 125 contacts, p50/p90/max all 0 ticks.
- Ball distance at contact: median 0.6635 m (p10 0.2910, p90 1.1633, max 1.5707).
- Exit ball-speed / incoming ball-speed ratio: median 1.0908 (p90 1.4970, max 11.4785; the max is a low-speed pickup and shows this ratio should be interpreted as an impulse diagnostic, not a retention score).
- Turn braking: plant duration p50 0, p90 13, max 20 ticks; braking distance p50 0.4706 m, p90 1.9225 m, max 2.1324 m.
- Loose-ball fraction: p90 0.6444, max 0.6500 in the 90/120/180-degree jog cuts; all sprint cut cases are at or below 0.0389. This is a measured control-quality issue to tune, not a passing target.
- Input-to-motion direction response (simulated, not rendered): 10 measured turn scenarios; p10 4 ticks, median 12, p90 20, max 24. The other six scenarios have no turn response and are excluded rather than reported as zero. Browser input-to-visible latency is not yet sampled as a distribution.

The plan's pass/shot transition calibration and live rendered input-latency distribution are still missing. The sharp jog-cut loose-ball fraction is exposed in the distribution and remains a feel/playability point for tuning and owner review. Stage 05R remains blocked on those engineering checks as well as the owner sequencing and feel gates.
