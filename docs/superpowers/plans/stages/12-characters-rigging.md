# Stage 12 — Character Modeling, Materials, and Rigging

## AI execution mode

**Primary AI role:** Blender Character/Rig Agent

This stage is executed by AI under `docs/ai/AI_EXECUTION_CONTRACT.md`. Before any change, the worker must read `/DESIGN.md`, the master plan, this stage, the previous gate, and every subsystem document linked below. The AI must produce the cheapest measurable proof first, write tests before implementation where applicable, capture evidence, and stop rather than beginning a future stage when this stage's gate fails.

**Required AI output for this stage:** implementation or artifact changes, automated tests/validators, evidence paths or reproducible seeds, a concise worker handoff, and the stage gate report. “Looks good” and “runs locally” are not acceptance evidence.


> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Use checkbox steps for progress.

**Tech Stack:** Blender 5.2 LTS, MPFB 2, glTF/GLB, Meshopt/KTX2, asset validators

**Spec:** `docs/superpowers/specs/2026-10-17-soccershooter-design.md`  
**Master:** `docs/superpowers/plans/2026-10-17-soccershooter-master.md`

## Global Constraints

- No credit card, paid/timed trial, or adult-only account dependency.
- `FICTIONAL_PUBLIC` is the only deployable content mode.
- Simulation correctness outranks presentation shortcuts.
- Tests and measured gate evidence are required before the next stage.
- Do not implement later-stage scope unless a minimal interface is required to test this stage.

## Review Focus

- bad deformation
- too many materials
- oversized textures
- wrong scale/pivots
- missing LOD/collider

## Planned File Map

- `art/characters/source/hero.blend`
- `art/characters/source/archetypes.blend`
- `art/characters/export/hero.glb`
- `tools/blender/export_character.py`
- `tools/assets/inspect-glb.ts`
- `tools/assets/validate-character.ts`
- `packages/content/src/assets/characterManifest.ts`

---

**Goal:** Put one premium hero athlete in-engine using a scalable, free, rights-clean pipeline.

**Architecture:** MPFB supplies a CC0-friendly human base. Blender owns proportions, cleanup, original clothing, UVs, materials, hair, rig, skinning, LODs, collision, and export.

## Archetypes
- agile winger
- compact technician
- balanced midfielder
- power forward
- tall defender
- goalkeeper

Do not build unique topology per roster member.

## Initial hero budget
Profile and adjust, but begin around:
- LOD0: 20k–30k triangles
- LOD1: 8k–12k
- LOD2: 3k–5k
- shared skeleton
- tightly limited material slots
- 1–2K runtime textures unless gameplay-distance review proves a need for more

## Pipeline
1. MPFB base
2. proportions
3. topology/deformation cleanup
4. original kit
5. original boots
6. optimized hair
7. UVs
8. bake normals/AO where useful
9. shared rig
10. skin weights
11. deformation QA
12. source GLB export
13. optimization/compression
14. runtime validation

## Material library
- skin
- fabric
- boot
- hair
- eyes

Reuse material/shader patterns. Avoid unique material explosion.

## Face strategy
Gameplay-distance priority:
- head silhouette
- hairstyle
- brow/eye direction
- skin response
- basic blink/mouth/celebration morphs only if budget permits

Do not chase cinematic pore-level fidelity.

## Runtime validator reports
- triangles/vertices
- materials/draw calls
- texture size and estimated GPU memory
- bones
- LOD presence
- collider presence
- GLB size

## Implementation Task Sequence

- [ ] **Task 1:** Create MPFB-derived hero base and document source/license provenance.
- [ ] **Task 2:** Author proportions, topology cleanup, original kit, boots, hair, UVs, and shared materials in Blender.
- [ ] **Task 3:** Create shared skeleton and complete skin weighting.
- [ ] **Task 4:** Create LOD0/LOD1/LOD2 and gameplay collision proxy.
- [ ] **Task 5:** Write/export Blender automation with stable units, pivots, naming, and orientation.
- [ ] **Task 6:** Optimize exported GLB and textures through the web asset pipeline.
- [ ] **Task 7:** Run character validator for triangles, materials, texture memory, bones, LODs, collider, and size.
- [ ] **Task 8:** Pose-test sprint, kick, slide, bicycle, and keeper deformation before gate approval.

## V2 AI Blender production requirements

Follow `docs/tools/BLENDER_AI_PIPELINE.md`. The Blender agent must operate through a local Blender MCP bridge with checkpoints, scene inspection, viewport/render evidence, and automated validation. Use `nicceasy/3d-product` principles for measured reference matching and review sheets, adapted to runtime constraints.

Before scaling the roster, complete one full representative athlete pipeline including LOD0/1/2, public-safe kit, rig, materials, core clips, GLB export, and in-engine proof. No Blender render alone can pass this stage.

## Exit gate
One hero athlete:
- deforms cleanly in sprint/kick/slide/bicycle poses
- imports at correct scale/orientation
- has LODs and collider
- fits measured budget
- contains no copied kit/logo asset
- looks premium at gameplay distance
