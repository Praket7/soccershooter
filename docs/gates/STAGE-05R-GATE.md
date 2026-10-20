# Stage 05R — Engineering Gate

**Branch:** `integration/stages-05r-08-10`
**Scope:** gait-timed physical dribbling, contact provenance, presentation QA, strikes, camera response, control assistance, and regression/exploit coverage.

## Automated evidence

- `pnpm lint` — PASS.
- `pnpm typecheck` — PASS.
- `pnpm test` — PASS, 83 files / 343 tests.
- `pnpm test:e2e` — PASS, 52 tests; latest run recorded 48 input-to-render timing samples (min 15.5 ms, p50 16.9 ms, p90 18.1 ms, max 21.3 ms). All 24 W inputs were consumed within one authoritative simulation tick and produced positive forward player-state movement (minimum 0.00556 m); render-frame counts are retained as descriptive telemetry.
- `pnpm ball:fuzz` — PASS, 1,000,000 launches / 4,000,000 states / 0 failures; checksum `e0afd3f7`.
- `pnpm football:fuzz` — PASS, 250,000 mixed cases / 1,000,000 contact-plan states / 0 failures; checksum `8758b230`; max result speed `34.88992486315191` m/s.
- `pnpm football:balance` — PASS; all eight spam/exploit policies score below their timed or varied references.
- `pnpm determinism:headless` — PASS, 10,000 ticks; hash `d55b2d0b968372a5`.
- Stage 04 golden ball trajectories remain on the existing unchanged physics implementation; the contact planner only changes velocity/angular velocity at legal events.
- Carry tests and browser probes confirm planned foot/tick/surface IDs, free-ball frames, non-teleporting contacts, longer sprint spacing, and recoverable misses.
- A new live-game E2E waits inside the page for the live planner’s next contact to be exactly two simulation ticks ahead, arms a test-only fixed-simulation-tick observer, then sends the right-angle cut. It records all 36 authoritative ticks after the `startTick` baseline with no gaps, verifies the cut input is consumed on or before the scheduled contact step, bounds player-ball separation below 2 m at every recorded tick, requires another planned contact, verifies that physical free-ball frames advance, and checks final absolute Z displacement below 2.2 m. Same-tick acknowledgement is valid because the fixed-step loop applies movement and processes the contact before it stamps the acknowledgement tick. Sampling inside the simulation loop avoids render-frame and Playwright polling cadence. It does not infer a simulation-tick loose-ball fraction from DOM samples; the deterministic simulation regression covers that rate.
- `pnpm dribble:calibration` — PASS, 16 deterministic scenarios and 136 measured contacts; distributions are recorded below and in the reproducible runner.

## Owner gate still required

The prescribed Task 3 micro-playtest before migrating sprint/skills has no recorded owner result. The final 12-step Stage 05R human playtest and 8/10 feel scorecard also have not been performed. Automated evidence cannot certify responsiveness, contact believability, or mastery depth. The owner requested integration to `main`; that authorizes the requested push, but does not turn the pending sequencing or subjective playtests into passing results.

## Calibration evidence and remaining gaps

`pnpm dribble:calibration` records deterministic simulator distributions at seed `0x05a8c1` across 16 cases and 136 measured contacts: straight carry, precision/slalom, 30/90/120/180-degree jog cuts, 30/60/90/120/180-degree sprint cuts, pressure from both sides, weak-foot selection, loose-ball recovery, and trap-to-exit. The report is reproduced by `tools/perf/dribble-calibration.test.ts`.

- Touch cadence: median 2.692 contacts/s across cases (p10 2.609, p90 2.840, max 3.750).
- Contact timing error: 136 contacts, p50/p90/max all 0 ticks.
- Ball distance at contact: median 0.6244 m (p10 0.2149, p90 0.9025, max 1.2921).
- Exit ball-speed / incoming ball-speed ratio: median 1.0908 (p90 1.4970, max 13.31; the max is a low-speed pickup and shows this ratio should be interpreted as an impulse diagnostic, not a retention score).
- Turn braking: plant duration p50 0, p90 13, max 20 ticks; braking distance p50 0.4706 m, p90 1.9225 m, max 2.1324 m.
- Loose-ball fraction after the final-contact branch fix: p90 0, max 0.6500. The 90- and 120-degree jog cuts each retain control for all 180 ticks; the remaining 0.6500 maximum is isolated to the full 180-degree jog reversal, where a late reversal deliberately stays committed rather than snapping the ball backward. All sprint cut cases remain at or below 0.0389. The fix allows a still-reachable forward or angled cut to retarget the next planned impulse on its last contact beat; normal timing, contact geometry, reach, and impulse validation remain authoritative.
- Input-to-motion direction response (simulated): 10 measured turn scenarios; p10 4 ticks, median 12, p90 20, max 24. The other six scenarios have no turn response and are excluded rather than reported as zero. The rendered browser response distribution is recorded below.

### Task 8 transition and rendered-response calibration

- `pnpm strike:calibration` runs the production gait-aware strike planner at seed-independent fixed inputs across 10 gait phases, two stride durations, and both strike kinds: 20 shot and 20 pass samples. Each has a legal contact; both delay distributions are 5–18 ticks (p50 15, p90 18). The deterministic regression is `tools/perf/strike-transition-calibration.test.ts`.
- The live Playwright carry-to-strike test jogs, resets the free ball into the control pocket, then requests each action and measures to the actual contact event on the practice simulation clock. Latest full E2E run: shot 5/5 contacts, 17–21 ticks (p50 17, p90 17); pass 5/5, 6–10 ticks (p50 10, p90 10). This is a small integration sample, while the deterministic matrix provides phase coverage.
- The browser response probe publishes `data-input-to-render-ms` after the WebGL draw and following animation-frame boundary. It records both the actual render frame and the authoritative simulation tick that first consumed each input. The test verifies input-to-simulation consumption within one fixed tick and positive forward root movement by the later render acknowledgement; this probe does not measure trajectory samples or body response within the consumed tick. Display-frame counts and milliseconds remain descriptive because event timing and render scheduling vary. The latest full 52-test E2E run recorded 48 timing samples (min 15.5 ms, p50 16.9 ms, p90 18.1 ms, max 21.3 ms), 24 simulation-tick deltas (p90/max 1/1), 24 render-frame deltas (p90/max 1/1), and 24 positive movement responses (minimum 0.00556 m). This does not measure physical display photons. The distribution is collected by `e2e/movement.spec.ts`.

The plan's pass/shot transition calibration and browser rendered-response distribution now have reproducible instrumentation and recorded evidence. The final-contact branch fix is covered by deterministic 90- and 120-degree jog-cut regressions, a live 90-degree cut E2E, an assertion that a full reversal stays committed on the final contact beat, and the full 16-scenario calibration. Stage 05R remains blocked on owner sequencing and the 12-step feel scorecard; automated evidence does not resolve those human gates.

## Owner recording follow-up — 2026-10-20

The owner rejected the current feel again after testing ordinary forward/back, left/right, and circle movement. Inspection of the 2026-10-20 recording showed the practice HUD advertising a `SPRINT KNOCK-ON` target of 32 km/h. Root cause: `stepPlannedDribble` executed a fixed planned velocity and bypassed the existing `buildControlTouch` feedback, so contact impulses did not recenter an off-line ball. Sprint cadence was also 21–27 ticks (0.35–0.45 s), allowing a circle to outrun the next planned foot contact.

Repair in the current working tree:
- actual planned contacts now use the bounded control-envelope command against the live ball position and speed, while preserving the plan's committed direction;
- normal and sprint target speeds now match the carrier, sprint target distance is `0.50–0.55 m`, and normal target distance is `0.36 m`;
- moving carry cadence is 8–11 ticks (0.13–0.18 s), so the ball gets corrected through direction changes before leaving legal reach;
- practice copy now describes short sprint carry touches rather than knock-ons.

The new deterministic input stress matrix includes forward/reverse, lateral, slalom, rapid jog zigzag, sprint cut/reversal, and two continuous circles. After the movement-force calibration, current maxima are 0.96 m for jog reversal, 0.76 m for sprint circle, and 0.68 m for straight sprint; all nine scenarios report zero loose-ball ticks and zero ticks beyond 1 m. These are engineering regressions, not owner feel approval. The Stage 05R human playtest and 8/10 feel scorecard remain required.

## Running-shot and movement research follow-up — 2026-10-20

The next owner report identified that shot preparation slowed the ball below 4.85 m/s even when its carrier was sprinting; dribble control was then suspended for the short gait-timed strike window. Shot-preparation touches now preserve predicted carrier pace (bounded to the existing 9.35 m/s carry limit), so a runner does not leave the ball behind before a legal strike. This remains a real bounded foot impulse; no ball attachment or teleport was added. A sprint regression asserts an 8.1 m/s runner receives an approximately pace-matched setup touch.

The movement model follows three measured principles: football change-of-direction performance relates to both short sprint and braking capacity; a proposed dribble model alternates physical touches and locomotion to intercept the next ball position; and instep kicking uses a running approach, support-foot placement, and sequential pelvis/hip/knee acceleration, with approach speed affecting foot and ball speed. Movement now accelerates at 7.5 m/s², brakes at 8.5 m/s², and reduces sideways velocity at 6.5–8.5 m/s²; sharp turns use a support-step plant and re-acceleration instead of a 16–18 m/s² velocity redirect. These findings support frequent physical carry contacts and gait-timed strike contact rather than instantaneous velocity turns or a stationary shot reset. Sources: [Zhang et al. 2022](https://www.frontiersin.org/journals/physiology/articles/10.3389/fphys.2022.1027811/full), [the touch-and-go dribbling model](https://www.sciencedirect.com/science/article/pii/S0960077920305828), [Ishii et al. 2012](https://pubmed.ncbi.nlm.nih.gov/21908898/), and [Augustus et al. 2024](https://doi.org/10.1016/j.jbiomech.2023.111920). These studies inform control constraints; they do not validate visual animation or certify professional-level feel. Owner playtesting remains open.

The visual follow-up adds a speed-limited, angularly accelerated body turn, so the torso follows front-to-back travel changes across several planted steps. The turn regression checks that no single 60 Hz frame rotates the athlete by more than 0.13 radians; support-foot lock, trunk counter-lean, deeper plant compression, and opposing arm swing carry the turn through the body. These presentation cues remain a lightweight procedural proxy, not a motion-captured animation set.
