# Stage 05–07 Owner Control Overhaul Rulings

**Date:** 2026-10-18  
**Branch:** `stage/05-07-owner-control-overhaul`  
**Base checkpoint:** `stage/07-adaptive-bots`

## Binding rulings

1. **The football remains an independent simulated body.** No human or bot possession system may copy the ball to a carrier transform each tick.
2. **Input expresses football intent.** Movement requests carry direction, F requests receive/control, E/Q/R request explicit pass families, and LMB requests a shot toward visible world aim.
3. **Pointer capture is not a football action.** The first unlocked primary click may request pointer lock only. Shooting starts only after the pointer is already captured.
4. **Aim is visible.** Locked play exposes a center reticle. Camera-center world aim drives pass-lane, receiver/lead and goal-target feedback.
5. **Receive is explicit and buffered.** F/no movement requests a kill touch; F+movement requests a controlled exit. Internal legality may reject the contact, but the state/reason must be observable.
6. **RMB/LT close control has a locomotion cost.** It shortens ball touches, suppresses sprint and reduces movement authority instead of granting precision at full sprint speed.
7. **Ordinary dribbling uses a physical control corridor, not magnetic possession.** A legal control touch may steer ball velocity toward a moving target point in front of the athlete, but it may never copy or snap ball position. Reasonable lateral error is actively corrected while reach, body angle, pressure, balance, speed and impulse limits remain authoritative.
8. **Normal dribble pace must be recoverable.** A competent normal-jog touch cannot deliberately target a ball speed below the carrier's current horizontal speed. Sprint knock-ons remain longer and riskier and may still be lost through overextension, pressure, poor body setup or aggressive cuts.
9. **Touch cadence reflects football intent.** Precision uses the tightest repeated-touch cadence, normal carrying uses a moderate cadence, and sprinting uses a longer knock-on cadence. Effort turns may re-contact earlier to brake and redirect a legal nearby ball.
10. **Sharp turns get early physical correction.** Large changes between requested carry direction and current ball travel shorten the legal re-contact cadence and apply a bounded braking/redirect impulse.
11. **Pass assistance is lane-bounded.** Assistance may rank a legitimate receiver inside the aim cone but cannot override a deliberate open-space direction. Through-pass lead feedback must represent the solver target.
12. **The normal keyboard control vocabulary is ergonomic and compositional.** E = ground, Q = through, R = lofted, RMB+E = driven ground, Ctrl+Q = chipped through, LMB = charged normal shot, RMB+LMB = finesse, Ctrl+LMB = chip. F remains receive/trap and Shift remains sprint.
13. **RMB means controlled/firm technique and Ctrl means lift.** The same modifier concept is reused across pass and shot families instead of assigning unrelated Z/X chords. C remains the primary tackle key; B remains a defensive fallback. Ctrl is not a tackle alias.
14. **Z and X are not normal-match advanced-action modifiers.** Specialist knuckle/outside-foot contacts remain practice/debug experiments until their later technique-stage design is explicitly accepted.
15. **Advanced technique is latched at action start.** Once a finesse or chip shot begins charging, releasing RMB/Ctrl before LMB cannot silently convert the action into a normal shot. Pass modifiers are captured on the pass key-down edge for the same reason.
16. **Normal play does not require six shot hotkeys.** Normal/finesse/chip are base/modifier controls. Specialist knuckle/outside-foot contacts remain practice/debug experiments.
17. **The old Stage 06/07 pages are debug surfaces.** The 2D tactical blackboard is `Tactical Debug`; static adaptation cards are `Adaptive Debug`.
18. **Physical 3v3 is the bot embodiment acceptance surface.** Stage 06/07 decisions are realized through Stage 03 movement, Stage 04 ball physics and Stage 05 legal contacts. Loose-ball state is valid and expected.
19. **Difficulty changes cognition, not physics.** Novice/standard/elite must share identical physical multipliers and constants.
20. **Checkpoint history is preserved.** This repair lives on an integration branch. `main`, `stage/06-tactical-bots`, and `stage/07-adaptive-bots` are not rewritten by this work.
21. **Automated green is necessary but not sufficient.** The branch remains merge-blocked until the owner manually confirms the repaired controls feel substantially better in a real browser session.

## Owner playtest round 2 root causes

The 2026-10-18 owner recording exposed two distinct defects.

### Dribble drift

The prior control envelope computed a target point in front of the player but did not use that point when building the contact velocity. The touch simply launched the ball parallel to requested movement, so existing lateral displacement could persist across repeated contacts. At the Stage 03 normal jog ceiling of 5.2 m/s, the old normal-touch formula could also target roughly 5.07 m/s, allowing the athlete to overrun an otherwise ordinary touch.

The repair uses the already-authorized target point as a bounded velocity-servo reference. It corrects position error through impulse only. Ball position remains untouched by player control code.

### Fragile advanced-action chords

The previous keyboard mapping required Z/X combinations, and shot style was decoded again on the LMB release frame. Releasing the modifier slightly before LMB could therefore turn a finesse/chip attempt into a normal shot. Pass variants had a similar same-frame dependency.

The repair moves normal keyboard variants to reachable RMB/Ctrl modifiers and latches the requested technique at the irreversible action boundary.

## Research basis

- EA's current football passing guidance treats ground, through, lobbed-through and driven passes as distinct intent families: driven passes move the ball quickly through a closing lane, while lobbed/chipped through balls attack space over defenders.
- EA's current shooting guidance treats finesse as a curling placement technique and chip as a lifted finish over an advancing keeper, supporting a precision-versus-lift modifier language rather than unrelated hotkeys.
- EA FC 26's gameplay notes emphasize improved first-touch responsiveness and controlled first touch with a movement tradeoff, reinforcing SoccerShooter's existing RMB close-control cost instead of full-speed precision.
- Zago et al., *Dribbling determinants in sub-elite youth soccer players* (Journal of Sports Sciences, 2016), reported faster dribblers with higher foot-ball contact cadence and narrower, less variable movement paths. The implementation uses repeated bounded touches to preserve a recoverable corridor rather than magnetic ownership.
- The architectural source of truth still takes precedence: SoccerShooter's ball remains an independent physical object and dribbling remains repeated impulse-based contact.
