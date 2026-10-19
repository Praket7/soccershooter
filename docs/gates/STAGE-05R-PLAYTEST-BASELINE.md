# Stage 05R Playtest Baseline

**Owner verdict:** REJECTED FEEL / ENGINEERING GREEN IS NOT ACCEPTANCE  
**Playtest date:** 2026-10-18/19  
**Video duration:** 74.87 s  
**Pre-remediation functional SHA:** `8d5f2099b2b87d9f02ad42da3abc848d143a2377`  
**Stage 05R plan SHA:** `2cc2feb72cbfae40ac2e67a4acbe5bdaa3f707f5`

## Failure classes observed

1. **Root translation instead of athletic locomotion.** Acceleration, steady gait, braking, planting and re-acceleration are not physically legible.
2. **Synthetic dribble correction.** The ball can be redirected by a legal controller touch without a persistent left/right foot, support-foot state, stride phase or visible contact cause.
3. **Weak turn mechanics.** Hard changes of direction lack a brake → plant → effort touch → propulsion sequence.
4. **Contact timing is abstract.** Routine dribble contacts are scheduled by a cooldown rather than a foot/ball intercept opportunity.
5. **Shot/pass setup is visually disconnected.** The authoritative impulse may be valid, but the athlete does not yet establish a support foot, gather, contact beat and follow-through.
6. **Camera amplifies the stiffness.** Root-follow behavior does not yet frame the near-future athlete/ball/contact relationship strongly enough during abrupt maneuvers.

## What is explicitly *not* rejected

- Stage 04 free-ball flight, spin, bounce and turf physics remain the authoritative physical foundation.
- No-teleport and deterministic-input constraints remain mandatory.
- Existing control tests remain useful safety regressions while the contact architecture is migrated.

## Acceptance consequence

No merge to `main` is authorized from the existing Stage 05–07 control implementation. Stage 05R must reach the Task 3 owner micro-playtest gate with normal and precision dribbling migrated to contact-planned control before the owner is asked to retest.

The owner playtest is the final authority on whether that vertical slice materially improves feel. Automated bounded-separation checks cannot self-certify this gate.
