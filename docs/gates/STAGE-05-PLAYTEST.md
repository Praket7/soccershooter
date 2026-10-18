# Stage 05 Owner Playtest — Core Football Feel Protocol

## Status

Stage 05 has received explicit owner authorization to complete and merge after the final engineering/research review. This document is retained as a **regression and future multi-tester playtest protocol**, not as a claim that an unreported numeric score exists.

The original plan requested a combined movement + ball satisfaction median of at least `8/10`. A final numeric owner score was not supplied, so none is fabricated in the Stage 05 gate. The earlier owner test did provide actionable qualitative feedback, and every reported defect from that test was repaired before final review.

## Setup

From the repository root:

```bash
node --version
# use Node 24

npm install --global pnpm@12.9.1
pnpm install --frozen-lockfile
pnpm --filter @soccershooter/web dev
```

Open `http://127.0.0.1:4173` and use **Football Practice** mode.

## Controls

### Movement

- `WASD` / arrows: move
- mouse: camera / aim
- wheel / trackpad: camera zoom
- `Shift`: sprint

### Ball interaction

- move into ball: physical first touch / dribble
- `RMB`: precision control
- release movement + hold `RMB`: physical trap/stop when the ball is controllable
- `E`: ground pass
- `Q + E`: driven pass
- `RMB + E`: through/lead pass
- `Q + RMB + E`: lofted pass
- hold `LMB`: charge shot and show aim guide
- release `LMB`: strike
- `1`: normal shot
- `2`: driven
- `3`: finesse
- `4`: chip
- `5`: knuckle
- `6`: outside-foot
- `C` / `B` / Ctrl: standing challenge
- `Shift + C` / `Shift + B` / Shift + Ctrl: committed tackle
- `Space`: jump/header hook in a legal aerial window
- `G`: reset practice ball in front of the player

## Ten-minute regression run

### 0–2 minutes — first touch / dribble

Check slow control, normal run, sprint touches, precision touches, 90° cut, 180° reversal, sustained 5–6 second sprint dribble, and the no-movement `RMB` trap.

Expected:
- ball never snaps/welds to the player;
- sharp cuts brake and redirect rather than preserving the old ball direction;
- sustained sprint remains recoverable without becoming magnetic;
- trap kills useful ball momentum physically;
- idle player beside idle ball does not repeatedly nudge it.

### 2–4 minutes — passing

Use ground, driven, through, and lofted passes while moving and while intentionally poorly aligned.

Expected:
- four families remain mechanically/readably distinct;
- through pass leads the moving receiver;
- one pass occurs per press;
- assistance helps within a sensible cone but does not create impossible behind-body actions.

### 4–7 minutes — shooting

Try all six shot styles. Produce a mostly straight normal strike, curved finesse, high chip, driven shot, outside-foot bend, and repeatable seeded knuckle behavior.

Expected:
- live mouse/right-stick aim moves during charge;
- visible aim guide follows the requested direction;
- visible body orientation and contact legality agree;
- a tiny focus click does not weak-shot;
- normal shot does not inherit knuckle state.

### 7–9 minutes — defending / exploit attempts

Spam standing challenge, spam committed tackle, then use timed challenges. Hold pass input, circle the ball, and attempt sprint-only dribbling.

Expected:
- committed spam incurs recovery cost;
- timed defense is better than blind commitment;
- pass holding does not machine-gun contacts;
- circling is not magnetic possession;
- sprint-only remains useful in space but weaker for close control.

### 9–10 minutes — free play

Dribble, pass, shoot, challenge the greybox keeper, and score naturally. Check near-edge keeper saves and misses for obvious endpoint-timing artifacts.

## Suggested ratings for future testing

| Dimension | Score 1–10 |
| --- | ---: |
| movement + ball overall satisfaction |  |
| first-touch control |  |
| dribbling skill expression |  |
| passing readability |  |
| shooting variety / mastery |  |
| defending timing |  |
| physicality / lack of magnetism |  |
| desire to keep playing another attempt |  |

For multi-tester validation, preserve the original target of median movement + ball satisfaction `>= 8/10` and record the raw scorecards rather than estimating a result.

## Bug capture

For every issue record action attempted, expected result, actual result, reproducibility, approximate player/ball position, action style, screenshot/video when visual, and diagnostics/HUD text when useful.
