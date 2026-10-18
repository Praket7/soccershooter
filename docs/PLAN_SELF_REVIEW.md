# Plan Package Self-Review

This V2 package was checked after the AI-centered design, art, Blender, authentication, and leaderboard additions.

## Structural checks

All **21 execution stages** (Stages 01–20 plus Stage 17A) were checked.

Every stage:
- begins with its stage title
- contains an `AI execution mode` section that tells the working agent how to operate
- names the relevant implementation surface and expected evidence
- links back to the binding design/master specifications where applicable
- contains executable checklist tasks
- ends with a measurable exit gate or stage gate requirement

The package also contains dedicated source-of-truth documents for:
- visual/game-feel specification (`/DESIGN.md`)
- AI orchestration (`/docs/ai/AI_EXECUTION_CONTRACT.md`)
- the 192-image reference program (`/docs/art/FULL_IMAGE_PLAN.md`)
- Blender + Blender MCP + `nicceasy/3d-product` (`/docs/tools/BLENDER_AI_PIPELINE.md`)
- authentication, profiles, saves, and authoritative leaderboards (`/docs/backend/AUTH_LEADERBOARDS.md`)

## Consistency checks

- Public runtime content is fictional/original by default.
- Private real-name/number reference mappings remain local and undeployable.
- Simulation and physics are deterministic before multiplayer is introduced.
- Bots read simulation state, not renderer state.
- Final art scaling is blocked until greybox feel is proven.
- The visual target is credible stylized realism, not responsiveness-sacrificing photorealism.
- Blender assets must be visually verified and then re-verified in the actual Three.js runtime.
- `/3d-product` is used for its research, measured-reference, greybox, material, lighting, composition, versioning, and QA discipline; optional paid render/finishing services are not required.
- Blender MCP is local-first, checkpointed, and treated as code execution with explicit trust boundaries.
- Networking is server-authoritative and shares simulation code.
- Replays are built on deterministic inputs/events and versioned checkpoints.
- Competitive leaderboard entries can only be finalized by trusted server logic; clients cannot submit arbitrary scores as truth.
- Passwords are never stored directly by SoccerShooter application code. Authentication is delegated to a reviewed auth framework/provider; OAuth secrets never enter the client bundle or Git.
- Guest play and local saves remain available so account providers are not required to build or test the core game.
- Hosted auth/database adapters remain optional until their current age, card, trial, quota, and terms requirements pass the project constraint gate.
- Alpha content expansion is blocked until rematch/satisfaction data justifies it.
- No critical-path development tool requires a card, paid/timed trial, or adult-only developer account.

## Visual-reference checks

The image program specifies exactly **192 locked reference images**, including **48 golden targets** used for repeated AI visual comparison.

The plan requires:
- synchronized multi-view character references rather than unrelated generated portraits
- spatially consistent arena references rather than independent beauty shots
- UI references at target screen aspect/resolution with safe zones and hierarchy annotated
- action references with contact, planted foot, ball trajectory, momentum, and center-of-mass intent
- per-reference provenance, purpose, `copy`, and `avoid` metadata
- explicit rejection tags for anatomy, IP proximity, generic UI, spatial inconsistency, and style drift
- score gates before an image is promoted to locked or golden status

## AI-centered execution checks

The AI execution contract defines:
- one lead integrator as the final owner of coherence
- specialist agents with narrow scopes
- immutable/shared contracts before parallel work
- TDD and evidence-first implementation loops
- Blender checkpoint → edit → inspect → render → compare → export loops
- stage-gate evidence and handoffs rather than unsupported completion claims
- conversion of recurring feel bugs/exploits into automated regression tests where possible

## Scope check

The project is intentionally decomposed into progressive, independently reviewable plans rather than one giant prompt. This lets an AI agent keep a stable source of truth, work in bounded contexts, and prove each dependency before downstream systems rely on it.
