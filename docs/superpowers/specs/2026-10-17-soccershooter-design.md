# SoccerShooter Architectural Design Specification

> **V2 source-of-truth notice:** `/DESIGN.md` is now the binding visual/UI/game-feel specification. `docs/backend/AUTH_LEADERBOARDS.md`, `docs/art/FULL_IMAGE_PLAN.md`, `docs/tools/BLENDER_AI_PIPELINE.md`, and `docs/ai/AI_EXECUTION_CONTRACT.md` extend this architecture spec. When presentation details conflict, `/DESIGN.md` wins.


**Date:** 2026-10-17  
**Status:** Planning baseline  
**Product:** Noncommercial prototype and public-safe alpha  
**Primary platform:** Browser, desktop-first  
**Secondary input:** Gamepad  
**Optional later platform:** Touch/mobile after desktop quality gates pass

## 1. Product intent

SoccerShooter is a third-person football action game designed to combine the immediacy and shareability of a browser shooter with the creativity, ball mastery, and cooperation that make football satisfying.

The player controls exactly one athlete. The ball is never a cutscene prop. Movement, first touch, dribbling, passing, shooting, tackling, and aerial play are driven by deterministic physical state that can be learned and mastered.

The product contains two major loops powered by the same simulation:

1. **Road to Legend.** Start around 67 OVR, develop techniques and mastery, face smarter teams, complete a genuinely beatable elite campaign, then continue indefinite Legacy progression.
2. **Arena Football.** Quick 3v3 and 4v4 matches with humans when available and useful bots filling missing seats so low concurrency never makes the game feel empty.

## 2. Market/experience wedge

SoccerShooter is not browser FIFA and is not a reskin of an existing action-football game.

Its wedge is:
- physics-first ball behavior
- technique evolutions that change play instead of only increasing numbers
- cooperative bots that understand space and support
- a satisfying zero-concurrency solo mode
- football-aware tutorials and tactical replay
- instant browser access
- automatic highlight creation
- visual spectacle concentrated around exceptional actions rather than constant noise

## 3. Design pillars

### Easy first minute, hard thousandth hour
A new player can move, pass, and shoot quickly. Mastery comes from contact angle, foot choice, body orientation, timing, spin, anticipation, deception, tactical positioning, and technique combinations.

### The ball is the star
Ball state includes position, linear velocity, angular velocity, contact history, and possession context. Animation responds to ball state rather than replacing it.

### Football behavior must be mechanically valuable
Passing lanes, support runs, defensive cover, space creation, and transition decisions must be rewarded by outcomes. Endless spinning, selfish dribbling, and tackle spam must not become dominant simply because the engine accidentally favors them.

### Bots should improve the experience
A human should prefer a good SoccerShooter bot to an obviously uncooperative random teammate. Bots understand roles, passing lanes, support angles, recovery runs, ball trajectory, and match state. Difficulty changes cognition/precision, not secret physics advantages.

### Premium feel comes from coherence
A smaller set of excellent animations, effects, sounds, and environments is better than a large set of inconsistent generated content.

## 4. Game modes

### Road to Legend
- starts around 67 OVR
- player chooses an initial archetype but remains flexible
- short match/challenge encounters
- temporary run choices plus permanent technique/mastery progression
- increasingly sophisticated AI tactics
- elite final tournament is difficult but beatable
- Legacy rank continues after campaign completion
- no monetization or pay-to-win in this prototype

### Quick Match
- 3v3 default
- 4v4 secondary
- bot-filled immediate start
- humans replace bots only at safe boundaries
- fast rematch
- parties deferred until core networking is proven

### Training Academy
- shooting/curve/knuckle lab
- first touch and dribbling
- passing lanes
- off-ball support
- defensive timing
- goalkeeper basics

### Seeded Challenges
Deterministic local daily/weekly seeds before any live-service dependency.

## 5. Team identities and content modes

Deployable public teams:

| ID | Display name | Football identity | Palette direction |
|---|---|---|---|
| `blaugrena` | Blaugrena | technical possession | deep garnet, blue, warm gold |
| `royal_whites` | Royal Whites | elite transition | white, navy, champagne gold |
| `oil_north` | Oil Company North | positional press | sky blue, charcoal, copper |
| `oil_capital` | Oil Company Capital | speed/flair | navy, crimson, warm gold |

Public assets use original badge geometry, typography, sponsor graphics, kit layouts, and fictional rosters.

Private reference mode may locally map real names, shirt numbers, broad attributes, and technique notes for comparison. It is gitignored, visibly watermarked, and blocked from production builds.

## 6. Controls

Desktop baseline:
- WASD movement
- mouse camera/aim
- Shift sprint
- LMB context shot/kick, hold for power
- RMB precision/controlled touch mode
- E pass
- Q technique modifier
- Space aerial/jump
- Ctrl/C defensive action
- 1–4 technique slots
- Tab tactical/replay overlay when applicable

All controls are remappable before public alpha. Gamepad maps to the same action intents.

## 7. Simulation architecture

Deterministic fixed-step simulation.

- online authority: 30 Hz server gameplay step
- ball/contact substeps: up to 120 Hz where needed
- local prediction: same shared step functions
- rendering: uncoupled 60–144+ Hz

Authoritative state:
- player transform and movement state
- ball position/velocity/angular velocity
- stamina/cooldowns
- possession/contact metadata
- gameplay-relevant technique/action state
- score, clock, restart state

Presentation-only state:
- particles
- cloth/hair secondary motion
- camera shake/noise
- crowd animation
- cosmetic facial animation
- post-processing

## 8. Ball physics

Rapier handles general collision structure, but football-specific aerodynamics/contact live in deterministic shared code.

Baseline values:
- radius ~0.11 m
- mass ~0.436 kg
- gravity 9.81 m/s²

Flight includes:
- gravity
- quadratic drag
- spin-driven Magnus force
- bounded deterministic low-spin knuckle perturbation
- spin decay

Ground interaction includes:
- restitution
- tangential friction
- rolling resistance
- angular damping
- surface coefficient profiles

Player contact is impulse-based. Dribbling never welds the ball to the foot.

## 9. Player movement

Use a deterministic kinematic character controller with:
- acceleration/deceleration curves
- high-speed directional turn limits
- sprint stamina
- body orientation partially independent from camera aim
- collision resolution
- tackle commitment/recovery
- jump/aerial state

Animation presents the movement. Unrestricted animation root motion does not own multiplayer authority.

## 10. Skills

Initial families:

Dribbling:
- stepover
- double stepover
- roulette
- elastico
- rainbow flick
- body feint

Passing:
- driven pass
- lofted pass
- through pass
- trivela
- rabona

Shooting:
- driven shot
- finesse curl
- power strike
- chip
- knuckle
- outside-foot shot

Aerial:
- volley
- scissor
- bicycle
- diving header

Defense:
- contain
- standing challenge
- slide
- block
- interception read

Every technique consumes context, timing, balance, stamina, or cooldown and has readable counterplay.

## 11. Bot architecture

Hybrid deterministic production system:

1. simulation-derived perception
2. tactical blackboard
3. dynamic role assignment
4. utility action selection
5. predictive pass/shot/intercept models
6. movement steering
7. difficulty/personality modifiers
8. optional learned high-level policy experiments offline

Decision cadence:
- continuous steering targets
- tactical reevaluation around 10 Hz
- immediate event-driven response to critical ball events

Dynamic roles:
- ball carrier
- immediate support
- width/depth runner
- presser
- cover defender
- recovery runner
- goalkeeper

Adaptive PvE may alter reaction delay, observation noise, tactical horizon, pass risk tolerance, shot precision, skill repertoire, and coordination frequency. It may not alter secret top speed, stamina capacity, ball physics, or collider size.

Competitive PvP uses no adaptive difficulty.

## 12. Learned-bot research lane

Optional local experiments can use self-play or PPO/MARL in a simplified headless environment.

Use learned agents for:
- exploit discovery
- balance stress testing
- high-level tactical experiments
- policy diversity

Do not make the game depend on learned agents unless they outperform deterministic production bots on reliability, latency, corner cases, cooperation, readability, and tester preference.

## 13. Progression

OVR communicates progression but does not give permission to break physics.

Progression unlocks:
- technique slots
- techniques/evolutions
- bounded stamina efficiency
- bounded control forgiveness in solo mode
- tactical training assists
- prestige/cosmetics

Campaign has a real ending. Legacy progression continues through mastery, seeded challenges, modifiers, personal records, and cosmetic prestige.

## 14. Visual target

Style: stylized realism.

Priority:
1. silhouette and pose
2. animation/contact timing
3. material response
4. lighting
5. ball/contact VFX
6. facial detail

Hero athletes should look premium from normal gameplay distance without cinematic face budgets.

## 15. Art pipeline

Free/local authoring:
- Blender 5.2 LTS
- MPFB 2
- Krita/GIMP/Inkscape
- Poly Haven / ambientCG
- optional FreeMoCap/Pose2Sim/Posetrak
- Audacity and original/CC0 audio

Runtime contract:
- GLB/glTF
- Meshopt where beneficial
- KTX2/Basis textures
- explicit LODs
- collision proxies
- baked/static lighting where beneficial

Generated concept imagery is reference material. Untouched generated images are not automatically final textures or logos.

## 16. Character target

Six reusable body archetypes:
- agile winger
- compact technician
- balanced midfielder
- power forward
- tall defender
- goalkeeper

Initial hero target:
- LOD0 roughly 20k–30k triangles
- LOD1 roughly 8k–12k
- LOD2 roughly 3k–5k
- shared skeleton
- tightly limited material slots
- 1–2K runtime textures unless measurement proves more is necessary

## 17. Animation target

Approximately 70–90 polished clips before large content expansion.

Critical systems:
- 8-way locomotion
- acceleration/deceleration
- planted turns
- first-touch variants
- passes/shots
- defensive actions
- keeper saves
- aerials
- signature skills
- celebrations

Foot/ball contact frames are explicit gameplay events validated against simulation geometry.

## 18. Rendering

Start with Three.js `WebGLRenderer` for compatibility and predictable tooling. Benchmark `WebGPURenderer` later and adopt only if measured benefit plus material/post parity justify the switch.

Target features:
- PBR
- environment lighting
- intentional color management/tone mapping
- limited high-quality dynamic shadows
- baked/static light for environments where useful
- instanced/billboard crowds
- dynamic resolution
- conservative bloom
- controlled speed/impact VFX
- user-adjustable camera shake and motion effects

## 19. Multiplayer

Colyseus 0.18 authoritative rooms.

Requirements:
- input authority
- shared deterministic simulation
- local prediction/reconciliation
- remote interpolation
- deterministic bot prediction where appropriate
- rewind/lag compensation for contested checks only where fair
- authoritative goals/cooldowns/technique legality
- bot fill
- reconnect handling
- anti-cheat validation

Public cloud hosting is not required for the architecture. Local/LAN/self-host testing is first-class so the plan respects the no-card/no-trial constraint.

## 20. Replay and highlights

Record deterministic events plus periodic state checkpoints.

Features:
- full-match replay
- free camera
- tactical overhead view
- full goal buildup view
- 8–15 second highlight buffer
- 16:9 and 9:16 framing
- local capture/export path where browser APIs permit

Highlights should show the useful buildup, not only the final scorer.

## 21. Onboarding and accessibility

First session must:
- load quickly
- permit local/guest play
- teach movement, first touch, pass, and shot
- explain why passing and off-ball movement matter
- get the player into a real match quickly
- avoid menu overload

Settings before public alpha:
- remappable controls
- controller support
- camera shake slider/off
- motion effect slider/off
- color/contrast support
- subtitle/caption support for essential audio cues if voice/tutorial narration is added
- performance preset and resolution scaling

## 22. Growth principles

Growth mechanisms must arise from fun moments, not dark patterns:
- goal clips
- deterministic challenge codes
- daily/weekly seeded challenges
- personal records
- rematches
- replay/spectate
- visually distinctive arenas
- one-link launch
- later leaderboard adapter if a free compliant backend is available

## 23. Free-account constraint

The entire critical path must work with free/open-source local software and no credit card, paid trial, timed trial, or adult-only account.

## 24. Definition of “working”

A new tester can:
- open the game
- finish onboarding
- play Road to Legend
- play full bot matches
- intentionally use advanced techniques
- see convincing ball flight
- unlock progression
- play a local/self-hosted network match
- watch a replay
- create a highlight
- distinguish teams/arena identity
- maintain stable target performance
- finish wanting to rematch voluntarily

The strongest success signal is repeated voluntary play, not feature count.
