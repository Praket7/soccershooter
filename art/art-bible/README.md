# SoccerShooter Art Bible

**Status:** in progress. This document turns the binding design specification into reviewable production rules; it is not a claim that the 192-reference library or any final 3D assets are complete.

## Visual direction

**Athletic Cinematic Realism:** believable human proportions, grounded movement, coherent PBR materials, simplified readable faces, clear kit separation, and authored stadium light. The game should feel credible rather than photorealistic. Live play stays immediate and readable; cinematic treatment is reserved for replay and exceptional moments.

## Live-play hierarchy

1. Ball
2. Nearest player interacting with the ball
3. Controlled athlete's body orientation and feet
4. Pass or shot space
5. Nearest tactical threats and support
6. Match state and stamina
7. Crowd and environment

Environment detail, effects, and interface elements must not compete with the first four items.

## Shared palette

| Token | Value | Use |
|---|---|---|
| Deep navy | `#0B1020` | Main interface foundation |
| Deep slate | `#151C2D` | Panels and layered surfaces |
| Soft white | `#F4F6F8` | Primary text and light kit |
| Secondary text | `#AEB7C6` | Supporting copy |
| Neutral line | `#313A4E` | Dividers and outlines |
| Interaction lime | `#D8F25A` | Focus and actionable states |
| Success | `#79D98A` | Confirmed positive outcomes |
| Warning | `#F0C35A` | Caution and timing states |
| Danger | `#F46B6B` | Errors and urgent threats |

Functional UI colors remain independent of team identity colors.

## Public team identity seeds

- **Blaugrena:** deep garnet, royal blue, restrained warm gold; close control and patience; original angular woven badge geometry.
- **Royal Whites:** warm white, midnight navy, champagne; transition and composure; geometric orbital badge.
- **Oil Company North:** sky blue, charcoal, copper; pressing and structured triangles; abstract northern/industrial badge.
- **Oil Company Capital:** deep navy, crimson, warm gold; speed and direct attack; original radial metropolitan badge.

These are fictional directions, not permission to borrow real club crests, kit layouts, sponsors, manufacturers, or player likenesses.

## Live-camera envelope

- Target height: 1.30–1.45 m above the player root.
- Distance: 5.0–6.2 m, adapting gently to speed and possession.
- Vertical offset: 2.7–3.5 m; shoulder offset: 0.35–0.55 m.
- 16:9 vertical FOV: 53–57 degrees; sprint change no more than +2.5 degrees.
- Camera rotation responds immediately to look input. Any positional follow lag is subtle and must not delay movement.

## Material and anatomy rules

- Use believable adult joint proportions and stable limb lengths; feet must remain grounded through stance and body translation.
- Fabric, skin, ball, turf, boots, and metal each need distinct roughness/response.
- Preserve the regulation ball's silhouette and separation from the athlete's boots.
- Keep faces simple enough to read at game distance; avoid pore-level detail and uncanny close-up skin.
- Prefer reusable materials and a small number of draw calls over roster-specific shader variations.

## Motion and effects

- Run, cut, brake, plant, and recover poses must communicate actual momentum and support-foot behavior.
- Ball-contact animation follows the authoritative ball/contact state; animation never invents a successful hit.
- Normal touches have almost no VFX. Reserve stronger impact language for hard shots, saves, tackles, and earned goals.
- Replays may use more cinematic cameras and effects than live play, while keeping the ball trajectory truthful.

## Reference library progress

The reference library is underway. The locked set currently contains 26 images: G001–G012, U001–U010, and C001–C004. The golden selection has 12 global targets and 3 menu/progression targets; 33 of 48 golden slots remain. See `art/references/library-status.yaml` and `art/references/GOLDEN_48/manifest.yaml` for current counts and selections.

| Working reference | State | Review question |
|---|---|---|
| `G001-live-possession-candidate_A_v01.png` | Generated, working | Is its wider view more useful for reading tactical context while retaining athlete embodiment? |
| `G001-live-possession-candidate_B_v01.png` | Generated, working | Does the slightly tighter framing improve ball/player readability without obscuring nearby play? |
| `G001-live-possession-candidate_C_v01.png` | Generated, working | Does the nearer defender and passing lane make the possession read more clearly? |
| `G001-live-possession-candidate_D_v01.png` | Generated, working | Does central framing preserve adequate ball and opponent contrast? |

Four balanced-midfielder turnaround candidates also exist as working concepts (`W-A-BM-candidate_A` through `_D`). They are **not** accepted as modeling blueprints: all four show very similar identity/build, the requested A-pose became a relaxed pose, and 1254 px output is below the design's 2048 px long-edge modeling-reference target. Regenerate with more distinct anatomy and a cleaner technical pose before promoting one.

The first Foundry spatial plan is `art/arenas/foundry/source/foundry-spatial-plan-v01.md` with a rendered review preview in `art/review/foundry-spatial-plan-v01.png`. It uses the current 24 × 36 m physical scrimmage field as its working reference and is not a final arena approval.

Candidate images and provenance are stored under `art/references/working/` and `art/references/metadata/`. Do not use working references as final production textures or silently count them as approved.

## Current product gap

The live build still uses a procedural placeholder athlete and a greybox training ground. This art direction is the target for the next character, animation, and arena work; a generated concept is not a substitute for a rigged, optimized, in-engine model.
