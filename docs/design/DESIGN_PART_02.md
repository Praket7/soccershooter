# 7. Movement feel

## 7.1 Locomotion goals

The player should feel athletic rather than frictionless.

Characteristics:
- fast response to direction intent
- momentum visible but not sluggish
- sharper turns at lower speed
- broader arcs at full sprint
- believable deceleration
- separate facing and movement direction within limits
- short recovery after high-risk lunges

## 7.2 Movement states

Minimum runtime states:
- idle athletic
- walk
- jog
- sprint
- lateral shuffle
- backward movement
- sharp cut left/right
- decelerate/plant
- turn-in-place
- jump
- landing
- stumble/recover
- fall/get-up

## 7.3 Physicality and animation

Use in-place locomotion driven by simulation speed with:
- stride scaling within bounded range
- phase-aware foot locking
- pelvis/root offsets
- procedural lean based on acceleration/turning
- IK for foot ground contact
- motion warp only inside safe correction envelope

Do not let the animation root become the authoritative gameplay position.

---

# 8. Football skill-state architecture

Borrow the useful state-transition discipline from physics-based football research without making full RL humanoid control a runtime dependency.

Primary states:
- Move
- Receive/Trap
- Controlled Dribble
- Loose-Ball Chase
- Pass Prepare
- Pass Contact
- Shoot Prepare
- Shoot Contact
- Aerial Prepare
- Aerial Contact
- Defend/Contain
- Standing Challenge
- Slide Challenge
- Stumble/Recover
- Goalkeeper Ready
- Goalkeeper Dive/Catch/Parry

Transitions depend on both:
- user intent
- ball/world context

Every transition must define:
- eligibility
- contact target if any
- animation candidate set
- control freedoms while transitioning
- cancellation window
- failure behavior
- simulation event used for visual sync

---

# 9. Ball and contact feel

## 9.1 Ball visual standard

The ball must always feel like a separate physical object.

Required:
- continuous motion except legitimate high-speed frame sampling
- real angular velocity visible through texture rotation
- contact compression may be visually faked for 1–2 frames but cannot alter authority
- shadow/grounding must remain readable
- trajectory trail off by default in competitive mode; training mode may show it

## 9.2 Contact synchronization

Target:
- offline/local visible foot-to-ball contact within ±1 rendered frame of authoritative contact
- networked local predicted contact visually immediate, later reconciled if needed
- remote contact rendered from authoritative/interpolated history

A contact mismatch is a bug, not “animation style.”

## 9.3 Dribbling

Dribbling uses repeated physical touches and a control envelope.

Feel goals:
- close touches when moving slowly
- longer touches at sprint
- body orientation affects next touch
- aggressive turn risks a wider touch
- high skill/technique can reduce error envelope, not magically glue the ball

## 9.4 Passing

Passing feedback:
- subtle foot/back-leg windup
- direction readable from hips + aim reticle
- charge/power cue
- clean contact audio
- ball spin readable after launch
- teammate target indicator is advisory, not magnetic guarantee

## 9.5 Shooting

Shot preparation should communicate:
- intended direction
- approximate power
- body balance
- technique type

Shot types:
- driven
- finesse/whipped curl
- power
- chip
- outside-foot/trivela
- knuckle
- volley
- scissor
- bicycle
- header

Each has unique contact conditions and counterplay.

---

# 10. Animation quality specification

## 10.1 Required philosophy

The animation system must be:
- responsive
- readable
- contact-aware
- physically credible
- interruptible where gameplay allows
- consistent across archetypes

## 10.2 Animation library before content scaling

Target 70–90 polished clips/variants before large roster expansion.

Minimum categories:
- locomotion 20+
- turns/stops 10+
- dribble/touch 10+
- trap/receive 8+
- pass 8+
- shot 10+
- defense 8+
- aerial 8+
- falls/recoveries 6+
- goalkeeper 12+
- celebrations/idle can expand later

Exact counts may share procedural/mirrored variants.

## 10.3 Contact markers

Each ball interaction clip stores:
- approach foot
- plant foot
- contact frame/time
- contact bone
- expected ball-relative contact point
- allowed speed envelope
- allowed incoming ball-height envelope
- allowed body-facing delta
- post-contact follow-through window

## 10.4 Motion matching posture

Do not build a massive motion-matching system first.

Phase 1:
- state machine + blend spaces + contextual candidate selection

Phase 2 if data justifies:
- motion-matching-like search for locomotion/receiving using local feature vectors

No system is approved if selection cost or memory harms browser performance.

---

# 11. Character visual specification

## 11.1 Proportions

Stylized realism:
- elite-athlete body language
- recognizably human proportions
- slightly emphasized shoulder/leg silhouette for readability
- no superhero anatomy
- diverse height/build archetypes without caricature

Six base archetypes:
1. agile winger
2. compact technician
3. balanced midfielder
4. power forward
5. tall defender
6. goalkeeper

## 11.2 Runtime polygon targets

Per athlete:
- LOD0: 20k–30k triangles target
- LOD1: 8k–12k
- LOD2: 3k–5k
- distant/impostor strategy if later needed

Hair/accessories must have independent budget.

## 11.3 Face detail

Aim:
- believable from gameplay distance
- strong silhouette
- readable eyebrows/eyes/mouth in menus/replay
- no pore-level skin requirement
- no uncanny photorealism

## 11.4 Skin/materials

- PBR metallic-roughness
- skin roughness variation subtle
- sweat effect only situational and low-frequency
- avoid plastic sheen
- eyes must not glow or be over-wet

## 11.5 Kits

- fabric weave suggested primarily by normal/roughness, not huge geometry
- seams modeled/textured intentionally
- numbers legible at gameplay distance
- public names fictional
- team identity visible through large color blocks before tiny detail

---

# 12. Environment and arena specification

## 12.1 First premium arena: The Foundry

Identity:
- industrial football cathedral
- nighttime or late-evening flagship lighting
- steel truss architecture
- brick/concrete lower structures
- warm industrial practicals
- cool pitch floodlights
- restrained haze
- original team/event branding

The arena must look specific, not “generic stadium asset pack.”

## 12.2 Navigation landmarks

At least four persistent landmarks:
- one behind each goal
- one lateral landmark on each side

They must remain visible enough for subconscious orientation without distracting from the ball.

## 12.3 Pitch

- realistic dimensions appropriate to 3v3/4v4 action rather than regulation 11v11
- turf visual direction consistent from all cameras
- line markings crisp without aliasing
- subtle wear zones only if they aid realism
- pitch brightness controlled so white ball/lines remain distinct

## 12.4 Crowd

Crowd priority is atmosphere, not individual simulation.

Use:
- instancing
- LOD
- limited animation banks
- cards/impostors at distance if needed
- crowd color distribution that does not resemble active players

No crowd feature can threaten 60 FPS.

---

# 13. Lighting specification

## 13.1 Live gameplay lighting goals

- player and ball silhouettes readable from all gameplay angles
- no fully black faces
- no blown-out white kits
- ball remains distinguishable against pitch, wall, and crowd
- goals remain visually readable
- light direction helps depth perception

## 13.2 Flagship arena light hierarchy

1. stadium floodlights provide primary cool-neutral illumination
2. warm industrial practicals provide environment contrast
3. subtle atmospheric haze reveals beams only where plausible
4. emissive branding cannot become major uncontrolled light source

## 13.3 Exposure

Exposure remains stable during live play.

No dramatic auto-exposure pump when:
- looking at floodlights
- entering goal shadow
- opening menus

Replay may use a slightly more cinematic grade but never invalidate team colors.

## 13.4 Tonemapping

Use a consistent physically sensible tone-mapping path between Blender lookdev and Three.js. Test AgX-compatible/close workflows and verify by captured comparison rather than assuming perfect color parity.

---

# 14. PBR and material specification

Use glTF metallic-roughness conventions.

Every runtime material must define:
- base color
- roughness
- metalness
- normal behavior if needed
- AO only where appropriate
- alpha mode if relevant
- emissive only when physically justified

Material classes:
- skin
- fabric
- leather/synthetic boot
- painted metal
- raw metal
- concrete
- brick
- plastic
- rubber
- glass/polycarbonate
- turf
- net

AI agents must compare reference swatches and reject material values that merely “look shiny.”

---

# 15. Rendering and browser-performance specification

## 15.1 Renderer posture

Begin with Three.js WebGLRenderer for maturity and compatibility.

WebGPU is an optimization/feature experiment later, not a prestige checkbox.

## 15.2 Asset format

Runtime contract:
- GLB/glTF
- mesh compression where benchmarked beneficial
- KTX2/Basis textures
- explicit LODs
- collision meshes separated from visual meshes

## 15.3 Shadow budget

Real-time shadow maps are expensive because shadow-casting geometry is rendered again for each shadowed light.

Rules:
- very small number of shadow-casting key lights
- stadium floodlights may use grouped/optimized strategy rather than every fixture casting a shadow
- static environment may use baked/lightmapped contribution where it helps
- athlete/ball shadows prioritized

## 15.4 Postprocessing

Allowed live-play effects, restrained:
- tone mapping
- mild color grade
- modest bloom only for actual bright sources
- subtle vignette only if it does not obscure edge awareness
- optional light film grain at very low level, default off if it harms compression/readability

Avoid during live play:
- heavy depth of field
- heavy motion blur
- chromatic aberration as a constant filter
- lens dirt overlays

## 15.5 Performance targets

- 60 FPS target
- 1% low >= 50 FPS reference desktop
- no recurring main-thread task > 50 ms during normal play
- initial playable payload < 20 MB
- first premium arena streamed payload < 45 MB target
- graphics quality changes never alter simulation

---

# 16. Live-play VFX specification

## 16.1 Feedback tiers

### Tier 0 — ordinary
Examples: normal touch, simple pass, jogging.
- near-zero special effects
- natural audio and animation carry the action

### Tier 1 — strong
Examples: hard tackle, clean power pass, strong save.
- compact contact particles if material justifies
- brief camera impulse
- layered audio

### Tier 2 — exceptional
Examples: long-range curler, bicycle kick, match-winning save.
- stronger but bounded camera impulse
- short contextual trail or air effect
- crowd/audio surge
- optional brief time-emphasis only in replay, not competitive live state

### Tier 3 — goal celebration
- arena-reactive goal burst
- crowd surge
- scoreboard transition
- replay handoff

## 16.2 Screen shake

Screen shake is not an always-on signifier.

Settings:
- Off / Reduced / Full
- routine touch: none
- hard shot: tiny impulse
- post hit/save: small directional impulse
- goal: brief celebration pulse after ball validation

---

# 17. Audio feel specification

Audio is gameplay feedback, not background decoration.

Layers:
- footstep by surface and speed
- cloth/gear movement subtle
- kick transient
- ball body/resonance
- net impact
- wall/board impact where applicable
- turf slide
- tackle contact
- goalkeeper glove contact
- crowd bed
- crowd reaction system
- UI sound family

Important actions must have distinct sonic identity without requiring visual confirmation.

No copyrighted chants or recognizable club songs.

---

# 18. UI visual language

## 18.1 Identity

UI should feel like:
- elite sports timing equipment
- modern broadcast graphics
- technical training analysis
- premium action game

It should **not** feel like:
- finance dashboard
- mobile gacha menu
- sci-fi spaceship control panel
- generic esports template

## 18.2 Typography

Free/open default candidates:
- display/numerals: **Barlow Condensed SemiBold/Bold**
- body/UI: **Inter Medium/Semibold**

Self-host fonts in the build and preserve license files.

Rules:
- scores and countdowns use tabular numerals where possible
- uppercase used sparingly for labels, not paragraphs
- body text minimum comfortable desktop size
- avoid ultralight weights

## 18.3 Shape language

- mostly square/soft-rect forms
- 6–10 px radius typical at 1080p, not giant rounded cards
- thin line + solid fill hierarchy
- strong clipping/diagonal accent allowed for sports energy
- panels earn translucency only where the gameplay scene must remain visible

## 18.4 Motion language

Transitions:
- 120–220 ms typical UI microtransition
- ease-out entering
- ease-in leaving
- list changes may use small stagger < 120 ms total
- no transition blocks an urgent action
- user input can skip nonessential sequence

---

# 19. In-match HUD exact specification

HUD must survive 16:9 1080p first, then scale.

## 19.1 Top center

Contains:
- team identifiers
- score
- match clock
- phase/period if needed

Characteristics:
- compact
- opaque enough for every background
- team colors as edge/stripe, not entire text field

## 19.2 Center

Context-sensitive reticle:
- default minimal dot/mark
- pass state
- shot state
- valid-interaction feedback

Never cover the ball at normal distance.

## 19.3 Controlled-player state

Near lower center/controlled-player safe region:
- stamina
- active technique slot/cooldown if applicable
- temporary first-touch state only when useful

Avoid giant RPG bars.

## 19.4 Team awareness

Use:
- compact radar/minimap
- teammate identifiers
- offscreen teammate indicators only when tactically useful
- pass-call indicators

Radar must make “everyone chasing the ball” obviously undesirable.

## 19.5 Ball indicator

Only when:
- ball is offscreen
- vertical position is hard to infer

States distinguish:
- ground/low
- aerial
- behind camera

## 19.6 Communication

Quick ping/call system:
- pass request
- through run
- cover/hold
- pressure
- apology/thanks optional later

Spam cooldown required.

---

