# Stage 14 — Arena, Stadium, and Environment Pipeline

## AI execution mode

**Primary AI role:** Blender Environment/Lighting Agent

This stage is executed by AI under `docs/ai/AI_EXECUTION_CONTRACT.md`. Before any change, the worker must read `/DESIGN.md`, the master plan, this stage, the previous gate, and every subsystem document linked below. The AI must produce the cheapest measurable proof first, write tests before implementation where applicable, capture evidence, and stop rather than beginning a future stage when this stage's gate fails.

**Required AI output for this stage:** implementation or artifact changes, automated tests/validators, evidence paths or reproducible seeds, a concise worker handoff, and the stage gate report. “Looks good” and “runs locally” are not acceptance evidence.


> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Use checkbox steps for progress.

**Tech Stack:** Blender, Three.js, glTF/GLB, KTX2, instancing, asset validators

**Spec:** `docs/superpowers/specs/2026-10-17-soccershooter-design.md`  
**Master:** `docs/superpowers/plans/2026-10-17-soccershooter-master.md`

## Global Constraints

- No credit card, paid/timed trial, or adult-only account dependency.
- `FICTIONAL_PUBLIC` is the only deployable content mode.
- Simulation correctness outranks presentation shortcuts.
- Tests and measured gate evidence are required before the next stage.
- Do not implement later-stage scope unless a minimal interface is required to test this stage.

## Review Focus

- draw-call explosion
- crowd overdraw
- physics using render mesh
- camera obstruction
- lighting reducing ball readability

## Planned File Map

- `art/arenas/foundry/source/foundry.blend`
- `art/arenas/foundry/export/foundry.glb`
- `apps/web/src/world/ArenaLoader.ts`
- `apps/web/src/world/CrowdSystem.ts`
- `packages/content/src/arenas/foundry.ts`
- `packages/physics/src/surfaces/turf.ts`
- `tools/assets/validate-arena.ts`
- `tools/blender/export_arena.py`

---

**Goal:** Create one premium, highly readable football arena and a reusable pipeline for future environments without blowing web budgets.

**Architecture:** Blender-authored modular environment, CC0 materials/props, baked/static lighting where appropriate, low-cost repeated crowds, separate collision meshes, GLB/KTX2 runtime assets.

## First arena: The Foundry
Original location, not a copy of a real stadium.

Visual goals:
- night match under industrial roof trusses
- strong directional stadium lighting
- distant city/industrial silhouettes
- premium turf response
- clear sidelines/goals
- crowd energy without visual noise
- team-color accents that change per match

## Arena modules
- pitch
- goals/posts/net visual system
- boards/barriers
- seating tiers
- structural trusses
- tunnels/entrances
- scoreboard
- crowd blocks
- sky/environment
- decals/signage

## Physics geometry
Use separate simple colliders:
- pitch plane/surface zones
- walls/boards
- posts/crossbar
- player boundaries
- out-of-play triggers

Never use complex render meshes directly as default physics colliders.

## Crowd strategy
- instanced low-detail bodies/cards
- small animation bank
- palette variants
- distance impostors/billboards
- no per-spectator expensive skeleton

## Lighting
- environment/HDR contribution
- one dominant shadow-casting sun/stadium direction where possible
- baked/static bounce/lightmaps as appropriate
- limited local non-shadow lights
- selective player/ball shadow quality

## Asset budgets
Measure:
- draw calls
- visible triangles
- texture GPU memory
- GLB download
- first-interactive load
- arena stream size
- shadow pass cost

## Tasks
- [ ] Build modular blockout and collision first.
- [ ] Validate camera/readability in live 3v3 before detail pass.
- [ ] Author/tune turf material.
- [ ] Build structural kit and stands.
- [ ] Add crowd system.
- [ ] Bake/author lighting.
- [ ] Add original signage/identity.
- [ ] Create LOD/instancing rules.
- [ ] Optimize GLB/KTX2 and run asset validator.

## Tests
- no render mesh required for gameplay collision correctness
- spawn/restart points valid
- camera never clips through normal environment path
- crowd system remains under draw-call budget
- arena can load/unload without leaked GPU resources

## V2 reference-driven environment workflow

Foundry production starts only from the spatially consistent R001–R028 arena reference set in `docs/art/FULL_IMAGE_PLAN.md`. The player-requested Argentine 3v3 street-court variant is R021 and must keep its compact hard-court identity distinct from Foundry. The Blender Environment Agent uses `docs/tools/BLENDER_AI_PIPELINE.md` and `/3d-product` greybox/lookdev principles. Top-down geometry and gameplay sightlines lock before decorative detail or atmospheric rendering.

## Exit gate
- arena looks shareable in a screenshot/video
- normal 3v3 stays inside frame budget
- arena streamed payload target <=45 MB
- pitch/ball readability remains excellent under effects
- no real stadium trademarks or copied architecture-dependent branding
