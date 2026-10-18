# SoccerShooter — Blender + Blender MCP + 3d-product AI Pipeline

## Goal

Give an AI agent a repeatable way to create premium runtime-ready game assets in Blender while preserving safety, reference fidelity, performance, and reviewability.

## Required tools

Critical path:
- Blender 5.2 LTS
- Python 3.11+
- a local Blender MCP bridge
- `nicceasy/3d-product` installed project-locally or available as an agent skill/reference
- Blender Cycles/Eevee
- glTF/GLB exporter
- glTF Transform / gltfpack
- KTX2/Basis tooling
- FFmpeg for review media

No required Octane, DaVinci Resolve Studio, paid AI-3D credits, cloud rendering, or trial service.

## Blender MCP choice

Preferred order:

### A. Safety-aware local bridge
Prefer a bridge with:
- localhost binding
- scene inspection
- visual snapshots
- reversible edits
- explicit session trust before arbitrary Python
- checkpoint/restore

`CallMeJones/blender-agent-bridge` is one researched example of this architecture.

### B. Blender Foundation MCP
Official lightweight MCP is acceptable in a dedicated project environment, but it can execute LLM-generated Blender Python with broad power. Use isolation and versioned saves.

### C. `ahujasid/mcp-for-blender`
Mature community fallback. Disable/ignore paid generation integrations. Use only local Blender and approved free assets on the critical path.

## Security contract

Before connecting the AI:
- save project under the SoccerShooter repo/workspace
- do not expose unrelated home folders or secrets
- create a checkpoint copy
- keep arbitrary script execution disabled until needed
- never paste provider secrets into `.blend` custom properties
- never allow the Blender agent to edit Git config or credentials

## 3d-product adaptation

Use `/3d-product` for its strongest habits:
- research first
- reference coverage
- measured modeling
- greybox lighting
- contact sheets
- composition proofs
- preview-cost ladder
- explicit gates
- scene-weight budget from first build
- version up instead of overwrite

Replace film-only assumptions with runtime constraints:
- triangle/vertex budgets
- LOD
- UV/texel density
- collision
- rigging
- animation-contact markers
- GLB
- runtime shader compatibility
- KTX2
- in-engine performance

## Asset pipeline

### B0 — brief and references
Inputs:
- asset brief
- golden references
- measurements
- target runtime camera distance
- budgets

Gate:
- reference coverage complete
- conflicting references resolved or logged

### B1 — scene/setup probe
Agent records:
- Blender version
- renderer
- GPU
- available VRAM
- output settings
- project units

Set units to meters.

### B2 — greybox
Use primitive geometry to prove:
- scale
- silhouette
- camera fit
- spatial function
- collision envelope

No surface detail.

### B3 — primary model
Build forms from measurements/references.

Agent must provide:
- front/side/3/4 renders
- wireframe
- dimensions report
- non-manifold check

### B4 — topology and LOD
Create runtime topology and required LODs.

Character targets:
- LOD0 20–30k tris
- LOD1 8–12k
- LOD2 3–5k

Environment props get role-specific budgets.

### B5 — UV and materials
- coherent texel density
- reuse material families
- PBR metallic-roughness
- avoid 4K textures where camera never resolves them
- create material swatch comparison

### B6 — rig/skin when relevant
Validate:
- shoulders
- elbows
- wrists
- hips
- knees
- ankles
- spine
- neck

For athletes test football poses, not only generic T-pose bends.

### B7 — animation when relevant
- in-place authoritative locomotion
- contact markers
- foot lock
- ball-contact event alignment
- cancellation/transition metadata exported separately

### B8 — lookdev
Use reference lighting to verify material, but do not optimize only for one cinematic light.

Required looks:
- neutral validation light
- flagship Foundry light
- bright/low-contrast stress light

### B9 — export
Export GLB using a deterministic preset.

Generate manifest with:
- source blend version
- triangle counts per LOD
- texture list/sizes
- material list
- skeleton/clip list
- bounds
- reference IDs

### B10 — automated validation
Reject on:
- non-manifold hero mesh where unintended
- invalid normals/tangents
- missing textures
- scale mismatch
- unsupported material features
- polygon budget violation
- texture budget violation
- duplicate material explosion
- bad animation range

### B11 — engine validation
Load asset in the actual Three.js runtime.

Capture:
- neutral screenshot
- gameplay screenshot
- profiler sample
- memory size
- draw calls

No Blender-only render can pass the asset by itself.

## AI MCP edit loop

For every mutation batch:
1. `inspect_scene`
2. save checkpoint
3. execute narrow edit
4. snapshot viewport
5. snapshot wireframe if geometry changed
6. run validation
7. compare against target
8. commit/revert decision

Prefer structured direct tools to arbitrary Python. Use arbitrary Python for repeatable operations that are difficult to express otherwise, and keep scripts in `tools/blender/` when they become project infrastructure.

## First required proof asset

Before any roster-scale generation, complete exactly one representative package:
- balanced midfielder archetype
- one public-safe home kit
- match ball
- 12 core locomotion/ball clips minimum
- LOD0/1/2
- GLB export
- in-engine material
- gameplay screenshot
- 60 FPS scene test

Only after this passes may the art team scale athletes/kits.
