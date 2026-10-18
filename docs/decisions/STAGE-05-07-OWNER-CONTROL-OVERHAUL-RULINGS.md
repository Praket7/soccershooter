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
7. **Sharp turns get early physical correction.** Large changes between requested carry direction and current ball travel shorten the legal re-contact cadence and apply a bounded braking/redirect impulse.
8. **Pass assistance is lane-bounded.** Assistance may rank a legitimate receiver inside the aim cone but cannot override a deliberate open-space direction. Through-pass lead feedback must represent the solver target.
9. **Normal play does not require six shot hotkeys.** Normal/finesse/chip are simple base/modifier controls. Specialist knuckle/outside-foot contacts remain practice/debug experiments.
10. **The old Stage 06/07 pages are debug surfaces.** The 2D tactical blackboard is `Tactical Debug`; static adaptation cards are `Adaptive Debug`.
11. **Physical 3v3 is the bot embodiment acceptance surface.** Stage 06/07 decisions are realized through Stage 03 movement, Stage 04 ball physics and Stage 05 legal contacts. Loose-ball state is valid and expected.
12. **Difficulty changes cognition, not physics.** Novice/standard/elite must share identical physical multipliers and constants.
13. **Checkpoint history is preserved.** This repair lives on an integration branch. `main`, `stage/06-tactical-bots`, and `stage/07-adaptive-bots` are not rewritten by this work.
14. **Automated green is necessary but not sufficient.** The branch remains merge-blocked until the owner manually confirms the repaired controls feel substantially better in a real browser session.

## Research basis

The architecture deliberately mirrors research and current football-game design that separates high-level football skills from low-level physical realization, tunes touch timing around requested motion, uses explicit first-touch intent, and gives the player visible action intent instead of hidden selection logic.
