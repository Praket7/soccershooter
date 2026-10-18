# Research Basis and Design Implications

This file records research that materially shaped the build plan.

## 1. Multiplayer and deterministic netcode

Colyseus 0.18 documents a server-authoritative approach with fixed simulation, client-side prediction, reconciliation, remote interpolation, and lag compensation/rewind patterns.

Sources:
- https://docs.colyseus.io/netcode
- https://docs.colyseus.io/netcode/client-prediction
- https://docs.colyseus.io/netcode/server-input
- https://docs.colyseus.io/netcode/lag-compensation

**Plan implication:** Networking shares the same deterministic simulation used offline. It is not a separate rules implementation added later.

## 2. Production sports-game AI

### Ubisoft Roller Champions RL agents

Paper: https://arxiv.org/abs/2012.06031

Useful lessons:
- small policies can run in real time
- simple game-state observations were practical
- self-play produced coordinated behavior
- learned agents exposed overpowered mechanics
- reward shaping was vulnerable to exploitation
- the strongest/latest policy was not always the most fun to play with

**Plan implication:** Production bot quality is judged on reliability, cooperation, readability, and fun—not only win rate. Learned agents are an optional lab, not the only bot implementation.

### MARLadona

Paper: https://arxiv.org/abs/2409.20326

Useful lessons:
- role emergence and self-play are valuable in soccer
- curricula make sparse soccer rewards easier to learn
- entity-based encoders help varying team composition
- learned policies can outperform heuristics
- corner cases/defensive behavior can remain weak

**Plan implication:** SoccerShooter uses deterministic role/utility logic for production safety and optional learned high-level policies for experiments/balance testing.

## 3. Dynamic difficulty

Relevant research includes:
- Xue et al., *Dynamic Difficulty Adjustment for Maximized Engagement in Digital Games*
- Guo et al., *Rethinking dynamic difficulty adjustment for video game design*
- recent DDA reviews surfaced through SciSpace

Findings are mixed enough that hidden rubber-banding is a bad default.

**Plan implication:** PvE can adapt cognition, reaction, tactical depth, and precision only at safe boundaries. Physics remains unchanged. Competitive PvP has no adaptive difficulty.

## 4. Soccer-ball aerodynamics

Relevant research includes:
- Paudel & Yan (2025), high-fidelity full-flight soccer-ball aerodynamics
- Mencke et al. (2020), flight and bounce of spinning sports balls
- soccer trajectory work on drag, lift, spin and seam effects
- impact-point work distinguishing straight, curve and knuckle kicks

Useful baseline from cited work:
- soccer-ball radius around 0.11 m
- representative mass around 0.436 kg
- spin materially changes lateral flight through Magnus force
- low-spin wakes are more unstable and can produce knuckling
- full CFD is too expensive for runtime and unnecessary for a game

**Plan implication:** Runtime uses a calibrated deterministic ODE approximation with drag, Magnus, spin decay, bounce/rolling coefficients, and bounded seeded low-spin perturbation.

## 5. Web 3D asset production

Useful sources:
- Khronos real-time asset guidelines: https://github.com/KhronosGroup/3DC-Asset-Creation
- meshoptimizer/glTF packing: https://meshoptimizer.org/gltf/
- Poly Haven license: https://polyhaven.com/license
- ambientCG license: https://ambientcg.com/license
- MPFB license: https://static.makehumancommunity.org/about/license.html

**Plan implication:** GLB/glTF is the runtime contract. Assets are optimized, compressed, LODed, validated, and separated from collision geometry before shipping.

## 6. Free local motion capture

Sources:
- https://freemocap.org/
- https://github.com/perfanalytics/pose2sim
- https://hkaimio.github.io/posetrak/

**Plan implication:** Sport-specific animation can be captured locally without a paid service, then cleaned and retargeted in Blender.

## 7. Browser 3D renderer posture

Current Three.js and PlayCanvas ecosystems support increasingly strong WebGPU paths, but renderer changes can have real post-processing/material compatibility costs.

**Plan implication:** Start on mature Three.js WebGLRenderer, profile first, and only move to WebGPURenderer after a benchmark proves the benefit and the visual stack reaches parity.

## 8. Player feedback from modern action football games

Current football-action discussions repeatedly surface pain around:
- selfish dribble metas
- weak teamwork education
- poor bot practice
- short replays that hide the buildup
- inconsistent client/server contact results
- weak solo-queue teammate quality

**Plan implication:** SoccerShooter teaches off-ball movement, rewards passing and support, provides useful bots, shows full-build-up replays, and treats network correctness as a gameplay feature.

## 9. Lessons from fast “vibe-coded” 3D games

The stronger rapid projects did not succeed by generating all art first. Their useful pattern was:
1. primitive prototype
2. repeated playtests
3. mechanical revision
4. automated bots/tests
5. deliberate art pipeline
6. polish after gameplay held up

**Plan implication:** final art is blocked until greybox football is fun.

## 10. Slopocalypse: first-party rapid-game workflow

Source:
- https://www.reddit.com/r/vibecoding/comments/1x55yeh/3d_vampire_survivors_style_arcane_game_with/
- https://slopocalypse.app/

Observed lessons from the creator's post/comments:
- an early idea was discarded because it was not fun enough
- core movement/combat/boss loop was proven with primitive geometry first
- playtest feedback was short and blunt, including camera shake, underwhelming abilities, and boring space
- the creator reached a difficult-but-fun winning run before major art investment
- art then used a generated/model/rig pipeline and optimized enemy animation for scale
- audio received its own audition workflow
- an exploit where standing still could win became an automated bot test
- separate agents handled stages while a lead session retained specs/review/tests/deploy responsibility
- type checks/tests/build gated deployment
- later player feedback specifically led to reduced screen shake and better readability

**Plan implication:** SoccerShooter converts feel/exploit failures into reproducible checks, blocks final art until greybox football passes, and gives audio/readability dedicated review gates.

## 11. Birds With Guns: first-party rapid multiplayer workflow

Source:
- https://www.reddit.com/r/vibecoding/comments/1x8bp9q/presenting_birds_with_guns_my_24_hour_challenge/

Observed lessons:
- prototype began with capsule characters, box city, bots, and objectives
- 20v20 was too chaotic, so the creator reduced it to 8v8 after playtesting
- movement/readability/aim systems were tuned before scaling art
- one rigged Sparrow proved the asset pipeline before the full class roster
- a scripted Blender kit supported map generation
- six maps were bot-tested for captures, kills, and stuck navigation before human review
- combat balance used modeled curves and bot reruns
- the authoritative server reused shared game logic supporting client prediction
- latency simulation and lag compensation were treated as gameplay quality
- bots filled empty seats so low concurrency did not make the game feel dead

**Plan implication:** one SoccerShooter athlete proves the complete 3D pipeline; bots validate arenas; server/client simulation contracts are shared; population/readability is tuned empirically rather than by prestige.

## 12. Game feel research

Paper:
- Pichlmair & Johansen, *Designing Game Feel. A Survey*, arXiv:2011.09201

Useful framework:
- physicality → tuning
- amplification → juicing
- support → streamlining

The paper surveys movement, collision, input assistance, audio/haptic feedback, particles, hit/impact signification, camera framing, persistence, and dynamic camera. It also emphasizes that perceived physicality can be communicated without literal simulation and that game feel emerges from layered feedback around player control.

**Plan implication:** SoccerShooter tunes movement/ball behavior first, adds amplification in proportion to event importance, and uses support systems to interpret player intent without removing skill.

## 13. Responsiveness versus naturalness

Research surfaced through SciSpace includes:
- Normoyle & Jörg, *Trade-offs between responsiveness and naturalness for player characters*
- Jörg et al., *How responsiveness affects players' perception in digital games*
- latency/jitter studies showing delay harms performance/experience and that variable delay is especially disruptive

**Plan implication:** animation cannot make controls late just to look natural. Camera response is immediate; animation acknowledges input immediately; stable frame pacing and prediction are product features.

## 14. PhysicsFC football-controller research

Paper:
- Kim, Jung & Lee, *PhysicsFC: Learning User-Controlled Skills for a Physics-Based Football Player Controller*, arXiv:2504.21216

Transferable ideas:
- explicit Move, Trap, Dribble, Kick skill states
- user intent and ball context jointly drive transitions
- close-control dribbling considers ball/player distance and target velocity
- trapping requires different logic before and after contact
- responsive transitions are central to making multiple football skills feel unified
- passing/shooting expose target direction and force rather than treating actions as one-button cinematics

**Plan implication:** SoccerShooter keeps its simpler browser-friendly simulation/animation architecture but adopts explicit skill eligibility, transitions, cancellation, contact metadata, and measurable contact synchronization.

## 15. REMATCH art/action-football research

Useful public interviews/art coverage consistently describe:
- third-person football as an action-game problem, not only a sports-simulation problem
- a goal of expressive, readable, energetic animation
- “credibility” over strict realism
- close one-player perspective to create embodiment and precise aim
- accessible basic mechanics with depth from timing, direction, curve, inertia, and context
- art direction built to support movement and team readability
- vibrant environments that remain believable and do not sacrifice visual clarity
- 60 FPS responsiveness as a central quality target

Sources include:
- ArtStation REMATCH Art Blast
- PlayStation Blog REMATCH hands-on
- Sloclap interviews in 2025 press

**Plan implication:** SoccerShooter targets Athletic Cinematic Realism: believable materials/weight/space with action-game responsiveness, not photorealistic simulation.

## 16. Browser PBR/rendering research

Sources:
- https://www.khronos.org/gltf/pbr/
- https://threejs.org/docs/pages/LOD.html
- https://threejs.org/manual/en/shadows.html
- Three.js tone-mapping/instancing examples

Useful points:
- glTF metallic-roughness PBR provides a portable physically grounded material contract
- LOD is a native strategy for distance-based complexity reduction
- shadow maps can multiply draw cost because shadow-casting geometry is rendered from each shadow-casting light
- tone mapping is both technical and artistic and must be validated against target look

**Plan implication:** runtime uses glTF PBR, explicit LODs, extremely selective dynamic shadow casting, instancing for repeated environment/crowd content, and captured Blender-vs-engine validation.

## 17. `nicceasy/3d-product`

Repository:
- https://github.com/nicceasy/3d-product

The skill describes a research-first, measured and gated Blender/product-film workflow. Particularly useful transferable practices:
- reference coverage matrix
- conflicts register
- measured modeling
- greybox lighting first
- composition analysis
- FIRST/KEY/LAST proof frames
- cheap preview ladder before expensive rendering
- scene-weight budgets from the start
- version-up rather than destructive overwrite
- measurable gate at every stage

Some referenced production options are paid/optional (for example Octane and DaVinci Resolve Studio), so SoccerShooter adopts the workflow principles while using Blender/Cycles/Eevee and open/local tooling on the mandatory path.

## 18. Blender MCP

Current options researched include:
- Blender Foundation MCP server
- `CallMeJones/blender-agent-bridge`
- `ahujasid/mcp-for-blender`

The key risk is that Blender MCP systems can execute LLM-generated Python with broad local power.

**Plan implication:** use local project isolation, versioned `.blend` checkpoints, visual evidence after mutation batches, reversible edits where supported, explicit trust before arbitrary Python, and no unrelated sensitive directory access.

## 19. Authentication and leaderboards

### Better Auth
Official docs support:
- self-hosted TypeScript integration
- SQLite/PostgreSQL databases
- email/password
- Google and other social OAuth providers
- account linking
- server-side session/account persistence

**Plan implication:** Better Auth is the canonical local/self-hosted layer so development never depends on a hosted trial/card.

### Google
Official Google Account Help says the general minimum age to manage one's own account is 13 for countries not specifically listed; official OAuth docs define web OAuth client creation and minimum-scope best practices.

**Plan implication:** Google is the preferred optional end-user sign-in, requesting only OpenID/email/profile; the developer setup is rechecked before public deployment.

### Supabase
Official current pricing/auth pages describe a free tier with Postgres, Auth, social OAuth, email/password, RLS, and Realtime. Supabase privacy materials say services are not intended for children under 13. Terms also reserve fraud/payment-verification controls.

**Plan implication:** Supabase is useful but optional. Current no-card/account terms must be verified at adoption. Self-hostable Better Auth/Postgres remains the architecture.

### Leaderboard integrity

**Plan implication:** the browser never directly creates competitive leaderboard records. The authoritative server finalizes a versioned result/replay hash and a trusted backend transaction writes the leaderboard input.
