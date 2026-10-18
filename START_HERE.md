# SoccerShooter — Start Here

**Repository bootstrap status:** complete on `setup/ai-build-plan`.

The planning package, AI operating contract, design specification, research basis, 21 stage plans, Blender pipeline, auth/leaderboard architecture, and tracked monorepo directory skeleton are already in this repository.

**The next step is local implementation of Stage 01 in a Work/local coding session. Do not start Stage 02 or final art first.**

## 1. Merge or check out the setup branch

Current planning branch:

```text
setup/ai-build-plan
```

Before implementation, either merge the reviewed setup PR into `main` or clone/check out the setup branch locally.

## 2. Local tool prerequisites

Critical path:
- Git
- Node.js current LTS
- pnpm
- Python 3.11+
- `uv` recommended
- Blender 5.2 LTS
- FFmpeg

Later local services:
- PostgreSQL
- Mailpit

No paid engine, cloud trial, or credit card is required for the development path.

## 3. Read before coding

The Stage 01 implementing AI must read in this order:

1. `AGENTS.md`
2. `DESIGN.md` and all linked design volumes
3. `docs/ai/AI_EXECUTION_CONTRACT.md`
4. `docs/superpowers/specs/2026-10-17-soccershooter-design.md`
5. `docs/superpowers/plans/2026-10-17-soccershooter-master.md`
6. `docs/superpowers/plans/stages/01-product-contract.md`
7. `docs/constraints/FREE_TOOL_MATRIX.md`
8. `docs/constraints/CONTENT_MODES.md`

## 4. Begin Stage 01 in isolation

Create a dedicated branch/worktree:

```bash
git switch -c stage/01-product-contract
```

Stage 01 creates the measurement contracts before gameplay expands:
- quality bar
- reference hardware declaration
- playtest scorecard
- asset provenance contract
- privacy-preserving telemetry schema
- performance measurement method
- bot/balance benchmark format
- stage gate report

Follow TDD where code/schema validation is involved.

## 5. Stage 01 must pass before Stage 02

Required gate file:

```text
docs/gates/STAGE-01-GATE.md
```

Do not move forward because files merely exist. Use the measurable exit conditions in the stage plan.

## 6. Stage 02 then turns the placeholders into the real monorepo

The repository already tracks the intended directories:

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
tools/security
private/reference-content
```

Stage 02 adds package manifests, TypeScript config, Vite, Vitest, Playwright, deterministic simulation shell, and GitHub Actions CI.

## 7. First playable milestone

After Stages 01–05, the first real game proof is intentionally ugly:
- greybox pitch
- capsule athlete
- third-person camera
- keyboard/mouse and gamepad input contract
- physical ball
- movement
- receive/trap
- close dribble
- ground pass
- driven shot
- goal detection
- basic keeper/defender bot
- deterministic replay seed
- metrics/debug overlay

No final character, kit, crowd, menu hero scene, or expensive art until this loop is genuinely fun.

## 8. Convert feel failures and exploits into evidence

Examples:
- turning feels delayed → input-to-motion trace + playtest matrix
- shot feels weak → contact/speed/audio/VFX comparison
- bot never passes → scenario regression test
- sprinting in circles wins → exploit bot
- camera causes discomfort → tuning matrix + reduced-motion comparison

Repeated complaints become tracked, reproducible checks.

## 9. Art only after the greybox gate

Stage 11 executes `docs/art/FULL_IMAGE_PLAN.md`:
- exactly 192 locked references
- 48 golden targets
- six synchronized athlete blueprint sets
- four public-safe team identity systems
- spatially consistent Foundry reference package
- HUD/menu targets
- action-pose sheets

## 10. Blender workflow

Before final athlete production, configure the local Blender MCP path described in:

```text
docs/tools/BLENDER_AI_PIPELINE.md
```

Use `nicceasy/3d-product` for its research-first, measured-reference, greybox, contact-sheet, preview-ladder, and gated-review discipline. Optional paid Octane/Resolve/cloud pieces are not required.

First prove one complete athlete:
- balanced midfielder
- public-safe kit
- ball
- LOD0/1/2
- rig
- representative clips
- GLB export
- runtime material validation
- in-engine screenshot
- performance test

Only then scale the roster.

## 11. Accounts and multiplayer come later

Stage 17 handles authoritative multiplayer after the shared simulation is stable.

Stage 17A adds:
- guest-first local play
- Better Auth local/self-hosted backend
- email fallback
- Google preferred sign-in adapter
- account linking
- cloud-save revisioning
- server-verified leaderboards

Never store plaintext credentials and never trust browser-authored competitive scores.

## Next action

Start a Work/local coding session and instruct the agent:

> Execute SoccerShooter Stage 01 from `docs/superpowers/plans/stages/01-product-contract.md`. Read `AGENTS.md` and every required source-of-truth document first. Work in an isolated `stage/01-product-contract` branch/worktree. Stop at the Stage 01 gate and provide verification evidence; do not begin Stage 02.
