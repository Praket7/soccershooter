# Blender art and render handoff

**Project:** SoccerShooter  
**Repository:** `/Users/pcg/Desktop/soccershooter-movement-test`  
**Prepared:** 2026-10-21  
**Purpose:** Locate the existing Blender work, show what evidence/renders are still missing, and give the next artist a reproducible render order.

## Open these Blender projects

- **Hero athlete source:** [`art/characters/source/hero.blend`](../../art/characters/source/hero.blend)
- **Hero runtime export:** [`art/characters/export/hero.glb`](../../art/characters/export/hero.glb)
- **Foundry stadium blockout:** [`art/arenas/foundry/source/foundry-blockout-v01.blend`](../../art/arenas/foundry/source/foundry-blockout-v01.blend)
- **Foundry spatial plan:** [`foundry-spatial-plan-v01.md`](../../art/arenas/foundry/source/foundry-spatial-plan-v01.md) and [SVG](../../art/arenas/foundry/source/foundry-spatial-plan-v01.svg)
- **Hero build/export script:** [`tools/blender/build_hero.py`](../../tools/blender/build_hero.py)

Open `hero.blend` for the current character work. `hero.blend1` is Blender's backup of an earlier save; preserve it until the current source has been checked. The hero GLB is a current export, not proof that the model has passed the full character gate. The Foundry file is a blockout, not a finished stadium.

## Existing render evidence

- [Latest documented studio render, hero-v18](../../art/review/hero-v18-studio.png)
- [Existing cleat close-up, hero-v13](../../art/review/hero-v13-cleats-detail.png)
- [Foundry spatial-plan preview](../../art/review/foundry-spatial-plan-v01.png)
- [Preview of the downloaded standing-footballer reference model](../../art/review/professional-soccer-reference.png)

There are later character iteration renders in `art/review/` (including v19–v21 sourced-sock experiments). Do not assume the highest version number is the approved/current look: check the open `.blend`, current export, and render together before building on any variant. None of the supplied candidate images are recorded as approved art direction.

## References

### User's target gameplay image

The user-provided image is preserved in the repository so Blender workers can open it directly:

- [Gameplay realism reference image](../../art/references/working/user-gameplay-realism-reference-v01.jpg)

Use it for the **in-game composition and finish target**: believable human proportions and running posture, ball placed naturally at the dribbling foot, readable opponents and goal, textured pitch, stadium depth, crowd scale, lighting, and grounded shadows. It is a visual target, not permission to reproduce real players, club identity, or protected marks. Keep the game’s fictional kit and branding.

### Working generated references

These are candidates only; metadata, provenance, and limitations are alongside them. They are not locked/approved targets:

- [G001 live-possession candidate A](../../art/references/working/G001-live-possession-candidate_A_v01.png) · [metadata](../../art/references/metadata/G001-live-possession-candidate_A_v01.yaml)
- [G001 live-possession candidate B](../../art/references/working/G001-live-possession-candidate_B_v01.png) · [metadata](../../art/references/metadata/G001-live-possession-candidate_B_v01.yaml)
- [Balanced-midfielder turnaround candidate](../../art/references/working/balanced-midfielder-turnaround_v01.png) · [metadata](../../art/references/metadata/balanced-midfielder-turnaround_v01.yaml)
- [Foundry candidate A](../../art/references/working/W-R-FOUNDRY-candidate_A_v01.png) · [metadata](../../art/references/metadata/W-R-FOUNDRY-candidate_A_v01.yaml)

### Public-domain model study

- [Source page: standing soccer player (InnerScene)](https://www.innerscene.com/tools/library/3d-parts/soccer-player-standing-3d-person-team-sports-f55b1b4f)
- [Downloaded GLB](../../art/characters/reference/professional-soccer-standing.glb)
- [Local preview](../../art/review/professional-soccer-reference.png)

This is a static reference model. It is useful for studying garment and equipment detail, but it is not a ready-to-ship rigged game character. Preserve its source/license notes when using it; do not assume a downloaded mesh can be redistributed without checking the source terms.

## What still needs to be rendered and checked

### 1. Hero character review sheet — do this first

Render from the current `hero.blend`, then make a contact sheet with:

1. Neutral full-body **front, side, back, and 3/4** views, matching camera scale and framing.
2. A clean wireframe view and a dimensions/scale report.
3. Close-ups of jersey construction/knit, shorts, socks, and cleats; include a neutral material swatch view.
4. Neutral, Foundry/night, and bright low-contrast lighting looks.
5. Sprint, planted 90° cut, shot contact/follow-through, slide, bicycle pose, and goalkeeper pose. Check joints and foot contact; do not stretch limbs to reach the ball.
6. The gameplay-camera view with ball and other players, then the same asset imported in the running game. A Blender render alone does not establish runtime fit or finish.

Record the Blender file revision, render settings, dimensions, polygon/texture/bone metrics, and pass/fail notes with the contact sheet. The latest hero render is v18; there is no completed front/side/back + wireframe review package in the current evidence list.

### 2. Foundry arena review set

From `foundry-blockout-v01.blend`, render a **top-down plan**, both goal-end views, both sideline wides, center-pitch and attacking-third views at player height, and a tunnel/background view. Keep all views spatially consistent with the plan. Then show neutral greybox lighting, the intended night/floodlight look, and a gameplay view that tests pitch, ball, and player readability. The current spatial-plan PNG is a planning preview; the finished arena and its evidence set are not present.

### 3. Integrated gameplay and performance evidence

Capture a clean in-engine gameplay frame/video with the exported hero, ball, opponents/teammates, goal, and the stadium. Compare it side-by-side with the user reference at actual gameplay scale. Check whether the character reads as a human at that distance, whether the ball stays visible and naturally placed, and whether shadows/materials survive the game's renderer. Record frame-time, draw calls, visible triangles, texture memory, and GLB size for the representative scene.

## How to produce the renders

Follow [`docs/tools/BLENDER_AI_PIPELINE.md`](../tools/BLENDER_AI_PIPELINE.md), [`docs/ART_REVIEW_CHECKLIST.md`](../ART_REVIEW_CHECKLIST.md), and the image-plan specification in [`FULL_IMAGE_PLAN.md`](../art/FULL_IMAGE_PLAN.md).

1. Work in the existing local Blender/MCP setup and inspect the scene before changing it. Save a new version/checkpoint before edits; do not overwrite the only source or approved evidence.
2. Use meters and the existing project scale. Lock silhouette, proportions, camera fit, and gameplay readability before adding surface detail.
3. Produce front/side/3/4, wireframe, dimensions, and non-manifold/topology checks before further polish. Keep review lighting neutral for modeling judgments.
4. For character review, use the same near-orthographic camera, scale, and neutral lighting across the turntable views. Keep the complete body, hands, and boots in frame; no depth of field.
5. Check skinning in football-specific poses. Save pose renders and inspect knees, hips, shoulders, ankles, foot planting, and ball contact. Simulation remains authoritative; animation must not fake contact by stretching the body.
6. Export GLB with stable scale, orientation, pivots, names, and materials. Validate the export and inspect it in the actual Three.js/game renderer, including material/color parity.
7. For the arena, finish the spatial plan and sightlines before detailing. Keep simplified collision geometry separate from render meshes.
8. Store new source versions under the existing `art/**/source/` folders and review images under `art/review/`. Add provenance/metadata for every new external or generated reference. Never promote a working candidate silently.

## Suggested output names

Use a new revision suffix rather than overwriting earlier review evidence, for example:

- `art/review/hero-v22-turnaround.png`
- `art/review/hero-v22-wireframe.png`
- `art/review/hero-v22-football-poses.png`
- `art/review/foundry-v02-spatial-views.png`
- `art/review/foundry-v02-night-gameplay.png`
- `art/review/hero-foundry-runtime-v01.png`

These are suggested names, not existing files.

## Current completion boundary

The hero source, one GLB export, prior studio/cleat renders, and a Foundry blockout exist. The review set above, complete runtime-ready character validation (including LODs/collider/pose deformation), finished arena, in-engine visual proof, and performance evidence remain outstanding. The art bible also says the 192 locked references and 48 golden targets are not yet complete. See [art-bible status](../../art/art-bible/README.md), [Stage 11 plan](../superpowers/plans/stages/11-art-bible-images.md), [Stage 12 plan](../superpowers/plans/stages/12-characters-rigging.md), and [Stage 14 plan](../superpowers/plans/stages/14-arena-environment.md).
