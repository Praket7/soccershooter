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

## Owner gate status at the time of this entry

At the time of this entry, the prescribed Task 3 micro-playtest and final 12-step Stage 05R scorecard had no recorded owner result. The later owner decision is recorded under “Owner approval — 2026-10-20” below.

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

The plan's pass/shot transition calibration and browser rendered-response distribution now have reproducible instrumentation and recorded evidence. The final-contact branch fix is covered by deterministic 90- and 120-degree jog-cut regressions, a live 90-degree cut E2E, an assertion that a full reversal stays committed on the final contact beat, and the full 16-scenario calibration. At the time of this gate snapshot, Stage 05R remained blocked on owner approval; that was resolved by the owner decision recorded at the end of this document. Automated evidence does not replace that approval.

## Owner recording follow-up — 2026-10-20

The owner rejected the current feel again after testing ordinary forward/back, left/right, and circle movement. Inspection of the 2026-10-20 recording showed the practice HUD advertising a `SPRINT KNOCK-ON` target of 32 km/h. Root cause: `stepPlannedDribble` executed a fixed planned velocity and bypassed the existing `buildControlTouch` feedback, so contact impulses did not recenter an off-line ball. Sprint cadence was also 21–27 ticks (0.35–0.45 s), allowing a circle to outrun the next planned foot contact.

Repair in the current working tree:
- actual planned contacts now use the bounded control-envelope command against the live ball position and speed, while preserving the plan's committed direction;
- normal and sprint target speeds now match the carrier, sprint target distance is `0.50–0.55 m`, and normal target distance is `0.36 m`;
- moving carry cadence is 8–11 ticks (0.13–0.18 s), so the ball gets corrected through direction changes before leaving legal reach;
- practice copy now describes short sprint carry touches rather than knock-ons.

The new deterministic input stress matrix includes forward/reverse, lateral, slalom, rapid jog zigzag, sprint cut/reversal, and two continuous circles. After the movement-force calibration, current maxima are 0.96 m for jog reversal, 0.76 m for sprint circle, and 0.68 m for straight sprint; all nine scenarios report zero loose-ball ticks and zero ticks beyond 1 m. These are engineering regressions, not owner feel approval. The later owner approval is recorded below; no numeric feel score is claimed.

## Running-shot and movement research follow-up — 2026-10-20

The next owner report identified that shot preparation slowed the ball below 4.85 m/s even when its carrier was sprinting; dribble control was then suspended for the short gait-timed strike window. Shot-preparation touches now preserve predicted carrier pace (bounded to the existing 9.35 m/s carry limit), so a runner does not leave the ball behind before a legal strike. This remains a real bounded foot impulse; no ball attachment or teleport was added. A sprint regression asserts an 8.1 m/s runner receives an approximately pace-matched setup touch.

The movement model follows three measured principles: football change-of-direction performance relates to both short sprint and braking capacity; a proposed dribble model alternates physical touches and locomotion to intercept the next ball position; and instep kicking uses a running approach, support-foot placement, and sequential pelvis/hip/knee acceleration, with approach speed affecting foot and ball speed. Movement now accelerates at 7.5 m/s², brakes at 8.5 m/s², and reduces sideways velocity at 6.5–8.5 m/s²; sharp turns use a support-step plant and re-acceleration instead of a 16–18 m/s² velocity redirect. These findings support frequent physical carry contacts and gait-timed strike contact rather than instantaneous velocity turns or a stationary shot reset. Sources: [Zhang et al. 2022](https://www.frontiersin.org/journals/physiology/articles/10.3389/fphys.2022.1027811/full), [the touch-and-go dribbling model](https://www.sciencedirect.com/science/article/pii/S0960077920305828), [Ishii et al. 2012](https://pubmed.ncbi.nlm.nih.gov/21908898/), and [Augustus et al. 2024](https://doi.org/10.1016/j.jbiomech.2023.111920). These studies inform control constraints; they do not validate visual animation or certify professional-level feel. Owner playtesting remains open.

The visual follow-up adds a speed-limited, angularly accelerated body turn, so the torso follows front-to-back travel changes across several planted steps. The turn regression checks that no single 60 Hz frame rotates the athlete by more than 0.13 radians; support-foot lock, trunk counter-lean, deeper plant compression, and opposing arm swing carry the turn through the body. These presentation cues remain a lightweight procedural proxy, not a motion-captured animation set. At the time of this follow-up, owner playtesting remained open; see the later owner approval below.

## Owner approval — 2026-10-20

The owner explicitly approved Stage 05 as complete and good in the task conversation on 2026-10-20. This closes the outstanding owner-feel/sequence approval for continuing to Stage 06. The approval is qualitative; no numeric feel score is claimed. It does not change or replace the automated evidence recorded above.

## Owner-approved movement realism pass — 2026-10-20

The owner approved a follow-up focused on making acceleration, braking, sprinting, and cuts read more like one coordinated athlete while preserving the already approved ball and skill behavior. The simulation now records horizontal acceleration from the completed movement tick and derives bounded, damped trunk posture from that realized force. The procedural proxy adds opposite pelvis/torso rotation through turns, lower-body counter-tilt, force-aware arm balance, and visible swing-knee recovery. Presentation remains read-only; simulation controls movement and contact plans still own foot timing and legality. This remains a procedural proxy, not motion-captured animation.

Evidence from this follow-up:
- TDD regressions were observed failing before implementation for missing acceleration/turn counter-rotation/knee recovery and passing after their changes.
- Focused simulation and presentation regressions: 7 files, 45 tests passed, including movement envelopes, planned contacts, step-over/Elastico paths, and turn/carry geometry.
- `pnpm run typecheck` — PASS.
- `pnpm run build` — PASS (server and production web build; the existing large-chunk advisory remains).
- `pnpm lint` — PASS.
- `pnpm test` — 100 files / 430 tests: 426 passed, 4 failed. Failures: `turnCarry.integration.test.ts` reaches 0.7266 m behind distance at tick 81 (threshold 0.28); two pre-existing `dribble-input-stress.test.ts` retention bounds fail at 1.3037 m vs 1 m and 0.3327 m vs 0.33 m; `progression.test.ts` adversarial seed sweep hit its 5 s timeout during the parallel full-suite run. The new acceleration signal is used only by posture and the proxy; no ball/planner code consumes it, so these ball-retention failures are outside this presentation change and remain visible as follow-up work. The timeout was not re-run independently.
- Local Safari preview at `127.0.0.1:4174` loaded the practice scene and accepted movement input; the HUD changed to `PLANNED TOUCH · right instep · gait-timed`. Brief scripted taps did not hold input long enough to verify sustained sprint/cut animation visually, so this is a smoke check, not a completed owner-feel/live-motion qualification.

The existing checkout was already dirty on `repair/movement-control-rebuild-verified`; no pre-existing changes were reset or stashed. This follow-up has not been committed or pushed. Fresh review found and helped correct a forward-lean sign inversion: positive forward-acceleration cue had been rendered as a backward torso tilt. A pose regression was observed failing before correction and passes after the axis mapping was fixed. No other clear in-scope blocker was reported.

## Football Practice tight-carry follow-up — 2026-10-20

The owner asked for a tighter ball pocket, more natural movement with less foot glide, and a more game-like response. The practice/reset ball now starts 0.50 m in front of the player (down from 0.68 m). Jogging dribble contacts use a shorter gait-derived cadence during direction changes, including while the carrier is still accelerating or slowing below jogging pace; sprint and precision cadence remain on their existing tuning. The presentation stance-foot lock now releases strain in at most 0.045 m per 60 Hz update instead of 0.12 m, and begins releasing at 0.36 m stretch instead of 0.48 m.

Measured evidence:
- Tight-circle jog stress replay: max player-ball separation 0.7888 m, max behind-body distance 0.0551 m, 57 contacts, zero loose-ball ticks; the previous recorded values were 0.8225 m, 0.0165 m, and 48 contacts. The new regression bounds separation below 0.80 m.
- Tight-circle sprint stress replay remains 0.7941 m max separation, 0.1572 m max behind-body distance, and zero loose-ball ticks.

## Character continuity and close-control follow-up — 2026-10-20

The owner reported that the practice athlete looked ghostlike and asked for a tighter, more realistic dribble. Inspection found limb capsules were shorter than one unit, while the pose code scaled them as full-length bones; this multiplied their length error and left visible gaps at the joints. Limb segment geometry is now normalized before pose scaling, the jersey uses a smooth tapered torso instead of a pointed capsule hem, and the upper arms use the kit material as short sleeves. The procedural player is still a proxy; a skinned production character is a separate planned Stage 12 asset gate.

Normal carry now uses a shorter correction horizon, while sprint touch distance is reduced from 0.50 m to 0.44 m (plus the existing speed allowance). Deterministic tight-circle stress replay now measures 0.7138 m maximum separation while jogging and 0.6802 m while sprinting, with 57 contacts and zero loose-ball ticks in each case. Continuous circles measure 0.6801 m jogging and 0.6851 m sprinting, also with zero loose-ball ticks.

Verification: character/dribble focused regressions pass (46 tests); WebKit practice E2E passes (13/13), including multi-second carry, sprint carry, continuous circles, and live shot/pass transitions; the WebKit athlete-contact probe passes (1/1); typecheck, lint, and `git diff --check` pass. A local WebKit screenshot was inspected at `/tmp/soccershooter-practice-after.png`.
- Proxy tight-turn regression bounds support-foot movement below 0.08 m/update; pre-change value was 0.12 m.
- Football simulation tests: 29 files / 118 tests passed. Football Practice WebKit E2E: 13/13 passed. Typecheck, lint, and `git diff --check` passed.

The WebKit E2E is automated browser-engine evidence, not a claim that Safari was opened natively or that the owner has accepted the subjective feel of this follow-up.

## Follow-up after owner reported leg/body glitches — 2026-10-20

The owner reported apparent changing leg length, glitching during movement, and unreliable carry touches. Two presentation defects were found and repaired: the torso/pelvis bobbed and leaned while the leg roots stayed fixed relative to the actor, producing a visible hip gap; routine carry corrections could also reverse the ball's velocity against a forward touch lane. Leg roots now follow the animated pelvis transform, keeping both joints continuous through plants. The carry safeguard prevents a routine non-turn correction from reversing a grounded ball against its committed lane; sharp effort-turns retain their existing redirection behavior.

Evidence for this follow-up:
- New hip-to-thigh continuity regression failed before the repair with a 0.455 m gap; it passes after the hip anchor follows the pelvis.
- Presentation, turn/carry, pressure-control, and contact-envelope focused suite: 5 files / 35 tests passed.
- WebKit practice and athlete-proxy E2E: 14/14 passed, including jogging/sprinting continuous circles, carry, and shot/pass transitions.
- `pnpm dribble:stress`: all scenarios report zero loose-ball ticks; max player/ball separation is 0.933 m for the lateral transition and 0.9003 m for sprint-to-cut; tight circles remain 0.7138 m jog / 0.6802 m sprint.
- `pnpm typecheck`, `pnpm lint`, and `pnpm run build:web` pass. The production bundle retains the existing >500 kB advisory.
- Full Vitest suite (`--maxWorkers=4`): 479 passed / 2 failed in `packages/progression/src/progression.test.ts` (distinct playstyle signatures and minimum physical-contact count). The Stage 06 physical-scrimmage suite passes (18/18), and the worker cap keeps the scheduler-sensitive tactical tournament timing sample green. The progression failures are outside this movement change and remain visible, so this follow-up does not claim the entire repository suite is green.

This remains a procedural Stage 05 athlete. The user has not accepted this new pass. The planned skinned character and animation bank remain Stage 12/13 work; procedural proxy improvements cannot claim motion-captured or production-human realism.

## Elastico recovery correction — 2026-10-20

The owner reported the athlete lifting and performing an extra micro-move after Elastico. The live cause was that the Step-over exit-lane assist was also applied to Elastico, injecting a movement vector after contact even when the player held no movement input. The procedural proxy added a small upward trunk bob and arm sweep during the same recovery window. The forced exit assist is now limited to Step-over; Elastico keeps the owner's movement intent, and its recovery has no separate upward or arm-sweep beat. Step-over exit behavior remains active.

Evidence:
- The new WebKit regression failed before the fix with 0.0753 m of unrequested travel in an idle Elastico and passed with the 0.01 m bound.
- The proxy regression failed before the fix at a 0.02 m recovery lift and passes with the trunk and arm lift bounded to 0.001 m.
- Step-over live regression confirms its committed exit step remains intact.
- WebKit `e2e/football-practice.spec.ts`: 15/15 passed. Focused proxy, practice, and control tests: 37/37 passed. `pnpm typecheck`, `pnpm lint`, and `git diff --check` pass.
- Player root height remained within the live regression's 0.03 m rise limit during the idle Elastico replay.

This is a targeted fix for the report. It does not certify the procedural proxy as motion-captured or claim a full repository test pass.
