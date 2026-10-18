# 16. VFX set V001–V008

1. normal kick — almost no VFX
2. hard shot — small air/contact emphasis
3. curved/finesse shot — subtle path language
4. goalkeeper save — glove/ball emphasis
5. tackle — contact/turf emphasis
6. goal confirmation — initial burst
7. exceptional-goal celebration peak
8. reduced-effects accessibility version

### VFX acceptance

In all frames:
- ball silhouette remains visible
- opponent/player outline remains readable
- effect direction agrees with physical event
- no false trajectory implication
- color does not conflict with team identification

---

# 17. Accessibility set X001–X004

1. standard team colors
2. protanopia-safe treatment
3. deuteranopia-safe treatment
4. tritanopia/high-contrast comparison

Each should show the same gameplay moment so changes can be judged directly.

Required checks:
- grayscale
- simulated color vision difference
- ball contrast
- teammate/opponent distinction
- reticle visibility

---

# 18. Replay/highlight set H001–H004

1. 16:9 goal buildup
2. 16:9 contact/goal hero frame
3. 9:16 social-safe crop
4. leaderboard/challenge result share card

No platform logo or copyrighted social-media UI is baked into the design.

---

# 19. Image-generation workflow

The AI must generate concept images in **small controlled batches**, not one giant request.

## 19.1 Batch sequence

### Batch 1 — global style
Generate 4 candidates each for:
- ordinary live possession
- hero athlete
- flagship arena night

Review 12 → select direction → revise only selected direction.

### Batch 2 — gameplay camera
Generate candidate frames for C001–C012 from a consistent greybox/spatial brief.

### Batch 3 — athlete blueprints
Generate each archetype as a synchronized multi-view identity set.

Do not accept inconsistent identities across views.

### Batch 4 — teams/kits
Generate original public-safe designs.

### Batch 5 — arena
Start with top-down and greybox. Lock spatial design before detail/lighting.

### Batch 6 — UI
Create wireframe first, visual skin second.

### Batch 7 — VFX/replay
Only after live visual density is established.

---

# 20. Prompt structure for concept-image agents

Every generation prompt should include these fields:

```text
PURPOSE
ASSET OR SCREEN
CAMERA
COMPOSITION
SUBJECT
PHYSICAL SCALE
MATERIALS
LIGHTING
COLOR
GAMEPLAY READABILITY PRIORITY
DETAIL LEVEL
WHAT MUST REMAIN EMPTY
WHAT TO AVOID
PUBLIC-SAFE CONSTRAINTS
OUTPUT SIZE/ASPECT
CONSISTENCY REFERENCES
```

Do not prompt only with adjectives like “AAA,” “cinematic,” or “realistic.”

---

# 21. Character blueprint generation prompt requirements

Must say:
- same character across all views
- neutral A-pose
- physically plausible athlete
- no recognizable real person
- plain mid-grey background
- neutral 5500K light
- near orthographic / 100 mm equivalent
- full body uncropped
- hands and feet visible
- no logo
- no text
- no accessories obscuring body
- exact height target from metadata
- consistent kit cut

After generation, AI reviewer checks:
- face identity consistency
- hand count/anatomy
- foot orientation
- joint position
- shoulder/hip width
- height consistency
- clothing seams
- perspective consistency

Reject and regenerate if any fail.

---

# 22. Kit blueprint generation requirements

Must separate:
- cut/construction
- color blocking
- graphic treatment
- number typography
- badge
- material

Never ask an image generator for a “Barcelona but renamed” kit. Instead define original geometry/colors and explicitly reject exact real-club crests/sponsors/layouts.

---

# 23. Arena concept generation requirements

The arena must be built from a spatial plan.

Before atmospheric concepts, produce:
- top-down schematic
- pitch dimensions
- stands footprint
- goal-end landmarks
- entrances
- wall/board boundaries
- camera collision envelope

Then generate atmosphere against that locked geometry.

No “beautiful stadium concept art” with inconsistent architecture is usable for modeling.

---

# 24. UI image production workflow

## Phase A — information architecture
Text only.

## Phase B — grayscale wireframes
No branding, no gradients, no decorative 3D.

Gate:
- hierarchy works without color
- keyboard/gamepad focus order works
- primary action obvious

## Phase C — visual skin
Apply SoccerShooter typography, tokens, line/shape language.

## Phase D — 3D integration
Place live or rendered athlete/environment behind/next to UI.

## Phase E — state matrix
For every screen create:
- default
- hover/focus
- selected
- disabled
- loading
- error
- empty if possible

## Phase F — in-engine screenshot comparison
Implementation screenshot must be compared side-by-side with target.

---

# 25. Full UI screen image list beyond the 18 locked refs

The locked 18 are the minimum visual-direction set. Implementation can create working target frames for every state below:

- splash/loading
- guest/auth choice
- Google redirect return
- email sign-in
- email sign-up
- password reset
- account link/merge
- offline guest notice
- home
- Road to Legend map
- challenge detail
- match intro
- player profile
- technique mastery tree
- settings
- controls
- video
- audio
- accessibility
- network
- quick play
- lobby
- team select
- kit select
- matchmaking search
- reconnect
- in-match normal
- in-match defense
- in-match shot
- pause
- post-goal
- replay
- final scoreboard
- XP/mastery progression
- unlock
- leaderboard global
- leaderboard around-me
- daily challenge
- weekly challenge
- replay library
- replay detail
- error/maintenance
- credits/license

These working frames do not increase the locked 192 count unless promoted into it.

---

# 26. Using real-world photography safely as reference

A private development reference can be useful for:
- athletic anatomy
- stadium construction
- fabric folds
- boot materials
- movement mechanics
- lighting

Rules:
- record source URL/provenance
- do not copy protected logos/graphics into shipping output
- do not use a recognizable real player as the target face
- do not ship private reference images in public repo/build
- extract general physical/design principles rather than one-to-one copying

---

# 27. Reference coverage matrix

Before Blender Stage 2 for any asset, create a coverage matrix.

Example:

| Asset aspect | Front | Side | Back | 3/4 | Macro | Motion | Scale proof |
|---|---:|---:|---:|---:|---:|---:|---:|
| torso | ✓ | ✓ | ✓ | ✓ |  | ✓ | ✓ |
| boots | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| collar | ✓ | ✓ | ✓ | ✓ | ✓ |  | ✓ |
| badge | ✓ |  |  |  | ✓ |  | ✓ |

Hero components require at least two independent supporting views or an explicit labeled estimate.

---

# 28. `3d-product` adaptation for image/reference work

Use the following `/3d-product` concepts directly:
- reference coverage matrix
- source authority order
- measurement tags
- conflicts register
- cheap-preview ladder
- contact sheets
- material swatch sheets
- composition analysis
- FIRST/KEY/LAST frames for hero menu/replay sequences
- stage gates
- version-up editing
- prove pipeline with a known test before batch work

Change product-film rules where runtime needs differ:
- runtime textures instead of 32-bit EXR assets
- GLB instead of film-only scene output
- LOD and collision required
- no expensive final film render as an acceptance substitute for in-engine proof

---

# 29. Blender handoff package for each asset

Before Blender agent starts an asset it receives:

```text
ASSET_ID/
  BRIEF.md
  measurements.yaml
  references/
  contact_sheet.jpg
  golden_target.jpg
  constraints.yaml
  validation.json
```

`BRIEF.md` defines:
- purpose
- runtime camera distance
- silhouette goal
- material classes
- polygon budget
- texture budget
- LOD count
- rig/collision needs
- export path

---

# 30. AI visual-review loop

For every significant Blender revision:

1. save new version
2. render neutral front/side/3/4
3. render wireframe
4. render golden gameplay angle if applicable
5. collect metrics
6. generate contact sheet
7. compare to target
8. mark pass/fail per criterion
9. revise only failed criteria
10. keep prior version

The AI cannot say “looks good” without the sheet and metrics.

---

# 31. Image review rubric

Score each 1–5:
- purpose clarity
- style alignment
- silhouette
- physical credibility
- gameplay readability
- material clarity
- lighting clarity
- camera correctness
- originality/public safety
- consistency with existing lock set
- production feasibility

Locked image threshold:
- no category below 4
- mean >= 4.4

Golden image threshold:
- no category below 4
- mean >= 4.6
- explicitly selected as a production target

---

# 32. Reference rejection reasons

Use standardized tags:
- `STYLE_DRIFT`
- `UNREADABLE_BALL`
- `UNREADABLE_PLAYER`
- `BAD_CAMERA`
- `BAD_ANATOMY`
- `INCONSISTENT_IDENTITY`
- `IMPOSSIBLE_GEOMETRY`
- `MATERIAL_AMBIGUOUS`
- `LIGHTING_AMBIGUOUS`
- `IP_TOO_CLOSE`
- `GENERIC_UI`
- `EFFECT_OVERLOAD`
- `NOT_RUNTIME_FEASIBLE`
- `LOW_RES`
- `MISSING_SCALE`
- `DUPLICATE_COVERAGE`

Rejects remain in `art/references/rejects/` with reason metadata so another AI agent does not rediscover the same failure.

---

# 33. Image versioning

Naming:

```text
<id>_<slug>_v<NN>_<status>.<ext>
```

Examples:
```text
G001_live_possession_v04_APPROVED.png
A007_compact_technician_side_v03_APPROVED.png
R018_foundry_night_key_v06_GOLDEN.png
```

Never overwrite an approved image.

---

# 34. Contact sheets

Required contact sheets:
- global 12
- UI 18
- camera 12
- motion 18
- athlete per archetype 6×6-view sheet
- team per identity 4×6-view sheet
- arena 28
- golden 48

Contact sheet must include:
- reference ID
- thumbnail
- score
- status
- one-line copy/avoid note

---

# 35. Image-to-runtime traceability

Every production 3D/UI asset stores reference IDs in metadata.

Examples:
```json
{
  "asset": "char_agile_winger_v03",
  "references": ["A001", "A002", "A003", "A004", "A005", "A006", "G009"],
  "golden": ["A006"]
}
```

This allows a future AI agent to understand why an asset looks the way it does.

---

# 36. Performance-aware visual design

Reference images must not propose scenes impossible under web budgets.

Before golden approval ask:
- can this silhouette be modeled at the planned triangle budget?
- can the material be reproduced with glTF PBR?
- can the lighting be approximated in Three.js?
- can the crowd treatment be instanced/LOD'd?
- does it depend on heavy DOF/motion blur?
- does it require hundreds of dynamic lights?
- can the effect survive low graphics mode?

If not, either simplify or clearly classify it as replay/marketing-only.

---

# 37. Reference-game lessons applied to this plan

From Slopocalypse:
- art only after a fun primitive loop
- tone down screen shake/effect noise when readability suffers
- test exploits discovered during play
- keep versioned design documents
- build tools that let agents audition/review feedback quickly

From Birds With Guns:
- validate one complete character pipeline before making the roster
- bot-test maps/content before human playtest
- reduce visual/gameplay population if readability fails
- use scripted Blender for repeatable environmental detail
- let parallel agents build only from one locked brief

Therefore this image plan is gated behind the greybox football feel gate.

---

# 38. Human approval gates

Human creative direction is required only at these points:

### Gate I0 — global direction
Approve 3 of the first global style candidates.

### Gate I1 — locked 192
Approve the final reference library after AI scoring/cleanup.

### Gate I2 — golden 48
Approve the production comparison set.

### Gate I3 — first complete athlete
Approve one athlete/kit/rig in engine.

### Gate I4 — first arena look
Approve Foundry golden gameplay frame in engine.

### Gate I5 — UI style lock
Approve one full gameplay HUD + one home screen + one progression screen implemented in browser.

All other iterations should be handled by agents against the approved references unless a requested change changes the style itself.

---

# 39. What the AI must produce before leaving the image/reference stage

- [ ] 192 approved locked references
- [ ] complete metadata for all 192
- [ ] 48 golden targets
- [ ] contact sheets
- [ ] coverage matrices
- [ ] conflicts register
- [ ] public/private reference separation
- [ ] six athlete blueprint sets
- [ ] four team identity sheets
- [ ] one consistent Foundry arena spatial set
- [ ] 18 UI target frames
- [ ] 18 action-pose sheets
- [ ] image review rubric results
- [ ] `IMAGE_LOCK_REPORT.md`

---

# 40. Exit gate

The image plan passes only when:

1. all 192 locked slots are filled and metadata-valid
2. golden 48 are selected
3. no locked reference has unresolved IP/public-safety concern
4. no athlete blueprint has cross-view identity/proportion mismatch
5. Foundry macro views agree spatially
6. UI references cover live HUD + auth + progression + leaderboard + results + settings
7. accessibility comparison exists
8. every production category has a reference-coverage matrix
9. AI can name the exact golden references for the first athlete, first kit, first arena, first HUD, and first ball
10. the project has **not** begun mass final asset generation before greybox gameplay passed its mechanical gate

If any condition fails, the lead agent remains in image/reference stage.
