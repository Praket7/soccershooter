# SoccerShooter Stage 05–07 Owner Control Overhaul Design

**Date:** 2026-10-18  
**Status:** Owner-approved repair contract  
**Base:** `stage/07-adaptive-bots`  
**Integration branch:** `stage/05-07-owner-control-overhaul`

## Problem

Stages 05–07 are engineering-green but owner playtesting exposed a backwards dependency: the tactical and adaptive AI cannot be meaningfully judged until the football interaction layer expresses player intent cleanly and bots embody the same physical contacts.

Observed failures:

1. First LMB both acquires pointer lock and begins a shot.
2. Trap is hidden behind RMB + effectively zero movement plus several internal legality checks.
3. Camera yaw is treated as football aim without persistent visible world intent.
4. Core passing uses modifier combinations rather than dedicated football actions.
5. Dribbling can still require reacquiring a ball whose previous vector no longer matches a sharp movement request.
6. Stage 06 Tactical Bot Lab uses symbolic possession and scripted transfers; it is a tactical debugger, not a physical-football validation surface.
7. Stage 07 Adaptive Bot Lab is an inspection dashboard rather than adaptive agents playing the same physical game.

## Research grounding

The redesign follows the binding `/DESIGN.md` state architecture and is reinforced by:

- **PhysicsFC (Kim, Jung, Lee, 2025):** Move, Trap, Dribble, and Kick are separate high-level skills. Dribble tracks user-requested target ball velocity while keeping the ball close. Trap exists to control incoming momentum and transitions immediately into dribble after contact. Skill transitions are driven by both user command and world context.
- **EA SPORTS FC 26 gameplay deep dive:** responsive dribbling depends on touch interval tuning and explicit effort touches on drastic turns; first-touch outcome considers requested exit angle, ball speed/height and pressure; through-pass selection is lane-aware and intended to respect the user's aim.
- **Pointer Lock API:** pointer lock is a camera/input capture mode based on relative mouse deltas and hides the cursor. Therefore capture is a mode transition and must not also emit an unrelated football action.

No runtime RL dependency is introduced. The production game remains deterministic.

## Chosen model

Keep the independent physical ball. Add a football-intent layer above legal physical contacts.

The user expresses one of these intents:

- **Move / carry** toward a requested world direction
- **Receive / trap** an approaching ball and optionally choose an exit direction
- **Pass** through a selected lane
- **Shoot** toward a visible world target with charge-controlled power
- **Defend / aerial** using dedicated actions

The lower layer remains responsible for whether a legal physical contact can realize the request.

## Controls

| Input | Role |
|---|---|
| WASD | move; with ball, desired carry/exit direction |
| Mouse | camera + world aim through center reticle |
| Shift | sprint / longer recoverable knock-on |
| RMB | close-control dribble |
| F | receive / trap / shield; no WASD kills ball, WASD chooses controlled exit |
| E | ground pass |
| Q | through pass |
| R | lofted pass / cross |
| LMB hold/release | shoot; hold controls power |
| Z+E | driven pass |
| Z+Q | chipped through pass |
| Z+LMB | finesse shot |
| X+LMB | chip shot |
| C | standing challenge |
| Shift+C | committed tackle |
| Space | contextual aerial contest/header |
| G | reset ball, practice only |

The normal 1–6 shot selector is removed from the core control vocabulary. Specialist contacts remain inspectable in practice/debug tooling but are not required for normal play.

## Pointer lock and aim

### Capture contract

- Unlocked: browser cursor remains available and the viewport shows `CLICK TO CONTROL CAMERA`.
- First primary click while unlocked requests pointer lock **only**.
- That click may never set `ShootHeld` or `ShootReleased`.
- Locked: a permanent center reticle is visible.
- Escape returns to unlocked state.

### World aim

The camera center defines a ray. The runtime derives a world aim target by intersecting that ray with an appropriate gameplay plane/surface.

Aim feedback is advisory, never a promise:

- ground/through/lofted passes show the requested lane;
- the selected receiver gets a ring;
- through passes show a predicted lead point;
- if the user aims clearly into open space, assist must not snap to a different lane;
- shooting near goal shows an intended goal-plane marker;
- holding LMB shows charge/power state.

## Receive / trap contract

`F` is an explicit receive request with deterministic buffering.

- pressing F before legal contact arms receive for a short bounded window;
- F + no movement means `kill`;
- F + movement means `controlled-exit` in the requested direction;
- failure is observable with a reason, never silent;
- contact still obeys reach, height, speed, pressure, balance, and cooldown legality;
- no teleport or rigid attachment is permitted.

Runtime feedback states include `TRAP ARMED`, `CUSHION TOUCH`, `CONTROLLED EXIT`, and a concrete failure reason.

## Dribble contract

The carry controller uses movement input as desired ball velocity direction.

- precision/close control: shortest touches and lower top ball speed;
- normal carry: one-stride recoverable touches;
- sprint: visibly longer knock-ons but still recoverable;
- a large requested heading change is detected from requested direction versus current ball travel, not delayed until body facing catches up;
- effort-turn touches shorten distance and brake old momentum before redirecting.

The ball remains an independently simulated object at every step.

## Passing contract

Pass type is explicit rather than inferred from RMB/Q combinations.

- E ground
- Q through
- R lofted
- Z+E driven
- Z+Q chipped through

Receiver selection consumes user aim first, then bounded assistance among candidates inside an aim cone. The selected candidate and lead point are visible before contact. A blocked lane lowers candidate quality and is visualized.

## Shooting contract

- LMB starts preparation only when pointer lock is already active.
- LMB release attempts contact using current world aim and charged power.
- Z modifies to finesse.
- X modifies to chip.
- body orientation, pressure, balance, reach, and physical ball state remain authoritative.
- UI distinguishes `READY`, `POWER`, `CONTACT`, and explicit failure states.

## Bot embodiment

### Tactical Debug remains

The existing Stage 06 2D Tactical Bot Lab remains because it is useful for role, spacing, lane and blackboard inspection. Its UI must identify it as a tactical debug surface and not imply physical possession validation.

### Physical 3v3 Scrimmage

Add a browser-visible 3D scrimmage that uses:

- Stage 03 movement semantics;
- Stage 04 free-ball physics;
- Stage 05 legal football contacts;
- Stage 06 tactical intent selection;
- Stage 07 cognition/personality modifiers.

No bot may own the ball by a boolean that moves the ball to the carrier each tick.

A bot dribble is repeated bounded control contacts. Passes and shots launch the actual ball. Interceptions, challenges and imperfect control can create a loose ball. Ownership is inferred from physical proximity/control context and can be `null`.

The physical scrimmage must expose deterministic probes for:

- loose-ball periods;
- physical touches by actor/action;
- possession changes caused by contacts;
- passes/interceptions/challenges;
- selected difficulty and personality;
- proof that difficulty does not change physical multipliers.

### Adaptive overlay

Stage 07 controls become an overlay/debug drawer on the physical scrimmage. Novice/standard/elite and personality selectors alter cognition/utility only. The existing static comparison cards may remain as a diagnostic section, but they are no longer the primary owner acceptance surface.

## Determinism and compatibility

- Render cadence never controls simulation outcomes.
- New intent/action bits are device-agnostic.
- Existing gamepad adapters must map to the same high-level intents or retain backward-compatible mappings until remapping UI arrives.
- Stage 02 canonical reference hash must remain unchanged unless a binding simulation input schema change genuinely requires a documented hash migration.
- Stage 04/05 fuzz, Stage 06 tournament and Stage 07 adaptive tournament remain mandatory regression gates.

## Acceptance tests

RED tests are required before implementation for:

1. capture click emits no football action;
2. LMB begins charge only while already locked;
3. dedicated F/E/Q/R/Z/X semantics;
4. bounded receive buffering and deterministic expiry/cancel;
5. kill-ball versus controlled-exit receive;
6. sharp requested turn brakes the old ball vector before escape;
7. pass candidate selection respects aim cone and open-space intent;
8. through pass exposes the same lead point used by the solver;
9. shot state exposes ready/power/contact/failure;
10. bot physical ball state is never copied to carrier position each tick;
11. legal bot control contacts can lose possession and produce loose balls;
12. adaptive physical scrimmage uses identical physical constants at every difficulty;
13. browser surface exposes permanent locked reticle, capture overlay, pass lane/receiver/lead feedback and physical 3v3 mode.

## Gate

This branch may be engineering-green while still awaiting owner feel acceptance.

Before any merge toward `main`:

- all Stage 01–07 automated gates are green;
- new browser tests are green;
- no existing stage checkpoint is rewritten;
- owner manually confirms the repaired interaction model feels substantially better;
- only then decide whether to keep this as an integration commit or split/rebase accepted changes into stage history.
