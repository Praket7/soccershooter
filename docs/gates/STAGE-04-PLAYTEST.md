# Stage 04 Owner Playtest — Ball Lab

## Purpose

This is the final human-feel check for Stage 04. Automated correctness is already enforced by the golden trajectory suite, deterministic stress/fuzzing, browser E2E, and the canonical simulation trace. This playtest answers the remaining subjective exit criterion from the Stage 04 plan:

> **Ball Lab alone must feel satisfying to use.**

Do not evaluate Stage 05 mechanics here. The player does not yet dribble, pass, shoot, trap, or tackle the ball. `Launch` is a Stage 04 instrumentation control, not the final gameplay kick input.

## Setup

Run the Stage 04 branch locally and open the URL printed by Vite, normally `http://127.0.0.1:4173`.

Keep **Trajectory + predictor** enabled for the first pass. Use normal speed first, then repeat selected launches at `0.5×` or `0.25×`.

## Required checks

### 1. Straight 20m — preset 2

Press `2`, then `L`.

Expected:
- the ball stays essentially in one vertical plane;
- no unexplained lateral wobble appears;
- flight decelerates naturally rather than moving like a vacuum projectile;
- bounce and roll settle rather than gaining energy.

### 2. Curl 20m — preset 3

Press `3`, then `L`.

Expected:
- curve develops smoothly rather than snapping sideways;
- bend direction is consistent and readable;
- the predictor communicates the same family of curve as the live flight;
- curve feels intentional enough that a future player could learn it.

### 3. Power 25m — preset 4

Press `4`, then `L`.

Expected:
- the strike feels materially faster than the straight/curl reference;
- no high-speed jitter, tunneling, or numerical explosion appears;
- the trajectory remains readable at full speed.

### 4. Loft and Chip — presets 5 and 6

Launch both.

Expected:
- they are visually and physically distinct;
- backspin produces believable carry/float;
- the chip has a higher, softer flight than the lofted reference;
- landing, bounce, and roll remain stable.

### 5. Knuckle — preset 7

Press `7`, then `L`. Reset and launch the same preset several times without changing the seed.

Expected:
- every launch with the same seed repeats the same path;
- the path has bounded low-spin movement rather than random frame-to-frame noise;
- the deviation is noticeable but not chaotic or impossible to read.

Then change **Knuckle seed** and relaunch.

Expected:
- the pattern changes reproducibly with the seed;
- it still stays bounded and physically plausible.

### 6. Post rebound — preset 8

Press `8`, then `L`. Repeat at `0.25×` slow motion.

Expected:
- the frame impact is crisp;
- the ball does not pass through the post/crossbar;
- rebound never accelerates the ball beyond its incoming energy;
- no sticking, buzzing, or repeated explosive contacts occur.

### 7. Ball Lab controls

Try changing:
- **Launch speed**
- **Elevation**
- **Aim offset**
- **Spin rate**
- **Spin axis**
- **Coefficient profile**
- **Slow motion**
- **Knuckle seed**
- **Trajectory + predictor**

Expected:
- controls are clear and responsive;
- the predictor updates when launch parameters change;
- `0` resets the ball;
- `E` exports a CSV trace;
- presets `1` through `8` are easy to compare.

### 8. Stage 03 regression

Move the player around while Ball Lab is present.

Expected:
- WASD movement, sprint, camera, zoom, action hooks, trace/replay, and player reset still behave as accepted in Stage 03;
- Ball Lab does not steal movement input except while directly editing one of its form controls.

## Owner result

After the checks, record:

- **Ball Lab satisfaction:** `PASS` or `FAIL`
- **Overall feel:** `1–10`
- **Curve readability:** `1–10`
- **Bounce/roll credibility:** `1–10`
- **Knuckle learnability:** `1–10`
- **Post/crossbar rebound quality:** `1–10`
- **Any concrete issue:** what you launched, what you expected, and what happened

Stage 04 should be marked fully complete only after the owner says the Ball Lab itself is satisfying. No score or owner acceptance should be invented from automated evidence.
