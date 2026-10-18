# Stage 06 Rulings — Tactical Bot Foundation

**Stage:** 06  
**Implementation branch:** `stage/06-tactical-bots`  
**Implementation head before documentation:** `e4ae0f9e423be6a8b6291b817abcce0fcccc19bf`  
**Status:** Engineering complete; owner visual playtest pending before merge.

## 1. Tactical architecture

Stage 06 uses a deterministic hybrid architecture:

1. read-only bot perception from authoritative world state;
2. a team tactical blackboard;
3. team-level dynamic role assignment;
4. cheap predictive tools for pass lanes, arrival/intercept time, shot quality, and support geometry;
5. utility action selection for carrier, off-ball, defensive, and goalkeeper decisions;
6. continuous bounded steering toward tactical targets;
7. authoritative Stage 03–05 systems remain responsible for actual movement and football physics in the shipping game.

The tactical predictor never teleports players or the ball and does not modify authoritative Stage 04 ball state.

## 2. Tactical cadence

- Ordinary tactical reevaluation: **10 Hz**.
- Steering output: available continuously from the most recent tactical assignment.
- Possession changes force immediate reevaluation.
- Material ball-velocity changes can force immediate reevaluation.
- Small state perturbations do not force role churn during the short commitment window.

This keeps decision cost low while preserving fast reactions to turnovers and major ball events.

## 3. Bot world model

`BotWorldSnapshot` is renderer-independent and contains:

- tick and simulation time;
- field geometry;
- ball position and velocity;
- player IDs, team, position, velocity, facing, and goalkeeper flag;
- possession team and player;
- optional deterministic match state: live/restart/stopped phase, restart kind/team, score, and remaining time.

When external match state is not yet supplied, the bot layer defaults to ordinary live play with no restart. It never invents a set piece.

## 4. Dynamic role assignment

Current field roles include:

- ball carrier;
- immediate support;
- width support;
- presser;
- cover defender;
- recovery runner;
- goalkeeper.

Assignments minimize team travel to useful role targets instead of independently sending every agent to the ball. A short commitment/hysteresis window prevents tiny world-state changes from causing visible role thrashing. Goalkeeper identity stays unique.

Research basis:

- MacAlpine, Barrera, and Stone, *Positioning to Win: A Dynamic Role Assignment and Formation Positioning System*, RoboCup 2012. The paper demonstrates dynamic role assignment and formation positioning for physically realistic simulated soccer agents. https://doi.org/10.1007/978-3-642-39250-4_18
- Lau et al., *Robot team coordination using dynamic role and positioning assignment and role based setplays*, Mechatronics 21(2), 2011. It separates reactive role assignment from lower-frequency positioning assignment. https://doi.org/10.1016/j.mechatronics.2010.05.010
- Xia, Zhu, and Zhu, *Dynamic role discovery and assignment in multi-agent task decomposition*, 2023. The work explicitly regularizes adjacent role selection to avoid instability caused by frequent role changes. https://doi.org/10.1007/s40747-023-01071-x

SoccerShooter uses deterministic heuristics rather than copying those learning systems, but adopts the same coordination principles: team roles, differentiated positioning, and anti-thrash stability.

## 5. Passing and interception model

Pass evaluation combines:

- pass distance and nominal ball arrival time;
- sampled defender interception times along the lane;
- receiver orientation;
- support angle;
- target-space threat/progression;
- receiver velocity lead;
- explicit most-dangerous-defender tracking.

A pressured carrier gains extra utility for a pass only when the ball has a positive arrival margin over the first credible defender. Obvious blocked lanes score materially worse than open alternatives.

Research basis:

- Arbués-Sangüesa et al., *Using Player's Body-Orientation to Model Pass Feasibility in Soccer*, CVPR Workshops 2020. The model shows that offensive-player orientation and opponents' spatial configuration materially improve pass-feasibility modeling. https://doi.org/10.1109/CVPRW50498.2020.00451
- Arbués-Sangüesa et al., *Towards soccer pass feasibility maps: the role of players' orientation*, Journal of Sports Sciences 39(24), 2021. Orientation materially improved Top-1/Top-3 pass-feasibility prediction when combined with positional information. https://doi.org/10.1080/02640414.2021.1959176

## 6. Carrier utility

Carrier candidates are:

- shoot;
- pass;
- dribble;
- protect;
- clear.

The decision is deterministic. Pressure, shot geometry, pass feasibility, field progression, danger near own goal, and viable escape lanes affect scores. Protecting the ball is deliberately suppressed when a strong escape pass exists, avoiding passive shielding loops.

## 7. Off-ball utility

Off-ball choices include:

- immediate support;
- overlap;
- width;
- half-space support;
- back-post run;
- recycle.

Support targets intentionally leave the carrier lane and preserve usable passing angles. Width roles do not collapse centrally just because the ball is nearby. Final-third far-side behavior can convert to a back-post run when context warrants it.

## 8. Defensive utility

Defensive choices include:

- press;
- cover;
- block lane;
- block shot;
- intercept;
- recover goal-side.

Only the most appropriate nearby defender should press. Other defenders retain cover/recovery structure, and a lane block is accepted only when its target is actually goal-side of the carrier. Dangerous shot geometry can override a generic lane block.

## 9. Goalkeeper

Goalkeeper decisions include:

- position;
- claim;
- dive;
- parry;
- distribute.

The home position follows ball angle while remaining goal-connected. Fast goal-bound trajectories are projected to the goal crossing, and the keeper can claim reachable close danger or select a save response. Distribution reuses pass-feasibility scoring rather than granting a special invisible pass bonus.

Research basis:

- Lopes et al., *Analytic method for evaluating players' decisions in team sports: Applications to the soccer goalkeeper*, PLOS ONE 13(2), 2018. It models goalkeeper position as a dynamic function of ball line, goal geometry, and coverage. https://doi.org/10.1371/journal.pone.0191431
- Wang et al., *The Goalkeeper Strategy of RoboCup MSL Based on Dual Image Source*, RoboCup 2015. It predicts an interception point from early ball trajectory observations before selecting keeper response.

## 10. Fairness rule

Stage 06 bots receive no hidden acceleration, speed, ball-control, tackle, shooting, or keeper-reach advantage. Difficulty scaling is deferred to Stage 07 and must remain inside the documented fair knobs. The tournament uses the same bounded movement assumptions for both teams.

## 11. Tactical Bot Lab

The browser dev lab provides a visible 3v3 tactical simulation with:

- six visible participants;
- live possession/phase/pass/spacing diagnostics;
- force-turnover control;
- optional role labels;
- role labels **off by default** so useful support and recovery must be readable from movement itself;
- permanent-swarm and keeper-depth diagnostics.

The debug overlay is a diagnostic aid, not a dependency for behavior.

## 12. Simulation gate

The canonical Stage 06 balance entrypoint is:

`tools/balance/tournament.ts`

`pnpm bots:tournament` runs 5,000 seeded 3v3 possessions and exits nonzero when any of the following fail:

- all requested possessions complete;
- zero simulation failures;
- zero keeper abandonments;
- zero permanent-swarm possessions;
- cluster ratio below 0.12;
- idle ratio below 0.08;
- passes common enough to exercise team play;
- completed-pass ratio above 0.52;
- multi-pass possessions above 0.18;
- at least one shot;
- average support distance inside 3.2–10.5 m;
- average tactical decision time below 1 ms/team;
- defensive max decision-time guard below 12 ms.

Wall-clock timing is measured but excluded from deterministic equality checks. Tactical outcomes use a deterministic checksum.

## 13. Explicit stage boundary

Stage 06 does **not** add:

- adaptive difficulty or learned policies (Stage 07);
- advanced signature techniques (Stage 08);
- campaign/progression systems;
- multiplayer prediction/reconciliation;
- final art/animation/audio.

Stage 07 must preserve the Stage 06 deterministic/fair baseline and may only vary approved difficulty dimensions.