# 20. Out-of-match screen specification

Required screens:

1. Launch / connection status
2. First-run choice: Play as Guest / Continue with Google / Continue with Email
3. Home hub
4. Road to Legend hub
5. Road to Legend match node/detail
6. Quick Play
7. Multiplayer lobby
8. Team/kit select
9. Athlete/profile
10. Technique mastery/loadout
11. Progression/unlocks
12. Global leaderboard
13. Daily/weekly challenge leaderboard
14. Ranked leaderboard later
15. Replay/highlight library
16. Match result
17. Settings
18. Controls/remapping
19. Accessibility
20. Network/debug panel in developer builds
21. Error/offline/reconnect states
22. Credits/licensing

Each must have a dedicated reference frame before implementation.

---

# 21. Home hub layout

Primary actions:
- Continue Road to Legend
- Quick Match
- Play Online

Secondary:
- Techniques
- Profile
- Leaderboards
- Replays
- Settings

Hero scene:
- one current athlete in a real-time 3D tunnel/training environment or curated render
- no autoplay cinematic that delays menu control
- current progression visible without opening a modal

---

# 22. Road to Legend UI

## 22.1 Tone

This mode should feel aspirational, not like a spreadsheet career sim.

## 22.2 Core information

Show:
- OVR communication score
- technique mastery
- current act
- next opponent/challenge
- form/performance
- optional objectives
- rewards

## 22.3 Acts

1. Street Beginner
2. Academy
3. Regional
4. Continental
5. Elite Clubs
6. World Legends
7. Legacy

Visual escalation should come from:
- venue scale
- presentation
- opponent competence
- stakes
- lighting/event treatment

Not simply from more UI gold.

---

# 23. Authentication and account UX

## 23.1 First-run principle

Do not block the first bot match behind account creation.

Offer:
- **Play as Guest**
- **Continue with Google**
- **Continue with Email**

## 23.2 Guest mode

Guest progress:
- local IndexedDB/storage abstraction
- generated local profile ID
- can play Road to Legend and bot matches
- can save local replays
- cannot write global leaderboard/ranked records until linked to an authenticated account

## 23.3 Google sign-in

Preferred public sign-in because of low friction.

Request minimum scopes:
- OpenID
- email
- profile

Do not request Gmail, Drive, contacts, calendar, or unrelated access.

## 23.4 Email sign-in

Fallback:
- email + password with verified email, or
- magic link if reliable SMTP is configured

Passwords are never stored as plaintext and never handled by custom browser persistence.

## 23.5 Account linking

A guest can link later.

Migration transaction must:
1. authenticate account
2. create/resolve cloud profile
3. compare local/cloud progress
4. show merge decision if both contain meaningful state
5. write idempotently
6. preserve local backup until cloud verification succeeds

## 23.6 Public profile privacy

Leaderboard never shows:
- email
- OAuth provider identifier
- IP address
- internal user UUID

Public profile may show:
- display name
- original/avatar selection
- OVR
- mastery badge
- Road to Legend act
- rating/record if enabled
- featured replay/highlight if user chooses

---

# 24. Credential and session security contract

The AI must **not implement “save credentials” as saving user passwords.**

Allowed:
- trusted auth framework stores hashed credential representation server-side
- secure server session
- OAuth tokens encrypted server-side if retention is required
- HTTP-only, Secure, SameSite cookies when deployment topology allows
- CSRF/PKCE/state validation
- rate limiting
- reset-token expiry
- email verification
- account enumeration protection

Forbidden:
- plaintext password database field
- password in localStorage
- OAuth client secret in browser bundle
- service-role/admin key in browser
- committing `.env` secrets to Git
- direct client authority to write competitive scores

Recommended local/open foundation:
- Better Auth + SQLite for early local development
- move to PostgreSQL when persistence/leaderboards are integrated
- Google OAuth adapter for public sign-in
- local Mailpit during development email flows

Optional hosted adapter:
- Supabase Free only after a current implementation-time check confirms it satisfies project no-card/account constraints
- self-hostable architecture remains canonical

---

# 25. Leaderboard design

## 25.1 Purpose

Leaderboards should turn mastery into replayable goals without encouraging cheating or turning the whole product into a grind.

## 25.2 Required boards

### Road to Legend
- highest completed act
- gauntlet score
- elite challenge score
- best challenge completion time where appropriate

### Daily seeded challenge
- everyone plays same seed/rules/build version
- score
- tie breaker: primary score → fewer concessions/failures → faster valid completion → earlier verified submission

### Weekly seeded challenge
- same model with larger sample window

### PvP later
- rating
- wins/losses
- season
- role contribution metrics are shown in profile but do not directly define MMR unless validated

## 25.3 Views

- Global top 100
- Around Me
- Friends later when social graph exists
- All-time archive for achievement records
- current season

## 25.4 Competitive integrity

Client sends match input only.

Authoritative server creates:
- result ID
- account IDs
- build/sim version
- ruleset
- seed
- score/result
- key aggregate stats
- replay hash/reference
- validity status

Leaderboard write occurs only from trusted server logic/database function.

## 25.5 Anti-cheat

Flag/reject:
- impossible times
- impossible score growth
- mismatched replay hash
- unsupported build version
- duplicated idempotency key
- result from a non-authoritative competitive session

## 25.6 Display names

- unique normalized slug or unique display-name discriminator
- profanity filter/moderation
- Unicode normalization
- length limits
- no email addresses as automatic public names
- report/hide path

---

# 26. Replay and highlight UI

## 26.1 Post-goal replay

Show buildup, not only scorer.

Typical window:
- 8–15 seconds
- extend if important pass chain begins earlier

## 26.2 Replay HUD

Minimal:
- score/time context
- camera mode
- playback controls when user owns replay
- player labels on demand

## 26.3 Highlight card

Contains:
- result/goal title
- scorer fictional display name
- technique
- distance/curve if meaningful
- match score
- challenge seed if applicable

No fake rarity badges.

---

# 27. Accessibility and readability

Minimum:
- colorblind-safe team palette options for protanopia/deuteranopia/tritanopia
- team identity never relies only on hue
- optional larger HUD scale
- reduced camera shake
- reduced flashes
- subtitles for tutorial voice/text if voice is added
- key remapping
- gamepad remapping
- high-contrast reticle option
- sound volume categories
- motion blur off by default or user-controlled

Readable states must survive grayscale screenshot testing where appropriate.

---

# 28. Onboarding

Target: >= 80% of blind testers finish onboarding without external explanation.

Teach by action:
1. move
2. camera
3. receive a slow pass
4. dribble through two gates
5. ground pass
6. driven shot
7. defend
8. simple skill move
9. support run / pass-and-move concept
10. short 2v2 bot scenario

No wall of controls before play.

---

# 29. Reference image system

This design requires a **192-image locked reference library** before large-scale final art production.

These are curated/generated visual references, not 192 shipping textures.

## 29.1 Exact reference count

| Reference group | Count |
|---|---:|
| Global visual north-star / quality bar | 12 |
| UI menus and HUD | 18 |
| Camera / gameplay readability | 12 |
| Movement / body-language / sports cinematography | 18 |
| Six character archetype modeling references | 36 |
| Four public-safe team identity/kit systems | 24 |
| Ball, boots, goal, and equipment | 10 |
| Football action key poses | 18 |
| Arena architecture, materials, lighting, crowd | 28 |
| VFX / goal celebration / impact restraint | 8 |
| Accessibility/readability comparison | 4 |
| Replay/highlight/social framing | 4 |
| **Total** | **192** |

## 29.2 Golden generated subset

Before Blender final modeling, approve **48 golden target images**:
- 12 style/quality targets
- 12 character/kit targets
- 12 arena/lighting targets
- 12 UI/VFX/replay targets

These are the frames AI agents compare against during production.

The full procedure is defined in `docs/art/FULL_IMAGE_PLAN.md`.

---

# 30. Reference image quality standard

Every reference must answer a question.

Forbidden reference annotation:
- “cool”
- “vibe”
- “realistic”

Required metadata:
- reference ID
- category
- source/generation provenance
- license/use status
- resolution
- target asset/screen
- what to copy
- what not to copy
- silhouette notes
- proportion notes
- material notes
- palette values if relevant
- lighting direction/quality
- camera estimate
- approval state
- reviewer notes

Primary modeling refs:
- >= 2048 px long edge
- neutral background where possible
- minimal perspective distortion
- controlled lighting
- no strong depth of field
- consistent scale cues

Primary UI refs:
- full 16:9 frame
- interaction state visible
- safe-zone annotated
- hierarchy annotated

---

# 31. AI-centered art production pipeline

The AI agent is expected to operate Blender rather than just tell the user what buttons to click.

Required AI pipeline:

1. read DESIGN.md
2. read FULL_IMAGE_PLAN.md
3. read BLENDER_AI_PIPELINE.md
4. inspect approved references
5. run setup/probe
6. create a versioned `.blend`
7. make greybox
8. render evidence
9. run automated geometry/scene checks
10. compare against target
11. revise
12. human review gate only at declared taste points
13. build final geometry/materials
14. LOD/UV/rig/animation as applicable
15. export GLB
16. validate GLB
17. load in engine
18. capture in-engine comparison
19. performance gate
20. commit source metadata and runtime asset

---

# 32. Using `nicceasy/3d-product`

Use `/3d-product` as a **quality discipline and reference-driven Blender workflow**, not as a literal product-film template.

Adopt these principles:
- research first
- reference coverage matrix
- measured dimensions where possible
- greybox before expensive render
- low-cost preview ladder
- first/key/last frame review for cinematics/menu hero scenes
- material swatch sheets
- composition sheets
- explicit performance/scene-weight budget from the start
- version up, do not destructively overwrite approved work
- measurable gate at every stage
- render evidence before claiming completion

Use it directly for:
- football/boot/prop hero renders
- badge/kit presentation renders
- arena material/lookdev
- menu hero scenes
- lighting studies
- replay/marketing shot grammar

Adapt it for runtime game assets by adding:
- topology budget
- LODs
- UV/texel density
- skeleton/rig requirements
- collision proxy
- GLB export
- KTX2 textures
- runtime shader compatibility
- in-engine FPS/memory review

Do **not** make these `/3d-product` optional/paid pieces required:
- Octane
- DaVinci Resolve Studio
- paid AI music/image services
- cloud render nodes
- FigJam

Use Blender Cycles/Eevee where appropriate, FFmpeg, and local/open tools on the mandatory path.

---

# 33. Blender MCP contract

Preferred AI control modes:

1. safety-aware Blender Agent Bridge or equivalent local Blender MCP with visual evidence and reversible edits
2. official Blender Foundation MCP in an isolated project environment
3. mature community `mcp-for-blender` fallback with paid generation integrations disabled

Security rules:
- Blender project directory contains no unrelated sensitive files
- checkpoint before arbitrary Python mutation
- external network disabled unless a task explicitly needs approved asset retrieval
- arbitrary Python only with explicit trusted session
- save versioned snapshots
- inspect viewport/render after mutation batch
- never report success based only on tool return code

---

# 34. Visual QA gates

## 34.1 Screenshot gate

For each major screen/asset:
- target reference frame
- current in-engine frame
- overlay/difference or annotated comparison
- reviewer verdict

## 34.2 Character gate

Must pass:
- scale
- silhouette
- topology
- LOD
- UV
- deformation
- material
- foot grounding
- ball-contact alignment
- engine performance

## 34.3 UI gate

Must pass:
- 1080p
- 1440p
- minimum supported desktop size
- keyboard
- mouse
- gamepad
- loading
- empty
- error
- offline/reconnect if relevant
- high-contrast/colorblind modes

## 34.4 Arena gate

Must pass:
- player/ball contrast from representative camera positions
- landmark readability
- draw call/triangle/texture budget
- stable frame time
- no collision mismatch
- no distracting flicker/moire

---

# 35. Playtest scorecard

Every milestone playtest records 1–10 scores for:
- movement responsiveness
- camera comfort
- ball control
- first-touch predictability
- passing satisfaction
- shooting satisfaction
- defensive fairness
- teammate usefulness
- opponent fairness
- HUD clarity
- ball readability
- visual quality
- audio impact
- desire to rematch

Open text:
- one thing that felt cheap
- one thing that felt premium
- one confusing moment
- one exploit attempted
- one moment worth clipping

The AI must convert repeated comments into tracked issues and measurable regression checks.

---

# 36. Quality targets before noncommercial alpha

Minimum:
- movement responsiveness median >= 8/10
- shooting/contact satisfaction median >= 8/10
- bot teammate usefulness median >= 7.5/10
- >= 70% testers voluntarily rematch after first completed match
- >= 80% blind testers complete onboarding without help
- stable target 60 FPS, 1% low >= 50 FPS on reference desktop
- no critical authoritative-score exploit
- no dominant uncounterable technique
- at least several testers voluntarily save/share a replay, clip, or challenge code
- login is optional for first solo play
- authenticated user can cloud-save and appear on an appropriate verified leaderboard

---

