# SoccerShooter — Start Here

This is the exact sequence for turning the planning package into a real project.

## Step 1 — Create the GitHub repository

Create a new empty repository named something like:

```text
SoccerShooter
```

Recommended:
- private while building
- no generated README/license/gitignore if you want to import this package cleanly
- default branch `main`

The connected GitHub actions used during planning can edit an existing repository but do not create the repository itself, so this one manual repository-creation step is required unless you create it another way.

## Step 2 — Clone locally

```bash
git clone <YOUR_REPO_URL>
cd SoccerShooter
```

## Step 3 — Copy this planning package into the repo

Copy the contents of `SoccerShooter_AI_Centered_Build_Plan/` into the repository root.

Then:

```bash
git add .
git commit -m "docs: add SoccerShooter AI-centered production plan"
git push origin main
```

## Step 4 — Install required local tools

Critical path:
- Git
- Node.js current LTS
- pnpm
- Python 3.11+
- `uv` recommended for Python tooling
- Blender 5.2 LTS
- FFmpeg

Later/local services:
- PostgreSQL
- Mailpit

No paid engine, no cloud trial, no credit card required for the development path.

## Step 5 — Install the 3d-product skill/workflow locally

From the game repo, if using a compatible agent environment such as Claude Code:

```bash
npx 3d-product --project
```

If that installation route changes, clone/read:

```text
https://github.com/nicceasy/3d-product
```

SoccerShooter uses the workflow discipline, not its paid optional production stack.

Mandatory path:
- Blender
- Cycles/Eevee
- local scripts
- FFmpeg

Optional/not required:
- Octane
- DaVinci Resolve Studio
- paid AI generation
- cloud render nodes

## Step 6 — Install/configure Blender MCP

Choose a local MCP bridge.

Preferred characteristics:
- localhost only
- scene inspection
- screenshots/renders
- reversible edits
- explicit trust before arbitrary Python

Configure the agent so it can control only the SoccerShooter Blender workspace. Create a test `.blend`, ask the agent to create a cube, render a neutral preview, undo/revert, and save a versioned file. Do not begin character generation until this plumbing test passes.

## Step 7 — Begin Stage 01, not art

Create branch/worktree:

```bash
git switch -c stage/01-product-contract
```

The implementing AI reads:
1. `AGENTS.md`
2. `DESIGN.md`
3. `docs/ai/AI_EXECUTION_CONTRACT.md`
4. architecture spec
5. master plan
6. Stage 01

Stage 01 creates the measurement contracts before gameplay expands.

## Step 8 — Stage 02 scaffolds the monorepo

Only after Stage 01 gate passes.

Expected top-level code structure:

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
```

## Step 9 — The first real playable milestone

Do **not** try to make the final game immediately.

Build this first:
- greybox pitch
- capsule/player placeholder
- third-person camera
- keyboard/mouse + gamepad input contract
- physical ball
- move
- receive
- close dribble
- ground pass
- driven shot
- simple goal detection
- one simple keeper/defender bot
- deterministic replay seed
- metrics overlay

No final character, kit, crowd, menu hero scene, or expensive art.

The first milestone passes only when the movement/ball loop feels good enough to replay voluntarily.

## Step 10 — Convert every bad feel/exploit into evidence

Examples:
- “turning feels delayed” → input-to-motion trace + playtest matrix
- “shot feels weak” → contact/speed/audio/VFX comparison
- “bot never passes” → scenario regression test
- “I can win by sprinting in circles” → exploit bot
- “camera makes me sick” → camera tuning matrix + shake reduction test

This is how the reference games improved quickly without losing control of the project.

## Step 11 — Lock art references only after greybox quality

Then execute Stage 11 and `docs/art/FULL_IMAGE_PLAN.md`:
- 192 locked references
- 48 golden targets
- six synchronized character blueprint sets
- four public-safe team identity systems
- Foundry spatial reference package
- HUD/menu target frames
- action pose sheets

## Step 12 — Prove one Blender athlete end to end

Before a roster:
- one balanced midfielder
- one kit
- one ball
- LOD0/1/2
- rig
- initial football clips
- GLB export
- KTX2 materials as appropriate
- in-engine screenshots
- performance test

Only after that pipeline is green do agents scale content.

## Step 13 — Add accounts after the solo product exists

Stage 17A adds:
- guest mode remains default-capable
- Better Auth local/self-hosted backend
- email fallback
- Google preferred sign-in adapter
- account linking
- cloud-save revisioning
- server-verified daily/weekly/Road-to-Legend leaderboards

Do not build auth before it has something valuable to save.

## Step 14 — Multiplayer after shared simulation is stable

Multiplayer wraps the same simulation:
- authoritative server
- local prediction
- reconciliation
- remote interpolation
- bot fill
- latency/loss simulator

Never create a second set of football rules only for networking.

## First action to take now

Create the empty GitHub repository and provide its URL to the implementing agent. Then import this package and execute Stage 01 from a dedicated branch/worktree.
