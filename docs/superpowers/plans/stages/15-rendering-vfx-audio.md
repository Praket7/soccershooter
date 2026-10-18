# Stage 15 — Rendering, Lighting, VFX, Audio, and Premium Presentation

## AI execution mode

**Primary AI role:** Rendering/VFX/Audio Agent

This stage is executed by AI under `docs/ai/AI_EXECUTION_CONTRACT.md`. Before any change, the worker must read `/DESIGN.md`, the master plan, this stage, the previous gate, and every subsystem document linked below. The AI must produce the cheapest measurable proof first, write tests before implementation where applicable, capture evidence, and stop rather than beginning a future stage when this stage's gate fails.

**Required AI output for this stage:** implementation or artifact changes, automated tests/validators, evidence paths or reproducible seeds, a concise worker handoff, and the stage gate report. “Looks good” and “runs locally” are not acceptance evidence.


> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Use checkbox steps for progress.

**Tech Stack:** Three.js WebGLRenderer, Web Audio, PBR, postprocessing, performance harness

**Spec:** `docs/superpowers/specs/2026-10-17-soccershooter-design.md`  
**Master:** `docs/superpowers/plans/2026-10-17-soccershooter-master.md`

## Global Constraints

- No credit card, paid/timed trial, or adult-only account dependency.
- `FICTIONAL_PUBLIC` is the only deployable content mode.
- Simulation correctness outranks presentation shortcuts.
- Tests and measured gate evidence are required before the next stage.
- Do not implement later-stage scope unless a minimal interface is required to test this stage.

## Review Focus

- effects hiding the ball
- screen-shake discomfort
- postprocessing frame spikes
- GPU resource leaks
- quality settings affecting simulation

## Planned File Map

- `apps/web/src/render/Renderer.ts`
- `apps/web/src/render/QualityPreset.ts`
- `apps/web/src/render/Lighting.ts`
- `apps/web/src/render/PostFX.ts`
- `apps/web/src/vfx/GameplayVfx.ts`
- `apps/web/src/audio/AudioDirector.ts`
- `apps/web/src/render/resourceLifecycle.test.ts`
- `tools/perf/render-benchmark.ts`

---

**Goal:** Convert the mechanically strong game into a visually and sonically premium experience without sacrificing latency/readability.

**Architecture:** Three.js WebGLRenderer first. Effects scale by quality preset. Use measurement to decide whether WebGPU later provides a real benefit.

## Renderer quality ladder

### Low
- lower DPR cap
- smaller shadows
- reduced crowd
- minimal postprocessing
- reduced particles

### Medium
- balanced shadows/crowd
- limited bloom
- standard particles

### High
- stronger shadow resolution
- denser crowd
- higher reflection/environment quality
- additional contact effects within frame budget

## Required rendering systems
- PBR/color-management baseline
- environment lighting
- tone mapping
- dynamic resolution/DPR cap
- shadow quality presets
- frustum culling
- instancing
- LOD
- texture streaming/load staging
- GPU resource disposal

## VFX intensity ladder
Normal actions stay quiet.

Small:
- normal pass/touch/tackle dust/grass

Medium:
- strong shot
- clean skill beat
- keeper save

Large:
- elite technique goal
- match winner
- campaign boss/final

Do not use constant screen shake or particles that obscure the ball.

## Camera feedback
- light impact impulse
- optional sprint speed feel
- short goal emphasis
- separate camera-shake strength setting including OFF

## Audio
Free/local pipeline:
- Audacity
- self-recorded Foley
- CC0/public-domain assets with provenance
- original music in LMMS/MuseScore if used

Audio layers:
- foot/ball contact by action strength
- turf steps/slides
- post/net
- crowd intensity
- whistle/restart
- UI
- technique stingers used sparingly

## WebGPU decision gate
Build a benchmark scene and compare WebGL vs WebGPU only if:
- WebGL is proven CPU submission-bound or feature-limited
- visual stack parity exists
- target browsers pass

Do not switch for novelty.

## Implementation Task Sequence

- [ ] **Task 1:** Write screenshot/resource-lifecycle tests and effect/simulation-isolation tests.
- [ ] **Task 2:** Implement renderer baseline, color management, environment lighting, tone mapping, and DPR cap.
- [ ] **Task 3:** Implement low/medium/high quality presets that never alter gameplay values.
- [ ] **Task 4:** Implement selective shadows, LOD, instancing, culling, and resource disposal.
- [ ] **Task 5:** Implement restrained contact, shot, tackle, save, and goal VFX intensity ladder.
- [ ] **Task 6:** Implement camera impact/sprint/goal feedback with accessibility sliders including OFF.
- [ ] **Task 7:** Implement layered audio director and create/collect rights-clean sounds with provenance.
- [ ] **Task 8:** Profile representative matches and benchmark WebGPU only if WebGL evidence justifies the experiment.

## Tests
- effects disabled do not change simulation hash
- audio/VFX rollback events deduplicate correctly
- quality preset changes never affect gameplay values
- resource lifecycle test detects leaked textures/render targets
- screenshot regression catches broken color management

## V2 visual-feel rules

Use `/DESIGN.md` as the binding visual contract. Live presentation follows the four-tier feedback ladder: ordinary actions quiet, strong actions compact, exceptional actions amplified, goals celebratory. Screen shake is never constant. Heavy DOF/motion blur/chromatic aberration are not live-play defaults.

Blender lookdev and Three.js output must be compared with captured side-by-side frames; no assumption of color/material parity is accepted without evidence.

## Exit gate
- premium arena + hero character reaches shareable video quality
- normal play remains readable
- high preset still meets target hardware frame budget
- low preset materially reduces cost
- ball never disappears under effects
- audio makes contact strength/timing understandable without HUD
