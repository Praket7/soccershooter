# Stage 05 Owner Playtest — Core Football Feel Gate

## Purpose

This is the only remaining Stage 05 acceptance step after the engineering/simulation gate.

The goal is not to hunt for every later-stage polish issue. The goal is to answer whether the physical interaction model is already fun, readable, controllable, and free of obvious dominant exploits.

## Setup

From the repository root:

```bash
node --version
# use Node 24

npm install --global pnpm@12.9.1
pnpm install --frozen-lockfile
pnpm --filter @soccershooter/web dev
```

Open `http://127.0.0.1:4173`.

Start in **Football Practice** mode.

## Controls relevant to Stage 05

### Movement

- `WASD` / arrows: move
- mouse: camera / aim
- wheel / trackpad: camera zoom
- `Shift`: sprint

### Ball interaction

- move into the ball: physical first touch / dribble touch
- `RMB`: precision control modifier
- `E`: pass
- `Q + E`: driven pass
- `RMB + E`: through/lead pass
- `Q + RMB + E`: lofted pass
- hold `LMB`: charge shot
- release `LMB`: strike
- `1`: normal
- `2`: driven
- `3`: finesse
- `4`: chip
- `5`: knuckle
- `6`: outside-foot
- `C` / `B` / Ctrl: standing challenge
- `Shift + C` / `Shift + B` / Shift + Ctrl: committed tackle
- `Space`: jump/header hook when the ball is in a legal aerial window
- `G`: reset practice ball in front of player

The action debug HUD should explain successful and rejected contacts.

## 10-minute required run

Do this as one continuous session rather than isolated button checks.

### Minutes 0–2 — First touch and dribble

Try:

1. walk into the ball slowly;
2. approach at a moderate run;
3. sprint into the ball;
4. use precision control with RMB;
5. stop moving while the ball is already stationary near you;
6. receive a moving ball while mostly stationary.

Expected:

- controlled arrival should feel easier to keep close;
- sprinting should push the ball farther ahead;
- precision should shorten the touch;
- the ball must never snap to the player;
- standing beside an idle ball should not repeatedly nudge it;
- an actually incoming ball should still be controllable.

### Minutes 2–4 — Passing

Try all four pass families while moving and while poorly aligned.

Expected:

- ground, driven, lofted, and through passes should look and feel distinct;
- the moving gold receiver should make through/lead behavior obvious;
- E should create one pass per press, not repeat while held;
- intentionally turning away from the receiver should prevent obviously impossible assisted passes.

### Minutes 4–7 — Shooting mastery

Take repeated shots with all six styles.

Required human check:

- intentionally produce a mostly straight shot;
- intentionally produce a curved finesse shot;
- intentionally produce a chip with visibly greater apex;
- compare driven vs normal power/trajectory;
- compare outside-foot directionality;
- try knuckle repeatedly and verify it is unstable-looking but not random between identical deterministic conditions.

Expected:

- styles should be distinguishable without needing the HUD label;
- charge should matter;
- poor body setup should hurt the strike rather than secretly auto-correct it;
- normal should not inherit knuckle wander after a prior knuckle attempt.

### Minutes 7–9 — Defending and exploit attempts

Try to break the design intentionally.

1. spam standing challenge;
2. spam committed tackle while sprinting;
3. time a challenge near the moving ball;
4. hold pass input instead of tapping it;
5. spin/circle around the ball while trying to maintain effortless control;
6. sprint-only dribble without slowing for touches.

Expected:

- committed spam should create visible recovery cost;
- timed challenges should feel better than blind commitment;
- pass holding should not machine-gun contacts;
- camera/body circling should not act like magnetic possession;
- sprint-only play should be useful for space but worse for close control.

### Minutes 9–10 — Free play

Ignore the checklist and simply dribble, pass, shoot, tackle, and score.

The key question is whether you naturally want to keep doing another attempt.

## Required ratings

Score each from 1–10.

| Dimension | Score |
| --- | ---: |
| movement + ball overall satisfaction |  |
| first-touch control |  |
| dribbling skill expression |  |
| passing readability |  |
| shooting variety / mastery |  |
| defending timing |  |
| physicality / lack of magnetism |  |
| desire to keep playing another attempt |  |

### Stage 05 subjective acceptance

The stage plan requires:

- the 10-minute loop remains engaging;
- straight, curve, and chip can be produced intentionally;
- first touch shows skill variance;
- defending timing is readable;
- simple spam strategies do not dominate varied play;
- combined movement + ball satisfaction median is at least `8/10`.

For a one-owner playtest, record your own scores now. Broader median validation can be repeated later with multiple testers, but Stage 05 should not merge if your own combined movement + ball score is below 8 or any core interaction feels fundamentally wrong.

## Bug capture format

For every problem, record:

- action attempted;
- expected result;
- actual result;
- whether it reproduces every time or intermittently;
- approximate player/ball position if relevant;
- shot/pass style if relevant;
- screenshot/video if visual;
- exported diagnostics / HUD text if available.

## Merge rule

A successful automated CI run does not replace this playtest.

After owner acceptance, update `docs/gates/STAGE-05-GATE.md` from `ENGINEERING PASS — OWNER FUN GATE PENDING` to final PASS, rerun CI on that exact documentation-inclusive SHA, then merge only after an explicit owner merge instruction.
