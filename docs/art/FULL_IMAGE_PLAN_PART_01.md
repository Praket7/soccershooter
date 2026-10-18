# SoccerShooter — Full Reference Image, Concept Art, and Visual Production Plan

**Version:** 2.0  
**Date:** 2026-10-17  
**Owner:** Lead AI Art/Design Agent  
**Human role:** Creative-direction approval at explicit gates only  
**Required companion:** `/DESIGN.md`  
**Blender companion:** `docs/tools/BLENDER_AI_PIPELINE.md`  

> This is the complete image plan. It defines what visual references must exist before the AI creates production 3D content, how many images are required, how they are specified, how they are reviewed, and how they flow into Blender and the runtime game.

---

# 1. Objective

Build a visual reference system strong enough that separate AI agents can independently produce UI, athletes, kits, props, environments, animation key poses, VFX, and promotional/replay framing **without style drift**.

The image library is not a moodboard dump. Every image must have a declared job.

The final locked reference library contains exactly **192 approved reference images** plus working rejects/alternates outside the lock set.

Of the 192, **48 are “golden target images”** that become the primary comparison frames for AI art and Blender production.

---

# 2. Why a large reference library is necessary

SoccerShooter has several visual systems that must agree:
- athlete anatomy
- kits and identity
- football scale/material
- animation poses
- third-person camera
- arena architecture
- lighting
- pitch/turf
- crowd
- UI
- VFX
- replay framing
- accessibility/readability

A small 10-image moodboard leaves too much ambiguity. Separate AI workers will fill those gaps differently and create style drift.

A 192-image structured set is large enough to cover the necessary dimensions while still being reviewable and searchable.

---

# 3. Locked reference count

| ID range | Group | Count |
|---|---|---:|
| G001–G012 | Global visual north-star / quality | 12 |
| U001–U018 | UI / HUD / menus | 18 |
| C001–C012 | Camera / gameplay readability | 12 |
| M001–M018 | Movement / sports body language / cinematography | 18 |
| A001–A036 | Six athlete archetype modeling sets | 36 |
| T001–T024 | Four team identity / kit systems | 24 |
| E001–E010 | Ball / boots / goal / equipment | 10 |
| P001–P018 | Football action key poses | 18 |
| R001–R028 | Arena / materials / lighting / crowd | 28 |
| V001–V008 | VFX / goal / impact | 8 |
| X001–X004 | Accessibility / readability | 4 |
| H001–H004 | Replay / highlight framing | 4 |
|  | **Total** | **192** |

The AI must not quietly change this count. If a category needs more coverage, add working references but preserve the 192-image lock set by replacing weaker locked references.

---

# 4. Golden target set

Select **48** from the 192 after review.

## 4.1 Golden style targets — 12

Must cover:
- 3 live-play visual targets
- 2 close character targets
- 2 material/lighting targets
- 2 environment targets
- 1 UI-over-gameplay target
- 1 replay target
- 1 exceptional-goal presentation target

## 4.2 Golden character/kit targets — 12

- 6 character archetype hero views
- 4 public team kit hero views
- 2 close material/detail views

## 4.3 Golden arena/lighting targets — 12

- 3 pitch-level wide views
- 3 player-height game-camera views
- 2 goal-end views
- 2 material/detail views
- 2 nighttime/floodlight atmosphere views

## 4.4 Golden UI/VFX/replay targets — 12

- 3 in-match HUD frames
- 3 menu/progression frames
- 2 leaderboard/account frames
- 2 VFX frames
- 2 replay/highlight frames

These 48 are the visual targets used in automated review contact sheets and human approval gates.

---

# 5. Directory structure

```text
art/
  references/
    LOCKED_192/
      global/
      ui/
      camera/
      motion/
      athletes/
      teams/
      equipment/
      poses/
      arena/
      vfx/
      accessibility/
      replay/
    GOLDEN_48/
    working/
    rejects/
  concepts/
    generated/
    approved/
    superseded/
  blueprints/
    characters/
    kits/
    props/
    arena/
  contact-sheets/
  metadata/
  review/
  provenance/
```

Runtime assets are not stored inside the reference directories.

---

# 6. Reference metadata contract

Every reference image has a sibling YAML file with the same basename.

Example:

```yaml
id: A007
category: athlete
status: approved
source_type: generated
source_url: null
license: project-generated-reference
public_safe: true
resolution: 3072x3072
purpose: compact technician side modeling blueprint
asset_targets:
  - char_compact_technician_v01
copy:
  - lower center of gravity
  - thigh/calf athletic proportion
  - short torso silhouette
  - kit fit around hip and knee
avoid:
  - face identity
  - visible brand marks
  - exaggerated shoulder width
camera:
  type: near_orthographic
  focal_length_equiv_mm: 100
lighting:
  type: neutral_three_point
  color_temperature_k: 5500
palette: []
measurements:
  height_m: 1.73
  shoulder_width_m: 0.43
notes: neutral A pose, no perspective distortion
approved_by: creative_director
approved_date: 2026-10-17
```

Required fields:
- ID
- category
- status
- provenance/source
- license/use status
- public-safe flag
- resolution
- purpose
- asset/screen targets
- what to copy
- what to avoid
- camera
- lighting
- dimensions/scale where relevant
- approval

---

# 7. Global reference set G001–G012

Purpose: define the overall quality ceiling and the exact relationship between realism, stylization, readability, and energy.

The 12 locked frames must include:

1. **G001 Live third-person possession**  
   Player, ball, two teammates, two opponents, readable stadium, normal gameplay intensity.

2. **G002 Sprint transition**  
   Athlete accelerating while ball remains readable; demonstrates motion without excessive blur.

3. **G003 Shot preparation**  
   Body posture, reticle, opponent, goal, keeper, minimal HUD.

4. **G004 Exceptional shot contact**  
   Premium impact frame without particle overload.

5. **G005 Goal release**  
   Goal validation + crowd/goal burst timing.

6. **G006 Defensive duel**  
   Shoulder-to-shoulder or contain state, body weight legible.

7. **G007 Aerial duel**  
   Ball height, jump silhouettes, landing space readable.

8. **G008 Night arena wide**  
   Flagship arena identity and floodlights.

9. **G009 Athlete hero menu**  
   Close enough for materials/face, still matches gameplay art style.

10. **G010 Road to Legend hub**  
    UI + athlete + environment.

11. **G011 Replay cinematic**  
    More cinematic grade but same asset truth.

12. **G012 Low-spec comparison**  
    Demonstrates that style survives quality reduction.

### Acceptance

Every global frame must answer:
- Where is the ball?
- What is the player trying to do?
- What visual feature makes this SoccerShooter rather than a generic soccer game?
- What part is stylized rather than realistic?
- Does the screenshot promise a game the runtime can actually deliver?

---

# 8. UI reference set U001–U018

These are not random screenshots from commercial games. They are annotated target compositions for SoccerShooter.

1. U001 launch / loading
2. U002 first-run guest/Google/email
3. U003 home hub
4. U004 Road to Legend hub
5. U005 Road to Legend match node
6. U006 technique mastery
7. U007 athlete profile
8. U008 kit/team select
9. U009 quick match
10. U010 multiplayer lobby
11. U011 in-match HUD normal possession
12. U012 in-match HUD shot preparation
13. U013 in-match HUD defense
14. U014 post-match results
15. U015 global leaderboard
16. U016 daily/weekly challenge leaderboard
17. U017 replay/highlight library
18. U018 settings/accessibility

### Required resolution
- 2560×1440 preferred
- minimum 1920×1080

### Required annotations
- 16:9 safe area
- center gameplay exclusion region
- primary action
- secondary action
- navigation focus state
- gamepad focus order
- keyboard shortcut if any
- text hierarchy
- color-token usage
- loading/error/empty sibling state note

### UI production rule

Do not create implementation CSS from one image alone. The UI agent must have:
- base screen
- focused/hover state
- narrow-width behavior
- empty/loading/error state definition

---

# 9. Camera/readability reference set C001–C012

1. default possession camera
2. sprint camera
3. defense camera
4. shooting/aim camera
5. corner/near-wall camera
6. high aerial-ball framing
7. keeper camera
8. ball-behind-player offscreen indicator
9. crowded midfield readability
10. counterattack open-space readability
11. replay sideline camera
12. replay low hero camera

### Annotation requirements

For every camera frame annotate:
- estimated camera position relative to player
- focal length or equivalent FOV
- pitch horizon line
- controlled player screen occupancy
- ball screen occupancy
- target/goal visibility
- edge UI safe regions

The AI camera engineer must reproduce the composition in a greybox before trusting final art.

---

# 10. Movement/body-language set M001–M018

These references teach the AI how elite football athletes carry weight.

Required:
1. acceleration first two steps
2. full sprint
3. deceleration
4. 45° cut
5. 90° cut
6. lateral shuffle
7. backward jockey
8. turn-in-place athletic
9. planted shot approach
10. pass follow-through
11. receiving body-open stance
12. cushioning trap
13. close dribble
14. sprint dribble
15. standing tackle
16. slide tackle
17. jump takeoff/landing
18. stumble and recovery

### Source preference
- public sports photography/video stills used only as private reference where licensing demands
- generated clean pose sheets for public repo documentation
- local motion-capture stills when available

### Important
The public game may be inspired by real athletic technique but must not intentionally reproduce a recognizable player likeness.

---

# 11. Athlete archetype set A001–A036

Six archetypes × six images each = 36.

Archetypes:
1. agile winger
2. compact technician
3. balanced midfielder
4. power forward
5. tall defender
6. goalkeeper

For each archetype create exactly:
- front near-orthographic
- left side near-orthographic
- back near-orthographic
- 3/4 front
- 3/4 back
- football action hero pose

### Blueprint requirements

For front/side/back:
- same identity and clothes
- same neutral A-pose
- same scale
- plain neutral background
- 85–120 mm equivalent focal length
- no depth of field
- no dramatic rim light
- soft neutral illumination
- no accessories hiding joints
- hands/fingers visible
- feet/boots fully visible
- no cropping
- height scale bar

### Resolution
- 3072×3072 preferred
- 2048×2048 absolute minimum

### Archetype measurements

Metadata should include intended ranges for:
- height
- shoulder width
- hip width
- leg-to-torso ratio
- approximate body-mass category

Do not use exact real-player measurements as an identity target.

---

# 12. Team identity set T001–T024

Four public-safe teams × six images = 24.

For each team:
1. home kit front
2. home kit back
3. away/alternate kit
4. fabric/trim/material close-up
5. original badge construction sheet
6. full-team tunnel/lineup identity frame

Teams:
- Blaugrena
- Royal Whites
- Oil Company North
- Oil Company Capital

### Kit image requirements

Front/back target:
- neutral athlete mannequin or approved archetype
- flat enough light to judge colors
- no real sponsor
- fictional manufacturer or no manufacturer mark
- original graphic layout
- number font visible
- collar/cuff construction visible
- material roughness readable

### Badge requirements

Badge sheet contains:
- black/white silhouette
- full color
- 32 px test
- 64 px test
- 256 px master preview
- embroidery/kit mockup

### Public-safety rejection

Reject badges or kits that are too close to the exact protected geometry, sponsor treatment, or trade dress of real clubs.

---

# 13. Equipment set E001–E010

1. match ball orthographic front
2. ball panel/material close-up
3. ball under cool floodlight
4. ball under warm environment light
5. agile boot profile
6. power boot profile
7. goalkeeper glove
8. goal/net close-up
9. turf macro
10. corner/field-line material reference

### Ball blueprint

Must include:
- diameter scale
- seam/panel design
- roughness
- normal detail
- color-block design
- rotation-readable pattern

The pattern must help players visually perceive spin.

---

# 14. Action pose set P001–P018

1. inside-foot ground pass
2. driven pass
3. lofted pass
4. first touch inside foot
5. chest/thigh trap
6. stepover
7. roulette
8. elastico-like move
9. driven shot
10. finesse/curve shot
11. power strike
12. outside-foot strike
13. chip
14. volley
15. scissor
16. bicycle kick
17. header
18. goalkeeper diving save

### Pose-sheet standard

Each action image should include:
- contact frame or peak frame
- arrows showing body momentum
- ball velocity arrow
- plant foot marker
- contact foot/body marker
- center of mass estimate
- eligibility notes

These images are animation/physics communication tools, not just art.

---

# 15. Arena set R001–R028

## 15.1 Macro architecture — 8

R001 top-down blockout
R002 goal-end exterior identity
R003 sideline wide
R004 opposite sideline wide
R005 player-height center pitch
R006 player-height attacking third
R007 tunnel/entry
R008 concourse/background silhouette

## 15.2 Materials/props — 8

R009 steel truss
R010 brick/concrete wall
R011 railings/barriers
R012 seating system
R013 floodlight fixture
R014 signage/LED frame
R015 industrial prop cluster
R016 goal/net/boards integration

## 15.3 Lighting/atmosphere — 8

R017 neutral greybox light
R018 flagship night key
R019 goal-end readability
R020 midfield readability
R021 rain/wet optional study, not baseline
R022 warm practical/cool flood contrast
R023 crowd brightness balance
R024 low-quality graphics comparison

## 15.4 Crowd/navigation — 4

R025 crowd color-density distribution
R026 home-end landmark
R027 away-end landmark
R028 side landmarks/navigation test

### Arena target resolution
- wides: 2560×1440 minimum
- top-down: 2048×2048 minimum
- material detail: 2048×2048 minimum

### Arena reference rule
The first 8 images must agree spatially. They cannot be unrelated stadium concepts.

---

