# SoccerShooter — Production Build Plan Repository

This repository is the execution blueprint for **SoccerShooter**, a browser-first third-person football action game combining responsive physics, solo progression, useful adaptive bots, premium stylized-realistic presentation, 3v3/4v4 multiplayer, replays, and shareable goals.

This package intentionally contains **specifications and implementation plans, not game code yet**.

## Required reading order

1. `AGENTS.md`
2. `DESIGN.md`
3. `docs/ai/AI_EXECUTION_CONTRACT.md`
4. `docs/superpowers/specs/2026-10-17-soccershooter-design.md`
5. `docs/superpowers/plans/2026-10-17-soccershooter-master.md`
6. The current numbered stage in `docs/superpowers/plans/stages/`
7. The previous stage's gate report before implementing the next stage

## Core promise

At the end of the plan a new player should be able to open a browser, learn the controls quickly, play a complete Road to Legend loop against genuinely useful bots, execute skillful physics-driven football actions, and play self-hosted/networked 3v3 matches using the same underlying simulation.

## Non-negotiable constraints

- No credit card requirement.
- No paid or timed trial on the critical path.
- No adult-only account dependency.
- Prefer local/open-source tools.
- `FICTIONAL_PUBLIC` is the only deployable content mode.
- `REFERENCE_PRIVATE` may contain local real-name/number mappings for development comparison but is gitignored and blocked from release builds.
- Exact real club crests, sponsor marks, copied kits, player scans, and scraped face textures are not committed.
- Gameplay must be fun in greybox before final art scaling.
- Simulation is deterministic and shared across offline play, bots, replay, tests, and server authority.
- Every stage ends in a measurable gate.
- “It runs” is not a quality gate.

## Final target

The final noncommercial alpha should include:

- Road to Legend from an underdog starting point around 67 OVR to elite mastery
- endless Legacy progression after the campaign is beatable
- multiple original team identities inspired by football culture
- third-person movement and ball contact with high skill ceiling
- driven, finesse, chip, trivela, knuckle, volley, bicycle, dribble and defensive techniques
- adaptive/cooperative bots
- 3v3/4v4 server-authoritative multiplayer with bot fill
- replay and short highlight generation
- guest-first accounts with Google preferred and any-email fallback
- secure cloud-save abstraction
- server-verified daily/weekly/Road-to-Legend leaderboards
- one premium arena plus a reusable arena pipeline
- keyboard/mouse and gamepad support
- automated physics, balance, bot, browser, netcode, and performance testing
- GitHub Actions quality gates

## V2 AI-centered additions

This revision adds:
- `/DESIGN.md` — complete UI, game-feel, camera, animation, lighting, rendering, account, and leaderboard visual contract
- `docs/art/FULL_IMAGE_PLAN.md` — 192-image locked reference library and 48-image golden target workflow
- `docs/tools/BLENDER_AI_PIPELINE.md` — Blender MCP + `nicceasy/3d-product` runtime-asset workflow
- `docs/ai/AI_EXECUTION_CONTRACT.md` — lead-agent/specialist-agent operating model
- `docs/backend/AUTH_LEADERBOARDS.md` — Google/email auth, guest linking, cloud saves, and verified leaderboards
- Stage `17A-auth-profiles-leaderboards.md`

The AI is expected to execute tasks, tests, Blender edits, validation, and evidence capture directly. Human review is reserved for declared creative/feel gates.
