# SoccerShooter Quality Bar

**Status:** Binding measurement contract from Stage 01 onward  
**Applies to:** every numbered stage, every gate report, and every public-alpha candidate  
**Source of truth precedence:** `DESIGN.md` → architecture spec → current stage plan → this measurement contract

## 1. Why this document exists

SoccerShooter may not use words such as **premium**, **fun**, **fair**, **fast**, or **finished** as acceptance evidence by themselves. Each word below has an operational definition and a measurement path.

A stage passes only when its measurable checks pass and its known defects are written down. A screenshot, successful local launch, or subjective statement such as “feels good” cannot substitute for required instrumentation.

## 2. Operational definitions

### Premium

A build is premium when control response, ball/contact behavior, presentation, and readability are coherent enough that representative testers rate the relevant experience highly **and** the build stays within technical budgets.

Minimum alpha evidence:
- median movement responsiveness >= 8.0/10
- median shooting/contact satisfaction >= 8.0/10
- median bot teammate usefulness >= 7.5/10
- stable target >= 60 FPS on the declared reference desktop
- 1% low >= 50 FPS on the same representative scene
- no recurring main-thread task > 50 ms during normal play after loading
- visible foot-to-ball contact within ±1 rendered frame of authoritative local contact for validated contact clips
- ball and primary interaction remain readable with optional VFX reduced/off

### Fun

Fun is measured through voluntary behavior plus targeted ratings, not by feature count.

Minimum public-alpha evidence:
- >= 70% of first-match testers voluntarily start another match
- shooting/contact median >= 8.0/10
- at least one clip-worthy moment is reported by multiple representative testers during milestone sessions
- campaign has a real, beatable ending rather than an artificial progression wall

A forced tutorial continuation or automatic rematch does not count as voluntary rematch behavior.

### Fair

Fair means outcomes follow public rules and player/bot decisions rather than hidden physical advantages.

Required evidence:
- PvP never uses adaptive difficulty
- bot difficulty never changes hidden top speed, stamina capacity, collider size, ball physics, or other physical authority
- competitive results are authoritative rather than accepted as client truth
- no known technique is both dominant and effectively uncounterable in the current automated tournament/review set
- no duplicate authoritative goal, touch, technique activation, or score event under supported network fault profiles

### Fast

Fast means response and frame pacing preserve control quality.

Budgets:
- direct camera response <= 1 rendered frame at 60 FPS
- movement acknowledgement <= 1 rendered frame at 60 FPS
- pass/shot acknowledgement <= 1 rendered frame at 60 FPS
- target 60 FPS reference desktop
- 1% low >= 50 FPS reference desktop
- recurring main-thread long task threshold: > 50 ms is a defect
- initial playable transferred payload target < 20 MB
- first premium arena streamed payload target < 45 MB
- tactical bot decision cost target < 1 ms average per team on reference desktop

### Finished

A stage is finished only when:
1. every required file/interface for the stage exists;
2. every named automated check has fresh passing evidence;
3. every required benchmark/playtest has evidence or is explicitly not applicable to that stage;
4. the stage gate report names the exact commit/run and records all known defects;
5. no unresolved placeholder markers remain in binding stage artifacts;
6. the next stage has not been implemented early except for a minimal interface explicitly ruled necessary for testing.

## 3. Measurement integrity rules

Metrics must be hard to game.

- Report median and distribution-sensitive values where appropriate, not only best-case peaks.
- FPS reports include 1% low derived from frame-time distribution.
- Warm-up time is separated from the measured interval.
- A performance run records build commit, browser/runtime, viewport, quality preset, hardware profile, scene/scenario, duration, and sample count.
- Playtest score medians include all valid testers/runs in the declared cohort. Do not discard low scores because they are inconvenient.
- Network tests record injected RTT, jitter, loss, seed, and run count.
- Determinism tests record seed, input trace, tick count, and resulting state hash.
- Balance tournaments record build/sim version, ruleset, seeds, bot identities/configurations, and exploit flags.
- Visual gates pair target references with current in-engine evidence; images alone never satisfy a performance or correctness gate.

## 4. Known-defect rule

A known defect may be deferred only when **all** are true:
1. it is outside the current stage's acceptance criteria;
2. it does not invalidate a measurement used to pass the current gate;
3. it does not create a security, privacy, data-loss, determinism, public-content, or authoritative-score risk;
4. it is listed by name in the current gate report with impact and owning future stage/issue;
5. deferral does not silently lower a published threshold.

Any defect violating those conditions blocks the gate.

## 5. Gate report process and naming

Canonical gate IDs:
`01, 02, 03, 04, 05, 06, 07, 08, 09, 10, 11, 12, 13, 14, 15, 16, 17, 17A, 18, 19, 20`.

Canonical path:
`docs/gates/STAGE-<ID>-GATE.md`.

Every gate report uses `docs/templates/STAGE_GATE_TEMPLATE.md` and records:
- stage and commit SHA
- date and reviewer
- exact automated check command and actual result
- performance measurements where applicable
- playtest measurements where applicable
- known defects
- deferred items with owner
- final `PASS` or `FAIL`

A future stage may start only from a `PASS` gate for every dependency in the master-plan dependency graph.

## 6. Physics golden-test format

A physics golden case is versioned data containing:
- `caseId`
- `simVersion`
- deterministic `seed`
- fixed tick rate and substep configuration
- initial player/ball state
- ordered input/contact events with tick numbers
- environmental coefficients used by the case
- expected sampled state at declared ticks
- expected final deterministic hash
- numeric tolerance only for values explicitly allowed to vary by the test contract
- reason for the test and defect/regression link when applicable

Golden data is updated only when the governing behavior intentionally changes. An update must explain why the old expectation became invalid.

## 7. Cross-stage measurable acceptance matrix

This matrix does not replace the detailed stage plan. It guarantees every stage has an externally checkable proof target.

| Stage | Primary measurable acceptance evidence |
|---|---|
| 01 | Contract suite passes; telemetry rejects PII/unexpected fields; provenance blocks unlicensed/private shipping; all gate IDs and measurement methods are defined. |
| 02 | Clean frozen-lockfile CI passes; 100 repeated 10,000-tick runs produce identical hashes; Node/browser traces match; 60/120/144 Hz presentation cadence leaves final sim hash unchanged; fictional production build succeeds; forced private import is rejected. |
| 03 | Input→sim→render instrumentation meets <=1-frame acknowledgement targets for direct movement/camera on reference setup; movement responsiveness median >=8/10 in the declared no-ball playtest; camera-comfort regressions are recorded. |
| 04 | Versioned ball golden cases pass for gravity, bounce, roll, drag, spin/Magnus and bounded knuckle behavior; repeated identical seeds match hashes; no NaN/energy-explosion case survives the stress suite. |
| 05 | Receive/dribble/pass/shoot/defend scenarios pass deterministic regression tests; local visible contact is within ±1 rendered frame for validated clips; shooting/contact satisfaction median >=8/10; identified dominant exploits become regression cases. |
| 06 | Tactical scenario suite proves support, width/depth, pressure, cover and recovery behavior; safety/invariant scenarios pass 100%; teammate usefulness median >=7.5/10 in milestone playtests. |
| 07 | Difficulty profiles show zero changes to protected physical constants; seeded evaluation demonstrates intended cognition/precision difficulty ordering without hidden physics advantages; adaptive logic is disabled in PvP tests. |
| 08 | Every shipped technique declares eligibility, cost/risk, telegraph, failure behavior and counterplay; automated tournament data shows no known uncounterable dominant technique; technique activation stays deterministic. |
| 09 | Automated progression validation reaches every act and verifies a finite campaign ending; Legacy progression can continue without a hard content/progression cap; save/replay seeds reproduce challenge state. |
| 10 | Public-content validator contains only original fictional identities; four initial teams validate against schema; production/private-content negative tests pass; no `REFERENCE_PRIVATE` material enters deployable manifests. |
| 11 | Exactly 192 locked references exist with required metadata; exactly 48 meet golden-target status; locked/golden rubric thresholds from the image plan pass; provenance is complete. |
| 12 | One representative athlete passes scale/topology/LOD/UV/deformation/material/export/runtime checks; triangle targets are measured; representative in-engine performance remains within the current budget. |
| 13 | Animation/contact validator confirms required contact metadata; validated local ball contacts stay within ±1 rendered frame; planted-action foot sliding and invalid aerial eligibility cases are captured by regression checks. |
| 14 | The Foundry exposes >=4 persistent orientation landmarks; arena asset/payload/draw-call/texture budgets are measured; representative gameplay meets 60 FPS / 50 FPS 1% low targets on reference desktop. |
| 15 | Live-play effect tiers obey readability limits; performance gate remains >=60 FPS target / >=50 FPS 1% low; essential actions have distinguishable audio feedback; effects-off/reduced modes preserve ball readability. |
| 16 | >=80% of blind onboarding testers finish without external help; required keyboard/mouse/gamepad/accessibility states pass scripted UI checks; UI remains usable at declared desktop sizes and error/offline states. |
| 17 | Authoritative 3v3 tests pass local and 50/100/150 ms RTT plus jitter/loss profiles; no duplicate authoritative goals/touches/activations; prediction/reconciliation metrics are exposed; reconnect and bot-fill scenarios pass. |
| 17A | Guest play/save works without account; auth tests prove no plaintext credential/client secret storage; guest linking is idempotent; competitive leaderboard writes fail from untrusted client paths and pass through authoritative verified-result path. |
| 18 | Deterministic replay reproduces authoritative final hash; highlight extraction includes configured 8–15 s window/buildup rules; 16:9 and 9:16 framing tests pass for representative clips. |
| 19 | Full regression, balance, security, content, network, replay and performance suites pass; no critical unresolved defect remains; performance budgets pass on declared profiles. |
| 20 | Public-alpha cohort meets >=70% voluntary rematch and the declared feel/onboarding targets; return/engagement evidence justifies any proposed content expansion; no critical authoritative exploit is open. |

## 8. Global payload and performance budgets

These are default ceilings/targets until a later gate explicitly tightens them with evidence:

| Metric | Target / ceiling |
|---|---:|
| Reference live-play FPS | >= 60 target |
| Reference 1% low | >= 50 FPS |
| Recurring normal-play main-thread task | <= 50 ms |
| Initial playable transferred payload | < 20 MB |
| First full premium arena streamed payload | < 45 MB |
| Average tactical bot decision cost | < 1 ms/team |
| Direct camera acknowledgement | <= 1 rendered frame @60 FPS |
| Direct movement acknowledgement | <= 1 rendered frame @60 FPS |
| Local foot/ball visible contact | ±1 rendered frame of authority |

## 9. Gate precedence

If a later stage plan and this document disagree, follow the binding design/source-of-truth precedence and record a ruling. Never silently choose the easier threshold.
