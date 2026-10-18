# Stage 03 Local Playtest and Reference-Desktop Evidence

This document is the required completion protocol for Stage 03. It exists so the gate can be finished without changing criteria after seeing the results.

Do not enter names, email addresses, school, IP addresses, exact location, account IDs, or other identifying information. Use session-only pseudonymous tester codes such as `T01`.

## Build under test

Use the exact Stage 03 branch head documented in `docs/gates/STAGE-03-GATE.md`, or replace it with a newer commit only if the gate report and every run below are updated to the same build.

## Local setup

```bash
git fetch origin
git switch stage/03-movement-camera-input
git pull --ff-only

node --version
npm install --global pnpm@12.9.1
pnpm install --frozen-lockfile

pnpm lint
pnpm typecheck
pnpm test
pnpm determinism:headless
pnpm build

pnpm exec playwright install chromium
pnpm test:e2e

pnpm --filter @soccershooter/web dev
```

Open `http://127.0.0.1:4173` in the browser you will use for the playtest.

## Controls

- WASD or left stick: move
- mouse or right stick: camera
- Shift or L3: sprint
- Space or A: jump request hook only
- C / Ctrl or B: tackle request hook only
- click game viewport: pointer lock
- F1: toggle movement HUD
- R: start/stop movement trace recording
- P: replay the most recently recorded trace
- X: reset athlete to benchmark spawn

## Reference Desktop environment record

Complete this once for the measured machine/session. Do not label the run `reference-desktop` if these facts are missing.

| Field | Value |
|---|---|
| Build commit | |
| macOS version | |
| Apple SoC / CPU model | |
| Logical CPU count | |
| Installed memory, if available | |
| Browser + version | |
| Graphics API / renderer string, if available | |
| Viewport | |
| Device pixel ratio | |
| Graphics preset | Stage 03 greybox |
| Power mode, if known | |
| Measurement date/time | |

## Responsiveness evidence

The movement lab HUD reports the latest input→simulation and input→visible acknowledgement values. The browser regression proves those fields exist, but the actual Stage 03 gate must be measured on the Reference Desktop rather than on GitHub-hosted CI.

Target for direct movement and direct camera acknowledgement: **<= 1 rendered frame at 60 FPS (16.67 ms)** under the binding quality bar.

For a valid local evidence session:

1. Let the scene warm up for at least 10 seconds.
2. Keep the viewport and browser stable for the test.
3. Exercise direct movement inputs and manual camera look repeatedly for at least 60 seconds.
4. Record any visible values that consistently exceed one 60 Hz frame and the scenario in which they occur.
5. Do not discard slow samples because they are inconvenient.
6. If browser DevTools/performance tooling is used for a distribution, record that fact and capture the raw/aggregated result with the environment metadata above.

| Metric | Budget | Result | Pass |
|---|---:|---:|---|
| Direct movement input→visible acknowledgement | <=16.67 ms at 60 FPS | | |
| Direct camera acknowledgement | <=16.67 ms at 60 FPS | | |
| Recurring normal-play main-thread task | <=50 ms | | |
| Average/median FPS during representative greybox run | target >=60 FPS | | |
| 1% low FPS, if measured | target >=50 FPS | | |

If latency sampling is not sufficiently robust for a gate claim, leave the row unpassed and capture a browser performance trace rather than estimating.

## Blind playtest protocol

Run **at least five blind scored runs**. A run is blind when the tester is not told what rating the build “should” receive and is not coached through the course beyond the neutral control list.

Each tester/run should:

1. Spend roughly 30 seconds learning basic walk/jog/turn control.
2. Run the straight sprint lane and release input at the stop marker.
3. Repeat the hard cut at low speed, then at sprint speed.
4. Run the slalom course three times and record each completion time. Do not coach the route between attempts.
5. Navigate the tight corridor without intentionally scraping the walls.
6. Move beside/around the camera wall while rotating the camera and note clipping, jitter, snaps, or the camera “fighting” the tester.
7. Traverse the legal slope and step test.
8. Try both keyboard/mouse and gamepad across the cohort when available. A single tester does not need to use both devices.
9. Give the first 1–10 score for movement responsiveness and camera comfort before discussing improvements.
10. Answer the symptom prompts below.

### Per-run evidence

| Run | Session code | Device | First SoccerShooter session? | Movement 1–10 | Camera 1–10 | Slalom #1 | Slalom #2 | Slalom #3 | Floaty? | Icy? | Camera fights me? | Other concise notes |
|---|---|---|---|---:|---:|---:|---:|---:|---|---|---|---|
| 1 | | | | | | | | | | | | |
| 2 | | | | | | | | | | | | |
| 3 | | | | | | | | | | | | |
| 4 | | | | | | | | | | | | |
| 5 | | | | | | | | | | | | |

Add rows rather than replacing low scores if more than five valid runs are conducted.

## Gate aggregation

Record every valid run in the declared cohort.

| Requirement | Calculation | Required | Actual | Pass |
|---|---|---:|---:|---|
| Valid blind runs | count | >=5 | | |
| Movement responsiveness | median of all valid scores | >=8.0/10 | | |
| Camera comfort | median of all valid scores | >=8.0/10 | | |
| Repeated `floaty` complaint | count / pattern review | no recurring complaint | | |
| Repeated `icy` complaint | count / pattern review | no recurring complaint | | |
| Repeated `camera fights me` complaint | count / pattern review | no recurring complaint | | |
| Slalom learnability | compare attempt 1 against later attempts across cohort | measurable improvement with practice | | |

Do not average away a recurring concrete complaint. If several testers report the same failure mode, treat it as a defect hypothesis, reproduce it with the trace/HUD where possible, fix it, and rerun enough blind sessions on the new build to support the gate.

## When Stage 03 may pass

Only change `docs/gates/STAGE-03-GATE.md` from `FAIL` to `PASS` when all of the following are true on the same build or a clearly documented successor build:

- all automated checks remain green;
- Reference Desktop environment metadata is complete;
- required direct response budgets have valid evidence;
- at least five blind runs are recorded;
- median movement responsiveness is >=8/10;
- median camera comfort is >=8/10;
- no recurring `floaty`, `icy`, or `camera fights me` complaint remains;
- slalom performance demonstrates learnable improvement.

Stage 04 should not begin and Stage 03 should not merge before that PASS decision.
