# SoccerShooter Athlete Movement Realism Design

**Date:** 2026-10-20  
**Status:** Awaiting owner review  
**Scope:** Integrated locomotion simulation and procedural athlete presentation

## Goal

Make ordinary movement read as one believable athlete: starting, accelerating, jogging, sprinting, braking, stopping, turning, reversing, and moving laterally should show coordinated momentum, posture, foot placement, and recovery. Ball-control contacts and the approved Elastico/step-over behavior must remain coherent with those movements.

## Current behavior

The simulation already tracks velocity, gait phase, stride duration, body yaw/rate, turn demand, plant intensity, support foot, and a short movement trajectory. The procedural athlete uses those signals, but builds much of the gait from a simple sinusoidal stride and resolves the limbs as straight segments. As a result, posture, foot plants, and body motion can feel detached from the actual acceleration and turning path.

## Design

1. **Keep simulation authority.** Continue deriving pose from fixed-step player state. Animation must never move the authoritative player or ball, create a contact, or add render-frame-dependent behavior.
2. **Use momentum-aware locomotion.** Drive body lean, hip/chest rotation, gait length, cadence, and arm counter-swing from current velocity, acceleration/braking, body yaw/rate, plant intensity, and gait phase. Blend starts, speed changes, lateral/backward travel, and stops instead of switching poses abruptly.
3. **Make support and swing phases legible.** Keep the support foot grounded during stance, release it smoothly when the stance becomes strained, and shape the swing foot to the current travel direction and movement phase. Avoid leg crossing, sudden foot jumps, and foot skating during tight turns.
4. **Keep player and ball actions synchronized.** Existing legal contact plans remain the source of contact timing and foot choice. The visual pose should meet those planned contacts while ordinary carry touches remain physical and bounded. Preserve the currently approved Elastico path and its ball-follow behavior.
5. **Limit the change to locomotion feel.** Do not replace the player rig, add motion-capture dependencies, redesign controls/camera, retune ball physics, or introduce new skills in this pass.

## Alternatives considered

- **Presentation-only polish:** smallest effort, but risks making the pose disagree with actual movement and contacts.
- **Integrated simulation/presentation refinement (recommended):** improves the movement signals and the procedural body that consumes them, while preserving deterministic control and physical contacts.
- **Motion-capture/animation-graph replacement:** potentially the highest visual ceiling, but requires new assets, retargeting, and a larger stage-level pipeline than this movement pass needs.

## Acceptance

- Starts and accelerations show a forward athletic lean that eases back as speed stabilizes.
- Braking, sharp cuts, and reversals show a planted support phase, visible momentum settling, torso/hip rotation, and re-acceleration; no instantaneous facing snap.
- Jog, sprint, lateral, and backward movement have distinct but continuous stride and arm motion, with the body aligned to the actual travel direction.
- Idle and stopping settle into stable poses without continuing to drift or snapping gait phase unnaturally.
- Support-foot slide, foot penetration, leg crossover, and contact-frame mismatch are absent in representative movement sequences.
- No change to movement input semantics, ball retention/contact legality, or the approved skill-move ball path.
- Rendering cadence does not affect the authoritative simulation result.

## Evidence informing the design

Soccer change-of-direction research relates performance to both sprint and braking properties, and trunk kinematics vary through the stance phase of a cut. A match-tracking dribbling model treats the player and ball as a coupled dynamical system. These findings support momentum-aware turns and synchronized physical touches; they do not by themselves establish that a generated animation looks professional.

- Zhang et al., 2022: https://doi.org/10.3389/fphys.2022.1027811
- Sasaki et al., 2013: https://pmc.ncbi.nlm.nih.gov/articles/PMC3737904/
- Bialkowski et al., 2023: https://doi.org/10.1038/s41598-023-45914-6

## Implementation boundary

This is a focused refinement of the existing deterministic movement model and procedural athlete proxy. It is not the full Stage 13 motion-capture/animation-graph inventory. Before implementation, confirm the active project stage and its gate under `AGENTS.md`; do not silently advance the stage sequence. Existing unrelated dirty-worktree changes must remain intact.
