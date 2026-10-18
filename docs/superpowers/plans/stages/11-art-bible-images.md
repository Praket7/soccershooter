# Stage 11 — Art Bible and 2D Image Production Pipeline

## AI execution mode

**Primary AI role:** Lead Art/Reference Agent

This stage is executed by AI under `docs/ai/AI_EXECUTION_CONTRACT.md`. Before any change, the worker must read `/DESIGN.md`, the master plan, this stage, the previous gate, and every subsystem document linked below. The AI must produce the cheapest measurable proof first, write tests before implementation where applicable, capture evidence, and stop rather than beginning a future stage when this stage's gate fails.

**Required AI output for this stage:** implementation or artifact changes, automated tests/validators, evidence paths or reproducible seeds, a concise worker handoff, and the stage gate report. “Looks good” and “runs locally” are not acceptance evidence.


> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Use checkbox steps for progress.

**Tech Stack:** Krita, Inkscape, GIMP, Blender, WebP/AVIF/SVG/KTX2 export

**Spec:** `docs/superpowers/specs/2026-10-17-soccershooter-design.md`  
**Master:** `docs/superpowers/plans/2026-10-17-soccershooter-master.md`

## Global Constraints

- No credit card, paid/timed trial, or adult-only account dependency.
- `FICTIONAL_PUBLIC` is the only deployable content mode.
- Simulation correctness outranks presentation shortcuts.
- Tests and measured gate evidence are required before the next stage.
- Do not implement later-stage scope unless a minimal interface is required to test this stage.

## Review Focus

- inconsistent generated aesthetics
- low-contrast HUD
- badge imitation
- icons unreadable at size
- untouched generated final art

## Planned File Map

- `art/art-bible/README.md`
- `art/teams/blaugrena/`
- `art/teams/royal-whites/`
- `art/teams/oil-north/`
- `art/teams/oil-capital/`
- `art/ui/`
- `art/icons/techniques/`
- `art/arena/foundry/`
- `docs/ART_REVIEW_CHECKLIST.md`

---

**Goal:** Establish one coherent visual language before agents generate large amounts of inconsistent art.

**Architecture:** Source art remains editable and traceable. Runtime images are exported deliberately. AI-generated mood references, if used, are not automatically final assets.

## Art-bible boards
1. title/logo direction
2. four team identity boards
3. six body archetype silhouettes
4. kit language
5. badge/patch language
6. first arena mood board
7. HUD/menu language
8. technique icon system
9. VFX intensity ladder
10. replay/highlight graphic package

## Free tools
- Blender
- Krita
- GIMP
- Inkscape
- Poly Haven
- ambientCG
- self-created photography/reference where rights are clear

## Source formats
- `.kra`
- `.xcf`
- `.svg`
- `.blend`

## Runtime formats
- SVG for simple icons
- WebP/AVIF for UI raster images
- KTX2 for in-engine textures
- PNG only when alpha/workflow requires it

## Badge rules
- original geometry
- no tracing
- no club initials copied from a real identity
- no sponsor/manufacturer logo
- no distinctive crest-outline clone

## UI rules
- readable over grass/crowd motion
- strong hierarchy
- no excessive glass/blur that harms legibility
- saturated effects reserved for meaningful moments
- technique icons readable at small size

## Review loop
For every board:
- review at actual target display size
- grayscale/silhouette readability check
- contrast/color-blind check where relevant
- side-by-side coherence review
- record rejected alternatives and why

## Implementation Task Sequence

- [ ] **Task 1:** Create the art-review checklist and required board templates.
- [ ] **Task 2:** Produce three distinct logo/title directions and select one based on readability/coherence.
- [ ] **Task 3:** Produce identity boards for all four teams with original badges and kit language.
- [ ] **Task 4:** Produce six character archetype silhouette boards.
- [ ] **Task 5:** Produce first-arena mood board and gameplay-distance paint-over.
- [ ] **Task 6:** Produce HUD, progression screen, replay overlay, and technique-icon family.
- [ ] **Task 7:** Run grayscale, contrast, small-size, and side-by-side coherence reviews.
- [ ] **Task 8:** Revise the art bible until no board conflicts with the shared visual language.

## V2 mandatory image/reference system

This stage is governed by `docs/art/FULL_IMAGE_PLAN.md` and `/DESIGN.md`. The AI must create the structured **192-image locked reference library** and select the **48-image golden target set** before mass final asset generation. Every reference gets provenance/usage metadata, purpose, copy/avoid notes, camera/lighting notes, and approval status.

Use `/3d-product` research-first and reference-coverage discipline: coverage matrix, conflicts register, versioned contact sheets, cheap preview ladder, and measured gates. Do not make Octane, DaVinci Resolve Studio, FigJam, or paid generation services critical dependencies.

The image stage must produce synchronized multi-view athlete blueprints, four original team identity sheets, a spatially consistent Foundry arena reference set, UI/HUD targets, action pose sheets, and accessibility/readability comparisons.

## Exit gate
- complete art bible
- four teams recognizable without text
- title screen comp
- HUD comp
- progression screen comp
- first arena paint-over
- technique icon family
- zero copied crest/logo assets
