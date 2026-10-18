# Stage 03 Gate Report

**Stage:** 03  
**Commit:** `1209db36267ea0051b4bccf4c51c3a00a3fb90b1`  
**Date:** 2026-10-18  
**Agent / reviewer:** GPT-5.6 Sol, self-review in chat; no independent reviewer runtime exposed  
**Decision:** FAIL — implementation and automated verification are complete, but required reference-hardware and blind human playtest evidence has not yet been collected.

## Stage objective

Make running around an empty greybox field feel excellent before the ball exists, using a deterministic shared player controller, normalized keyboard/gamepad intent, a presentation-only third-person camera, movement diagnostics, trace replay, and a repeatable benchmark course.

This report does **not** convert automated correctness into a subjective feel claim. Stage 03's binding exit gate requires five blind scored runs plus reference-desktop responsiveness evidence.

## Automated checks

Verified workflow: GitHub Actions run `39122239166`, job `117660010750`, Ubuntu 24.04.5, Node 24.21.0, pnpm 12.9.1.

| Check | Command / evidence | Expected | Actual | Pass |
|---|---|---|---|---|
| Frozen workspace install | `pnpm install --frozen-lockfile` | exact lockfile and supply-chain policy valid | 122 lockfile entries verified | PASS |
| Authoritative randomness guard | `pnpm lint` | no ambient `Math.random()` in authoritative source | passed | PASS |
| Private-content guard | `pnpm lint` + negative probe | deployable code cannot import private references | clean source passed; injected forbidden import rejected | PASS |
| Strict TypeScript | `pnpm typecheck` | zero errors | zero errors | PASS |
| Unit / contract suite | `pnpm test` | all Stage 01–03 contracts pass | 8 files, **61/61 tests** | PASS |
| Diagonal speed | movement unit test | radial normalization | passed | PASS |
| Legal acceleration | movement unit test | configured maximum not exceeded | passed | PASS |
| Stamina bounds | movement unit test | never below 0 or above max; exhaustion/recovery valid | passed | PASS |
| Presentation-rate independence | movement unit test | 60/120/144 Hz presentation yields identical movement result | passed | PASS |
| Collision tunneling | movement unit test | legal top speed cannot cross thin wall | passed | PASS |
| Slopes / steps | movement unit test | legal terrain traversed; oversized step blocked | passed | PASS |
| Speed-dependent turning | movement unit test | sprint turn arc broader than low-speed turn | passed | PASS |
| Trace replay | movement unit test | recorded intents replay to identical state | passed | PASS |
| Device normalization | input unit tests | keyboard/gamepad can emit equivalent intent | passed | PASS |
| Gamepad radial deadzone | input unit test | deadzone removes drift while preserving direction | passed | PASS |
| Camera authority separation | camera unit test | camera cannot mutate player state | passed | PASS |
| Direct camera-look path | camera unit test | manual yaw applied in same camera update | passed | PASS |
| Camera obstruction | camera unit tests | spring arm retracts before wall and recovers smoothly | passed | PASS |
| Sprint FOV envelope | camera unit test | boost <= +2.5 degrees | passed | PASS |
| Movement scheduling budget | movement tick contract | controller tick interval <= one 60 Hz frame | **60 Hz / 16.67 ms** | PASS |
| Stage 02 determinism regression | `pnpm determinism:headless` | canonical hash unchanged | tickHz 30, 10,000 ticks, seed 1511506142, hash `d55b2d0b968372a5` | PASS |
| Production build | `pnpm build` | server + FICTIONAL_PUBLIC web build | passed | PASS |
| Server health | CI launch check | `status=ok`, `FICTIONAL_PUBLIC` | passed | PASS |
| Browser runtime | `pnpm test:e2e` | WebGL lab runs, movement works, parity remains | **3/3 Chromium tests** | PASS |
| Browser movement cadence | Playwright | runtime reports 60 Hz player controller | `data-movement-tick-hz=60` | PASS |
| Browser latency instrumentation | Playwright | input→sim and input→render readings emitted | finite non-negative readings after movement input | PASS |

## TDD evidence

Stage 03 was not implemented as a tests-after-code exercise.

- Initial RED commit `d0383a09e9eb490437f12b6088a74e762787d8ee`: movement/input/camera acceptance tests existed before their production modules; workflow run `39121156953` failed on the intentionally missing implementations.
- First complete automated GREEN after integration fixes: commit `bd58ced3571b3d1f1b2f203f697693afdc089d61`, run `39121851453`.
- Responsiveness review found that the initial 30 Hz player-controller cadence could not satisfy a one-frame 60 Hz acknowledgement budget. A new RED contract was committed at `05a54e616d254d6805a7422f56033ff0dfce2189`; run `39122034318` failed because the 60 Hz movement contract did not yet exist.
- The controller runtime was then moved to 60 Hz at `ec4e0d92fa04d4c69277ecf43c533e2c0bc2209c` while preserving the Stage 02 canonical 30 Hz trace.
- Browser-level cadence and latency telemetry were added to regression coverage at `1209db36267ea0051b4bccf4c51c3a00a3fb90b1`; run `39122239166` is the verified implementation run recorded above.

## Implemented Stage 03 systems

### Deterministic athlete controller

`packages/sim/src/player/PlayerState.ts` and `movement.ts` provide:
- kinematic capsule-radius authority model
- aim-relative normalized movement intent
- bounded vector acceleration and stronger braking
- low-speed agility with broader high-speed sprint turning
- sprint stamina drain, exhaustion lockout, recovery, and bounded state
- field bounds and continuous thin-wall collision resolution at legal speed
- ground patches with legal slopes and step-height rules
- jump and tackle request hooks only, with no Stage 05 mechanic implementation
- deterministic movement trace record/replay
- a 60 Hz player-controller tick contract for the Stage 03 browser runtime

### Device-neutral input

`apps/web/src/input/ActionMap.ts` and `GamepadAdapter.ts` provide:
- WASD/arrows and standard-gamepad left-stick movement
- radial magnitude normalization
- analog deadzone remapping
- shared `InputIntent` output
- mouse / right-stick look
- sprint, jump-hook, and tackle-hook mappings
- sensitivity and invert-Y support
- input timestamp capture for responsiveness instrumentation

### Presentation-only third-person camera

`ThirdPersonCamera.ts` provides:
- centered/shoulder follow target
- direct yaw/pitch response
- constrained pitch
- target smoothing without smoothing gameplay aim intent
- swept-volume-style segment-vs-expanded-AABB obstruction testing
- immediate inward arm correction and blended outward recovery
- restrained sprint FOV response
- camera collision telemetry

The camera accepts player state as read-only input. Unit tests prove that camera updates do not alter authoritative player state.

### Greybox movement lab and diagnostics

The browser contains the Stage 03 benchmark course with:
- straight sprint lane
- hard-cut area
- stop test
- slalom cones
- tight corridor
- wall/camera-obstruction test
- legal slope
- step-height test

The movement HUD exposes simulation tick, FPS, speed, acceleration, stamina, locomotion state, position, facing, camera arm/collision correction, input→simulation time, input→visible acknowledgement, fixed-step backlog, and trace status. `R` records/stops a movement trace, `P` replays it, `X` resets, and `F1` toggles the debug HUD.

## Performance measurements

The GitHub-hosted runner is **not** the declared Reference Desktop, so it is invalid evidence for the final response-time or frame-pacing gate. No Mac measurement is fabricated here.

| Metric | Budget | Measured | Environment | Pass |
|---|---:|---:|---|---|
| Player controller scheduling interval | <= 16.67 ms | 16.67 ms by fixed 60 Hz contract | deterministic runtime contract | PASS |
| Direct camera acknowledgement | <= 1 rendered frame at 60 FPS | instrumentation + same-update unit contract exist; reference-Mac distribution not yet captured | GitHub CI is not valid reference hardware | FAIL / evidence required |
| Direct movement input→visible acknowledgement | <= 1 rendered frame at 60 FPS | browser emits input→sim and input→render values; reference-Mac distribution not yet captured | GitHub CI is not valid reference hardware | FAIL / evidence required |
| Reference-desktop live FPS / 1% low | current stage should record representative behavior when measured | not measured on declared machine | user Reference Desktop required | NOT CLAIMED |
| Initial web bundle | global initial playable transfer ceiling <20 MB | main JS 560.02 kB minified, 142.64 kB gzip; CSS 2.49 kB | CI production build | PASS ceiling; warning noted |

## Playtest checks

No blind human sessions were run by the assistant. Automated agents cannot validly stand in for the required subjective testers.

| Scenario | Testers/runs | Acceptance criterion | Result | Pass |
|---|---:|---|---|---|
| Movement responsiveness | 0 / required >=5 | median >= 8/10 | not measured | FAIL |
| Camera comfort | 0 / required >=5 | median >= 8/10 | not measured | FAIL |
| Recurring feel complaints | 0 / required >=5 | no repeated `floaty`, `icy`, or `camera fights me` complaint | not measured | FAIL |
| Slalom learnability | 0 / required >=5 | measurable improvement with practice | not measured | FAIL |

Use `docs/gates/STAGE-03-PLAYTEST.md` for the exact local protocol and evidence table.

## Known defects / limitations

1. **Vite chunk warning:** the first Three.js gameplay shell produces one ~560 kB minified JS chunk (~142.6 kB gzip). It is far below the global <20 MB initial-playable transfer ceiling, but code splitting should be considered as the runtime grows. This does not invalidate Stage 03 behavior.
2. **Reference-hardware evidence absent:** actual Mac input→visible distributions, frame-time statistics, and environment metadata must be captured locally. This is an evidence blocker, not permission to use CI timings as a substitute.
3. **Human feel evidence absent:** five blind scored runs have not occurred. This directly blocks a PASS decision.
4. **Independent reviewer unavailable in this chat environment:** the implementation received a whole-branch self-review against the binding plan and quality bar. A fresh reviewer before merge remains recommended.

No known critical/important automated correctness defect is open at this commit.

## Deferred items

The following are intentionally outside Stage 03 and were not pulled forward:
- ball physics/aerodynamics — Stage 04
- receive/dribble/pass/shoot/defend mechanics — Stage 05
- tactical bots — Stage 06+
- final character art/animation — Stage 11–13
- multiplayer prediction/reconciliation — Stage 17
- auth/cloud saves/competitive leaderboards — Stage 17A

## Gate decision

**FAIL.**

The Stage 03 software scope is implemented and all available automated checks are green, but the binding gate is intentionally not passed. The remaining requirements are empirical: run at least five blind no-ball sessions on the local build, record the required movement/camera scores and slalom learning evidence, and capture valid Reference Desktop responsiveness measurements. If those thresholds pass, update this report with the evidence and change the decision to `PASS` before merging or beginning Stage 04.
