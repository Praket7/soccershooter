# Stage 05R Motion and Dribbling Research Basis

This note records the external design evidence used by the Stage 05R implementation. It does not claim access to proprietary EA code or exact internal tuning values.

## Production football-game lessons

### EA Animation Warping for FIFA Soccer

Public GDC material describes procedurally adapting authored/captured movement to reach a required point at a required time while preserving responsiveness.

Stage 05R implication: contact planning should solve **where the foot and ball need to meet, and when**, rather than continuously steering the ball toward a root-relative corridor.

### FIFA HyperMotion / Technical Dribbling / FC 26

EA public gameplay material repeatedly emphasizes:

- stride/cadence adaptation while approaching the ball;
- path calculation between touches;
- distinct foot-preference and animation branches;
- shorter/retuned touch intervals where appropriate;
- effort touches for drastic direction changes;
- interruptible response instead of long animation lock-in.

Stage 05R implication: dribbling cadence should emerge from gait phase, approach geometry and ball intercept timing. High-speed turns need a brake/plant/contact/re-acceleration sequence rather than a velocity-corridor correction.

### FC 27 off-balance control

Public FC 27 gameplay direction emphasizes preserving directional agency while the athlete is visibly off balance instead of simply removing control.

Stage 05R implication: imbalance degrades the quality and options of the next legal physical contact; it does not inject arbitrary loss of input.

## Motion-control research

### DReCon — Bergamin, Clavet, Holden, Forbes (2019)

DOI: `10.1145/3355089.3356536`

Useful concepts:
- compact motion-state features;
- foot positions/velocities;
- short future trajectory queries;
- blending current momentum with desired motion.

Stage 05R uses these concepts in a deterministic planner/state machine, not a learned full-body runtime controller.

### Physics-based full-body soccer motion control — Hong et al. (2019)

DOI: `10.1145/3306346.3322963`

Useful concept: refine player motion so the foot reaches the moving ball at the correct place and time.

Stage 05R implication: a contact plan is only permission to attempt; geometry is revalidated at the contact tick.

### PhysicsFC (2025)

DOI: `10.1145/3731425`

Useful concept: Move, Dribble, Trap and Kick are distinct skills with explicit transitions.

Stage 05R implication: keep these modes explicit while sharing one contact-provenance contract.

## Soccer biomechanics

### Zago et al. (2016), dribbling determinants

DOI: `10.1080/02640414.2015.1057210`

Faster dribblers in the study showed higher foot-ball contact cadence and more economical paths. The reported cadence range is a diagnostic reference only, not a global gameplay constant.

Stage 05R implication: normal/precision contact cadence should be measured as a distribution tied to stride and context, not a fixed timer.

### Dos'Santos et al. (2018), angle-velocity trade-off

DOI: `10.1007/s40279-018-0968-3`

Sharper changes of direction at higher approach speeds require more braking and re-acceleration.

Stage 05R implication: 90–180 degree high-speed turns must visibly and mechanically lose speed before full propulsion resumes.

### Singh et al. (2025), change-of-direction biomechanics review

DOI: `10.1007/s40279-025-02278-3`

Relevant factors include braking/propulsive force, ground-contact behavior, trunk inclination and center-of-mass strategy.

Stage 05R implication: the compact authoritative motion state exposes plant, braking, propulsion and body-lean demand so presentation can explain the contact without owning gameplay authority.

## Binding implementation conclusions

1. Preserve Stage 04 free-ball physics.
2. Replace routine dribble cooldown cadence with gait/contact opportunity.
3. Add deterministic support-foot / next-foot state.
4. Predict a short player trajectory and candidate ball intercepts.
5. Revalidate ball/foot geometry at contact tick.
6. Keep the ball fully free between contacts.
7. Make error causal: timing, stretch, speed, balance, pressure, weak-foot/surface and plant quality.
8. Never add ambient random lateral jitter.
9. Keep beginner assistance inside legal geometry.
10. Human owner playtest remains the final feel gate.
