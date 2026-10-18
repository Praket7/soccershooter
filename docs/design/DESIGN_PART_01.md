# SoccerShooter — Complete Visual, UI, Game Feel, and Experience Design Specification

**Version:** 2.0 AI-Centered Planning Baseline  
**Date:** 2026-10-17  
**Status:** Binding design contract for the noncommercial alpha  
**Primary platform:** Desktop browser  
**Primary input:** Keyboard and mouse  
**Secondary input:** Gamepad  
**Runtime stack:** TypeScript, Three.js, Rapier, Colyseus  
**Authoring stack:** Blender 5.2 LTS, Blender MCP, `/3d-product` principles, Krita/Inkscape/GIMP, glTF tooling  

> This file is not inspiration prose. It is an execution contract. AI agents must use it to decide what to build, what to reject, and when a visual or interaction is allowed to advance to the next gate.

---

## 0. The one-sentence target

**SoccerShooter should feel like a premium third-person action game whose “weapon” is a physically credible football: immediate, readable, expressive, grounded, and spectacular only when the play earns spectacle.**

---

# 1. Product experience pillars

Every mechanic, screen, animation, material, sound, camera movement, and visual effect must serve at least one of these pillars.

## 1.1 Embodiment

The user should feel that they inhabit one powerful football athlete rather than command a chess piece from above.

Required consequences:
- one-player control
- third-person camera close enough to read the athlete's body language
- visible weight shifts before and after difficult actions
- planted-foot credibility
- foot-to-ball contact that matches the simulation
- readable acceleration, deceleration, turns, and recoveries
- immediate input acknowledgement

## 1.2 Ball mastery

The ball is the central interactive object.

Required consequences:
- the ball is physically simulated and never permanently attached to the player
- first touch quality matters
- body orientation matters
- spin, contact point, force, and timing matter
- passing and shooting expose enough control to reward practice
- animation serves the ball state, not the reverse

## 1.3 Team intelligence

Football should reward movement without the ball.

Required consequences:
- teammate support runs are readable
- passing lanes matter
- defensive cover matters
- the HUD helps awareness without playing the game for the user
- bots understand space and role transitions
- selfish play cannot dominate simply because the engine accidentally rewards it

## 1.4 Pressure and release

A match needs quiet positioning, mounting pressure, explosive action, and emotional release.

Required consequences:
- normal touches are visually restrained
- strong actions have stronger sound and camera feedback
- exceptional goals receive the largest audiovisual treatment
- UI density drops during high-focus live play
- replays can become more cinematic than live gameplay

## 1.5 Credibility, not photorealism

The game does not chase a broadcast-simulation look or uncanny photorealistic humans. It must look believable and intentional.

Credibility means:
- correct scale
- physically plausible ball behavior
- coherent materials
- convincing athlete silhouettes
- believable stadium construction
- consistent lighting
- responsive animation
- clear team distinction

Credibility does **not** require:
- pore-level faces
- cinematic motion blur during play
- photogrammetry
- fully simulated cloth
- enormous textures
- animation latency in exchange for “naturalness”

Research basis: current action-football design repeatedly emphasizes expressive/readable/energetic action and credible rather than strictly realistic movement. Academic work on responsiveness vs. naturalness also shows that more natural animation is not automatically better if control response becomes worse.

---

# 2. Lessons that SoccerShooter must preserve from the reference games

## 2.1 Slopocalypse

Observed development pattern:
- first concept was scrapped when the initial gameplay was not compelling
- movement and core attacks were built with primitive geometry first
- blunt playtest observations drove changes
- a winning run was proven fun before major art investment
- art arrived after mechanics
- a dedicated sound lab was used to audition feedback
- bot/exploit tests were created from real failures, including a stand-still strategy
- automated tests, separate subagents, and deployment gates reduced regressions
- player feedback later caused screen-shake and readability reductions

SoccerShooter rule:
**If a problem can be expressed as “this feels bad” or “this exploit wins,” the lead AI must convert it into a reproducible test, telemetry metric, video comparison, or explicit review checklist before doing more content work.**

## 2.2 Birds With Guns

Observed development pattern:
- started with capsule characters, box environment, bots, and core objectives
- early player count was too chaotic and was reduced after playtesting
- movement/flight and readability were tuned before final characters
- one rigged character validated the complete asset pipeline before scaling to the full roster
- maps were generated in parallel from one shared written brief
- bot-only QA validated objectives, kills, and stuck navigation before human review
- balance used modeled combat curves plus bot reruns
- client/server game logic was shared
- authoritative networking, prediction, lag compensation, and a latency simulator were treated as gameplay quality
- humor/personality was a deliberate later pass, not accidental noise

SoccerShooter rule:
**One athlete, one ball, one greybox arena, and one complete football loop must prove the entire runtime and content pipeline before the AI is allowed to create four teams, many athletes, or multiple arenas.**

## 2.3 Combined reference-game production rule

The AI development order is:

1. written intent
2. greybox
3. measurable feel test
4. exploit/bot test
5. representative art prototype
6. performance check
7. scale content
8. polish
9. human taste review
10. regression lock

Never reverse this order to make the project look finished early.

---

# 3. Anti-slop rules

Any AI worker must reject or revise output containing these patterns unless specifically justified by the design.

## 3.1 UI anti-slop

Reject:
- generic purple-to-blue gradients as a default identity
- glassmorphism on every panel
- excessive glow
- inconsistent border radii
- random drop shadows
- giant empty cards with tiny content
- generic dashboard UI that looks like a SaaS app
- random icon sets from mixed visual families
- every value inside a pill
- fake complexity with too many panels
- placeholder copy in final review captures
- three or more simultaneous primary calls to action
- UI animation that delays control

## 3.2 3D anti-slop

Reject:
- melted or uneven topology
- inconsistent bevel scale
- incorrect physical scale
- random high-frequency surface detail
- uniform roughness everywhere
- mirrored text
- AI-generated logos baked into textures
- hand/foot deformation artifacts
- floating cloth or accessories
- non-manifold geometry
- invisible high-poly geometry
- one-off materials that should be shared
- huge texture maps on distant assets
- inconsistent texel density
- unsupported final geometry made from a single perspective reference

## 3.3 animation anti-slop

Reject:
- visible foot sliding during planted actions
- ball teleporting to a kick animation
- action clips that lock out steering longer than needed
- animation starting noticeably after input
- hard state changes with no transition or follow-through
- repeated identical idle loops across the whole team
- bicycle kicks triggered from physically impossible states
- attack-like “skill” animations that ignore momentum

## 3.4 VFX anti-slop

Reject:
- particles on every touch
- full-screen flashes for routine events
- constant camera shake
- bloom that destroys line/ball visibility
- trails that imply a false ball trajectory
- unrelated sparks/energy simply to look “gamey”
- opaque VFX over the ball during competitive control

---

# 4. Visual thesis

## 4.1 Style name

**Athletic Cinematic Realism**

It combines:
- realistic proportions
- physically credible PBR materials
- simplified but premium faces
- slightly heightened color separation
- bold but believable light
- clean silhouettes
- restrained live-play VFX
- cinematic replay treatment

## 4.2 Visual hierarchy

During live gameplay, the eye priority is:

1. ball
2. immediate opponent / teammate interacting with the ball
3. controlled player body orientation
4. pass or shot target space
5. nearest tactical threats/support
6. scoreboard/time
7. technique/stamina state
8. crowd/environment

If a lighting, VFX, UI, crowd, or costume decision causes priority 6–8 to compete with 1–4, revise it.

## 4.3 Color philosophy

The environment should be rich but slightly less saturated than gameplay identifiers.

Neutral UI foundation:
- near-black navy: `#0B1020`
- deep slate: `#151C2D`
- soft off-white: `#F4F6F8`
- secondary text: `#AEB7C6`
- neutral line: `#313A4E`
- success: `#79D98A`
- warning: `#F0C35A`
- danger: `#F46B6B`
- interaction accent: `#D8F25A`

Do not hard-code team colors into functional states. Team identity colors are injected through tokens.

## 4.4 Team palettes

Public-safe identities are original.

### Blaugrena
- deep garnet
- saturated royal blue
- restrained warm gold
- technique identity: close control, angles, patience
- badge geometry: original angular woven motif, never a Barcelona crest derivative

### Royal Whites
- warm white
- midnight navy
- champagne accent
- identity: transition, precision, composure
- badge geometry: original geometric crownless monogram or orbital form

### Oil Company North
- sky blue
- charcoal
- copper accent
- identity: pressing, structure, passing triangles
- badge geometry: original industrial/northern abstract symbol

### Oil Company Capital
- deep navy
- crimson
- warm gold
- identity: speed, flair, direct attacks
- badge geometry: original metropolitan radial mark, not a PSG crest derivative

Public builds cannot use exact protected crests, sponsor logos, copied jersey graphics, or real-player likenesses.

---

# 5. Camera specification

The camera is a control instrument, not a movie camera.

## 5.1 Default live-play camera

Initial tuning values, subject to measured playtest revision:
- camera target height: 1.30–1.45 m above player root
- camera distance: 5.0–6.2 m depending on speed and possession
- camera vertical offset: 2.7–3.5 m above ground
- shoulder offset: 0.35–0.55 m
- Three.js vertical FOV: 53–57° at 16:9
- sprint FOV expansion: at most +2.5°
- shot-preparation FOV contraction: at most -2°
- no large “speed FOV” pulse
- near plane chosen to avoid clipping without sacrificing depth precision

These values are a starting envelope, not immutable truth. The AI must keep a camera tuning matrix and record playtest scores for each candidate.

## 5.2 Camera responsiveness

- mouse/right-stick look responds on the next rendered frame
- camera rotation must not wait for locomotion animation
- positional smoothing may use a critically damped spring
- positional lag target: subtle, equivalent to roughly 70–110 ms settling, never direct input lag
- rotation lag from direct player look: effectively zero beyond smoothing needed for jitter
- automated ball framing can blend over 120–180 ms
- auto-framing strength falls toward zero while the user actively moves the camera

## 5.3 Ball awareness

Optional ball-lock/assist:
- never teleports camera
- never snaps more than a controlled angular rate
- disengages instantly on manual camera override
- offscreen ball indicator appears only when needed
- indicator size and edge position encode direction, not distance precision

## 5.4 Aim language

Passing/shooting should use a small central aiming language rather than giant projected rails.

Use:
- center reticle
- charge arc/ring only during preparation
- optional subtle predicted direction cone
- color/state shift when a valid teammate target is strongly aligned
- no fake guarantee marker for outcomes that physics may change

## 5.5 Camera collision

- camera cannot pass through arena walls/players
- collision correction must preserve orientation
- recovery from obstruction blends rather than snaps
- debug overlay displays collision distance and correction rate

## 5.6 Replay cameras

Replay is allowed to be cinematic:
- player follow
- ball follow
- sideline broadcast
- tactical overhead
- low goal-line
- free orbit
- hero close-up after exceptional goal

Live camera and replay camera are separate systems.

---

# 6. Input and responsiveness specification

## 6.1 Fundamental principle

**Animation may decorate intent but cannot veto valid intent without a gameplay reason.**

## 6.2 Local response budget

At 60 FPS:
- direct camera response: <= 1 frame
- movement feedback onset: <= 1 frame visually
- body locomotion transition clearly readable: <= 50 ms target
- UI button response: <= 1 frame for visual state
- shot/pass input acknowledgement: <= 1 frame via pose/charge/audio/UI
- gameplay simulation uses fixed step independent of render FPS

The AI must instrument input timestamp → simulation application → rendered acknowledgement.

## 6.3 Consistency over occasional perfection

Research on latency and jitter supports prioritizing stable response.

Rules:
- avoid variable animation buffering
- avoid frame-time spikes during input-heavy moments
- network prediction must make local control immediate
- reconciliation correction should be measured and smoothed only visually
- never add random latency for dramatic animation

## 6.4 Action buffering and cancellation

Short buffers are acceptable where they act on obvious player intent.

Examples:
- buffer pass/kick input briefly while an eligible first-touch transition is about to occur
- allow a kick preparation cancel before the irreversible contact window
- allow trap cancel when the ball state changes
- do not queue multiple skill moves invisibly

Every buffered action must have:
- maximum buffer duration
- visible state if meaningful
- cancellation condition
- test coverage

---

