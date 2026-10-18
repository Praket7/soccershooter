# SoccerShooter Master Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task.

**Goal:** Build a premium-feeling browser football action game with deterministic physics, Road to Legend progression, useful adaptive bots, original public-safe art, bot-filled multiplayer, replays, and shareable highlights.

**Architecture:** A monorepo separates simulation, football physics, bots, protocol, progression, replay, content, and presentation. The same fixed-step simulation powers offline play, bot matches, automated tests, replays, client prediction, and server authority. Art is produced only after the greybox game passes mechanical quality gates.

**Tech Stack:** TypeScript, pnpm, Vite, Three.js, Rapier JS/WASM, Colyseus 0.18, Vitest, Playwright, Better Auth, SQLite→PostgreSQL, Blender 5.2 LTS, a local Blender MCP bridge, `nicceasy/3d-product` workflow principles, MPFB 2, glTF/GLB, glTF Transform/gltfpack, KTX2, FFmpeg, GitHub Actions.

**Primary product/visual spec:** `/DESIGN.md`  
**Architecture spec:** `docs/superpowers/specs/2026-10-17-soccershooter-design.md`  
**AI execution:** `docs/ai/AI_EXECUTION_CONTRACT.md`  
**Image plan:** `docs/art/FULL_IMAGE_PLAN.md`  
**Blender AI:** `docs/tools/BLENDER_AI_PIPELINE.md`  
**Auth/leaderboards:** `docs/backend/AUTH_LEADERBOARDS.md`

## AI-centered operating model

The project is deliberately written for AI execution. A **Lead Integrator Agent** owns the current stage and delegates bounded work to specialist agents using `docs/ai/AI_EXECUTION_CONTRACT.md`. Every worker receives explicit file ownership, tests, budgets, visual targets, stop conditions, and handoff requirements.

Agent roles include Gameplay/Simulation, Ball Physics, Camera/Input, Tactical Bots, Balance/Exploit, Blender/Assets, Character/Rig, Animation, Environment/Lighting, UI/UX, Auth/Persistence, Multiplayer/Netcode, Replay/Highlights, Performance, and QA/Red-Team.

The Lead must:
1. keep exactly one source-of-truth stage active;
2. convert playtest failures and exploits into reproducible tests;
3. prevent parallel agents from changing shared contracts simultaneously;
4. require evidence before accepting code or visual work;
5. stop future-stage work when a gate fails.

For Blender work, the AI is expected to operate Blender through MCP, create versioned checkpoints, render visual evidence, run validators, and prove the asset in the Three.js runtime. For account/leaderboard work, the AI must preserve guest-first local play and never implement plaintext credential storage.

## Global constraints

- no credit card requirement
- no timed or paid trial
- no adult-only account dependency
- local/open tooling preferred
- only `FICTIONAL_PUBLIC` is deployable
- private reference content is gitignored and undeployable
- public art uses original badges, kit layouts, sponsors, roster identities, and arena branding
- simulation is deterministic and rendering-independent
- each stage has a blocking exit gate
- final art cannot scale before greybox feel gates pass
- PvP has no adaptive difficulty
- bots never receive hidden physical advantages
- target stable 60 FPS
- target playable payload under 20 MB
- target first full arena streamed payload under 45 MB
- multiplayer is server authoritative
- first solo play does not require an account
- Google is preferred public sign-in, email is fallback, guest mode is mandatory
- passwords are never stored directly; competitive leaderboard results are server-authoritative
- 192-image locked visual reference library and 48-image golden target set precede mass final art
- Blender final assets use MCP + measured reference validation + in-engine proof

## Review focus

1. Render cadence must not alter simulation outcomes.
2. Private reference content must be impossible to ship accidentally.
3. Bot difficulty must never alter hidden physical capability.
4. Prediction divergence must be visible, measurable, and regression-tested.
5. Art assets must not silently break memory, draw-call, bundle, or frame budgets.

## North-star quality metrics

### Feel
- median movement responsiveness >= 8/10 in playtest scorecard
- median shooting/contact satisfaction >= 8/10
- >=70% of public-alpha testers voluntarily start another match after their first completed match
- no technique becomes an uncounterable dominant strategy in automated balance tournaments

### Performance
- normal 3v3 target >=60 FPS on declared reference desktop
- 1% low target >=50 FPS on the same scene
- no sustained fixed-step spiral-of-death
- no recurring >50 ms main-thread task during normal gameplay after loading

### Network
- 50/100/150 ms simulated RTT remains controllable
- loss/jitter tests cannot duplicate goals, touches, technique activations, or score events
- debug HUD exposes prediction/reconciliation error
- every goal is validated from authoritative server state

### Bots
- bots complete academy tasks
- bots make support and recovery runs
- bots pass under pressure
- bots do not form permanent ball swarms
- multiple tactical personalities remain viable
- lower difficulty loses through cognition/precision limits, not hidden physics nerfs

### Art
- one art bible
- all runtime external assets have provenance
- LOD/collision strategy exists for performance-critical assets
- final texture/brand art is deliberately authored/cleaned
- ball-contact animation timing matches simulation events

## Target repository

```text
apps/web
apps/server
packages/sim
packages/physics
packages/bots
packages/protocol
packages/content
packages/progression
packages/replay
packages/telemetry
packages/ui-contracts
tools/assets
tools/blender
tools/balance
tools/replay
tools/perf
private/reference-content
docs
```

## Stage map

| Stage | Name | Primary proof |
|---:|---|---|
| 01 | Product contract and measurement harness | metrics exist before scope expands |
| 02 | Monorepo, CI, deterministic simulation shell | reproducible builds and hashes |
| 03 | Player movement, camera, input | movement is fun with no ball |
| 04 | Premium ball physics | reproducible curve/bounce/roll/knuckle |
| 05 | Core football interactions | dribble/pass/shoot/defend loop is fun |
| 06 | Tactical bot foundation | bots occupy space and cooperate |
| 07 | Adaptive bots and learning lab | fair difficulty/personality |
| 08 | Techniques and evolutions | distinct counterable playstyles |
| 09 | Road to Legend | complete solo progression/no hard postgame cap |
| 10 | Team/roster content architecture | public/private content separation |
| 11 | Art bible and 2D image pipeline | coherent identity before 3D scale |
| 12 | Character modeling and rigging | one premium hero athlete in engine |
| 13 | Animation and sport motion | authored-looking physical contact |
| 14 | Arena/environment pipeline | one premium arena under web budgets |
| 15 | Rendering, lighting, VFX, audio | shareable presentation quality |
| 16 | UI, onboarding, accessibility | stranger can learn without explanation |
| 17 | Multiplayer and bot fill | authoritative 3v3 under simulated latency |
| 17A | Auth, cloud save, profiles, leaderboards | guest-first accounts + verified seeded leaderboard |
| 18 | Replay, highlights, growth hooks | goals create useful shareable media |
| 19 | QA, balance, security, optimization | regression suite and perf pass |
| 20 | Noncommercial alpha and growth iteration | testers voluntarily return |

## Dependency graph

```text
01 → 02 → 03 → 04 → 05 → 06 → 07
                       ↘ 08 → 09
05 → 10 → 11 → 12 → 13 → 14 → 15
05 → 16
02 + 05 + 06 → 17
02 + 09 + 16 → 17A
17 + 17A → verified online result persistence
05 + 16 + 17 + 17A → 18
all prior → 19 → 20
```

Art deliberately waits for gameplay.

## GitHub workflow

Recommended branches:
- `stage/01-product-contract`
- `stage/02-foundation`
- ...
- `stage/17A-auth-leaderboards`
- `stage/20-alpha`

Each stage gets:
1. a GitHub issue/checklist
2. an isolated branch/worktree
3. focused commits
4. CI
5. `docs/gates/STAGE-XX-GATE.md`
6. review
7. merge only after the gate passes

## Deployment posture

The architecture does not depend on cloud trials.

- static public-safe client can use GitHub Pages
- development multiplayer runs locally or on LAN
- server is self-hostable
- auth/persistence is self-hostable with Better Auth + SQLite/PostgreSQL
- hosted Supabase or another backend is optional and adopted only after current no-card/account-term verification
- public provider is an adapter choice, not the architecture
- if compliant free public server hosting is unavailable, the public alpha still ships Road to Legend and bot matches while multiplayer remains self-hostable/testable

## Explicit scope exclusions before alpha

Do not build:
- 11v11
- open world
- voice chat
- cosmetic store
- battle pass
- dozens of arenas
- dozens of unique skeletons
- massive RL model as a dependency
- cinematic face system
- mobile-first controls before desktop quality passes

## Final acceptance scenario

A new tester:
1. launches in browser
2. completes a short interactive tutorial
3. starts Road to Legend around 67 OVR
4. intentionally controls first touch and dribbling
5. passes to a bot making a real support run
6. scores with a curved or powered shot
7. unlocks/evolves a technique
8. completes a match in a premium arena
9. watches the buildup in replay
10. saves a short highlight
11. rematches voluntarily
12. can keep playing as a guest without account friction
13. can optionally link progress using Google or email
14. can post a verified seeded-challenge result to a server-authoritative leaderboard when authenticated
15. can later join a self-hosted/networked 3v3 match with the same core feel

When those conditions and the Stage 20 metrics pass, the plan has succeeded.
