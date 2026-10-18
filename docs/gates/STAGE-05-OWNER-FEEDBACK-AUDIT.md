# Stage 05 Owner Feedback Audit — Control, Aim, Grounding, Camera

## Status

**ENGINEERING REFINEMENT PASS — OWNER RETEST REQUIRED BEFORE MERGE**

This audit records the first owner feel playtest after the initial Stage 05 engineering gate. The owner described the loop as decent and pretty fun, but reported several major control/readability defects. The supplied screen recording was treated as acceptance evidence and the Stage 05 PR remained draft while the problems were reproduced, converted into failing tests, repaired, and re-verified.

Do not merge PR #13 yet. The revised build still requires an owner feel retest.

## Owner findings reproduced

The recording and written feedback showed five related problems:

1. Sprint dribbling and direction changes allowed the ball to preserve its old velocity vector, forcing the player to run around the ball before regaining control.
2. Sustained sprint touches could gradually let the ball outrun the player.
3. There was no deliberate physical way to stop a moving ball while standing over it.
4. Shooting felt locked to the body/camera setup, and the pointer-lock click could be confused with a shot input.
5. The greybox player looked detached from the pitch and the camera could lose the ball or clip directly through the visible goal frame.

## Root causes

### Dribble steering

Football Practice used the player’s existing travel velocity as the next touch direction. During a sharp user input change, locomotion began turning but the next ball touch still inherited the old direction.

### Sprint runaway

The old sprint controller deliberately targeted a ball speed above player sprint speed at every contact. Because the speed surplus did not depend on current player-ball separation, repeated touches could monotonically increase the gap until it approached the `1.32 m` control reach.

### Ball stopping

Precision control always requested another directional touch. There was no separate trap intent when the user deliberately stopped moving.

### Shooting / pointer lock

The same primary mouse gesture both enters pointer lock and charges a shot. A very short focus click could therefore release a forced minimum-power shot. Shot preparation also preserved a hidden earlier body yaw while the rendered player had already turned, making contact legality disagree with what the player saw. A final integration audit also found that moving shots were still being fed a velocity-derived actor yaw even though the rendered player uses `player.facingYaw`.

### Presentation

The player marker geometry was initially offset above its support plane. Practice camera collision also received an empty obstacle list even though two goal frames were visibly rendered, allowing the camera to pass through a post/crossbar. The camera target followed only the player, so a loose ball could leave the useful center of the frame during cuts.

## Research mapping

The refinement deliberately follows the same control principles used by modern football games and current football-control research without introducing magnetic possession.

### EA SPORTS FC 26 / 27

Official FC gameplay notes emphasize:

- shorter / retuned dribble touch intervals;
- improved ball-direction logic while jogging;
- special effort touches for drastic dribble turns;
- faster, more responsive turns and deceleration;
- first-touch precision / trapping as a distinct control tool;
- broader and more responsive shooting angles;
- improved grounded movement and manual control.

These informed the new effort-turn touch, close-control trap, sprint cadence, and visible aim behavior. The implementation does not copy proprietary code or animations.

### PhysicsFC

PhysicsFC models dribbling around three related signals: target ball velocity, ball-to-player proximity, and player motion toward the ball. The Stage 05 sprint refinement now uses the same conceptual feedback loop: a fresh knock-on may have a small speed lead, while an already-stretched touch removes that lead so the player can recover.

PhysicsFC also treats Move, Trap, Dribble, and Kick as distinct skills with fast context transitions. Stage 05 mirrors that distinction at a lightweight deterministic level rather than welding the ball to the player.

### Change-of-direction biomechanics

Research on change-of-direction performance consistently highlights braking and re-acceleration / propulsion during sharper turns. Stage 05 effort-turn contacts now brake the old ball vector before redirecting it, instead of applying another full-speed knock-on through a large angle.

## Implemented corrections

### 1. Input-directed dribbling

- Every control touch now consumes the current camera-relative movement request.
- The next touch no longer inherits the player’s old travel vector.
- Hard turns are detected from desired direction versus ball velocity direction.

### 2. Effort-turn contacts

- Sharp turns enter `effort-turn` mode.
- The old ball vector is materially braked.
- The ball begins the newly requested direction before another sprint knock-on is permitted.
- 90° and 180° turns remain physically different from low-speed close control rather than becoming magnetic pivots.

### 3. Recoverable sprint dribbling

- Sprint touches are shorter than the original build.
- Sprint cadence is now `0.14 s`; normal / close cadence is `0.12 s`.
- A fresh sprint touch may target approximately `playerSpeed + 0.25 m/s`.
- Player-ball separation feeds back into the target speed.
- When the ball is already stretched toward the outside of the control envelope, the target falls to player speed or below so the runner catches up.

### 4. Physical trap / stop

- Hold precision control (`RMB` / `LT`) with no movement request near a controllable ball to enter `trap` mode.
- Trap is a bounded velocity / spin correction, not a teleport.
- An incoming ball can be killed close to the player without repeatedly nudging a stationary ball.

### 5. Shooting aim / pointer-lock refinement

- The first held primary click can acquire pointer lock and charge a shot in one continuous gesture.
- An ultra-short focus click below approximately `60 ms` is ignored as a shot release, preventing accidental weak kicks while capturing the mouse.
- A world-space aim arrow is visible while shot preparation is active.
- Mouse / right-stick yaw continues changing the aim vector during charge.
- Contact legality follows the body orientation visibly shown at release instead of a hidden yaw frozen at the beginning of charge.
- Football Practice now feeds shot contact the authoritative `player.facingYaw` used by the rendered mesh, including while moving; velocity-derived travel facing remains available for dribble/control logic.
- Body alignment still matters; the fix improves readability and control rather than authorizing impossible contacts.

### 6. Grounded player presentation

- The actual main player marker now uses the shared grounded visual layout.
- Its visible lower plane is aligned to the movement support plane.
- A browser-visible foot-plane probe protects the integration rather than only testing helper constants.

### 7. Ball readability and goal camera collision

- Football Practice adds a capped ball-aware camera focus bias of at most `0.9 m`.
- The player remains the primary camera anchor.
- Both visible goal frames contribute post/crossbar collision volumes to the existing spring-arm solver.
- The camera therefore shortens before goal geometry rather than clipping through the white goal frame.
- The generic `ThirdPersonCamera` remains presentation-agnostic and DOM-independent; Football Practice explicitly composes the ball focus and goal obstacles before calling it.
- This is presentation-only. It does not modify player, ball, possession, touch, or aim state.

## TDD evidence

Each major regression was demonstrated RED before its production repair.

### Sprint cadence

The initial owner refinement added a tighter cadence contract and exposed the older cooldown. Newer branch tuning had already reached `0.14 s`, so the acceptance test was corrected to the actual invariant rather than slowing production to satisfy an obsolete candidate value.

### Focus-click accidental shot

RED head demonstrated that a ~33 ms focus click still emitted the forced minimum release charge (`0.12`). Production now returns no shot for sub-threshold focus clicks.

### Visible-body shot contact

RED demonstrated a hidden contact yaw of `0.15 rad` while the current visible setup had rotated to `1.05 rad`. Production now uses the current visible body orientation during hold and release. Final call-site inspection then found moving Football Practice shots still passed `actor.facingYaw`; commit `8c3059a737ff61b33f0a64b4edb75bc7e3376f8f` changed that integration to the actual `player.facingYaw` shown by the mesh.

### Practice camera integration

RED CI run `39147456176`, job `117734092473`:

- `152` tests passed;
- exactly `2` failed;
- failure 1: expected ball-aware target bias but `target.x` remained `0`;
- failure 2: expected opposite-goal post collision but collision remained inactive.

After implementation both integration tests passed. A second RED contract then proved the generic camera was implicitly reading Football Practice DOM state; that hidden dependency was removed and the integration tests now exercise the explicit production wiring instead.

### Sprint separation feedback

RED CI run `39147668718`, job `117734704860`:

- `154` tests passed;
- exactly `1` failed;
- a stretched sprint touch at `1.20 m` still requested `8.65 m/s` for an `8.40 m/s` runner.

Production now decreases target speed as the current separation exceeds the desired sprint-touch distance.

## In-chat simulation evidence

A local clone was not available in this chat runtime because outbound GitHub DNS resolution is blocked. The exact repository is therefore executed through GitHub Actions, while independent scratch simulations are used as a second layer of control-model validation.

### Sustained owner scenarios

Using the latest control equations with calibrated Stage 04 turf deceleration:

- 6 s straight full-speed sprint: maximum separation approximately `1.07 m`, control retained;
- 90° sprint cut: maximum separation approximately `1.10 m`, control recovered;
- 180° sprint reversal: maximum separation approximately `1.16 m`, control recovered.

All stay below the `1.32 m` hard control reach.

Repeated half-second full-sprint zigzags can still lose the ball. That is intentional: hard repeated directional changes should require slowing down or using close control rather than turning sprinting into magnetic possession.

### 100,000-state randomized touch audit

- cases: `100,000`;
- non-finite outputs: `0`;
- fresh high-speed sprint touches averaged roughly `+0.25 m/s` target speed relative to the runner;
- already-stretched high-speed sprint touches averaged roughly `-0.26 m/s` relative to the runner;
- trap and effort-turn modes remained bounded contacts.

This verifies that the feedback changes direction as intended: knock ahead when close, recover when stretched.

## Exact source verification

Final functional source head before this documentation commit:

`8c3059a737ff61b33f0a64b4edb75bc7e3376f8f`

Exact-head workflows:

- CI run `39148534644` — **PASS**
- CI job `117737261612` — **PASS**
- Stage 01 contracts run `39148534649` — **PASS**

Exact functional-head evidence:

- `29` unit/contract files, `156 / 156` tests passed;
- Stage 04 ball fuzz: `1,000,000` launches, `4,000,000` states, `0` failures, checksum `e0afd3f7`;
- Stage 05 football fuzz: `250,000` cases, `1,000,000` actions, `0` failures, checksum `fecee5e1`;
- sprint-only, shot-spam, tackle-spam, and dribble-circle exploit bots all failed to dominate their varied/timed reference policies;
- deterministic trace hash remained `d55b2d0b968372a5`;
- FICTIONAL_PUBLIC production build and server health passed;
- Chromium E2E/browser parity: `23 / 23` passed.

## Owner retest checklist

Before Stage 05 is accepted or merged, retest this revised build specifically:

1. Dribble straight, then make one deliberate 90° turn and one full reversal. The ball should brake / redirect rather than keep travelling down its old line.
2. Hold sprint and dribble straight for at least 5–6 seconds. The ball should remain recoverable rather than gradually outrunning the player.
3. Release movement near a moving ball and hold `RMB`. The ball should be physically trapped / slowed close to you.
4. Hold `LMB`, move the mouse while charging, verify the aim arrow moves, then release. The shot should follow the requested aim subject to the same body facing you see on screen, including while moving.
5. Make a tiny click only to capture the mouse. It should not weak-shot the ball.
6. Verify the player marker visibly touches the pitch.
7. Turn/dribble near both goals. The camera should shorten around posts/crossbars rather than letting a white goal member fill the screen.
8. During turns, confirm the ball-aware framing makes the free ball easier to locate without making the camera feel as though the ball is dragging the player.
9. Retest ground/driven/through/lofted passing. Assistance should be friendlier while impossible behind-body passes remain rejected.
10. Give movement + ball control + shooting/aim + camera/readability a new overall feel score.

## Gate decision

**Do not merge yet.**

The engineering defects identified in the first owner playtest are repaired and the final functional source head is green. Stage 05 becomes a final PASS only after the owner confirms the revised feel is acceptable and explicitly requests the merge.
