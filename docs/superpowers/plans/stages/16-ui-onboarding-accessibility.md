# Stage 16 — UI, Onboarding, Training Academy, and Accessibility

## AI execution mode

**Primary AI role:** UI/UX + Accessibility Agent

This stage is executed by AI under `docs/ai/AI_EXECUTION_CONTRACT.md`. Before any change, the worker must read `/DESIGN.md`, the master plan, this stage, the previous gate, and every subsystem document linked below. The AI must produce the cheapest measurable proof first, write tests before implementation where applicable, capture evidence, and stop rather than beginning a future stage when this stage's gate fails.

**Required AI output for this stage:** implementation or artifact changes, automated tests/validators, evidence paths or reproducible seeds, a concise worker handoff, and the stage gate report. “Looks good” and “runs locally” are not acceptance evidence.


> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Use checkbox steps for progress.

**Tech Stack:** TypeScript, DOM/CSS UI, Playwright, browser accessibility APIs

**Spec:** `docs/superpowers/specs/2026-10-17-soccershooter-design.md`  
**Master:** `docs/superpowers/plans/2026-10-17-soccershooter-master.md`

## Global Constraints

- No credit card, paid/timed trial, or adult-only account dependency.
- `FICTIONAL_PUBLIC` is the only deployable content mode.
- Simulation correctness outranks presentation shortcuts.
- Tests and measured gate evidence are required before the next stage.
- Do not implement later-stage scope unless a minimal interface is required to test this stage.

## Review Focus

- tutorial deadlocks
- menu complexity
- inaccessible control remap
- settings not persisting
- player not learning teamwork

## Planned File Map

- `apps/web/src/ui/AppShell.ts`
- `apps/web/src/ui/Hud.ts`
- `apps/web/src/ui/Settings.ts`
- `apps/web/src/ui/RemapControls.ts`
- `apps/web/src/training/AcademyFlow.ts`
- `apps/web/src/training/PositioningLesson.ts`
- `packages/ui-contracts/src/index.ts`
- `apps/web/tests/onboarding.spec.ts`

---

**Goal:** Let a stranger understand and enjoy the game without developer coaching.

**Architecture:** DOM/CSS UI over canvas for accessibility and maintainability. UI consumes typed game/view-model contracts rather than reading simulation internals ad hoc.

## First-session flow
1. fast loading shell
2. local guest profile
3. sensitivity/control setup
4. movement drill
5. first-touch drill
6. pass + support-run drill
7. shot drill
8. defensive timing drill
9. short 2v2/3v3 match
10. Road to Legend start

Target: player reaches meaningful football quickly.

## Menus
- Play
- Road to Legend
- Quick Match
- Training
- Techniques
- Replays
- Settings

Avoid deep nested menu clutter.

## HUD
Only essential live information:
- score/clock
- stamina
- technique slots/cooldowns
- subtle pass/shot context
- teammate call/availability cues
- optional tactical debug in training only

## Academy lessons
- first touch
- passing lanes
- support/off-ball movement
- curve vs driven vs chip
- defender patience/timing
- keeper positioning

Teach positioning through overlays plus replay, not text walls.

## Accessibility/settings
- remappable keyboard controls
- controller remap/support
- sensitivity/invert
- camera shake slider/off
- motion/speed effect slider/off
- color/contrast presets
- UI scale
- performance preset
- subtitle/caption support for essential tutorial/audio cues if applicable
- toggleable assist settings for solo/training only

## Implementation Task Sequence

- [ ] **Task 1:** Write Playwright flows for onboarding completion, settings persistence, keyboard navigation, and controller-ready UI state.
- [ ] **Task 2:** Implement fast local guest profile/start flow.
- [ ] **Task 3:** Implement Play, Road to Legend, Quick Match, Training, Techniques, Replays, and Settings navigation.
- [ ] **Task 4:** Implement minimal live HUD and contextual action cues.
- [ ] **Task 5:** Implement movement, first-touch, support/pass, shooting, defense, and keeper academy lessons.
- [ ] **Task 6:** Implement remapping, sensitivity, invert, UI scale, shake/motion controls, contrast options, and performance preset.
- [ ] **Task 7:** Implement tutorial recovery so unexpected player actions cannot deadlock progression.
- [ ] **Task 8:** Run blind onboarding usability cohort and revise until completion/readability targets pass.

## Tests
- full UI keyboard navigation where applicable
- no menu traps focus
- settings persist
- gameplay can be completed with controller
- tutorials cannot deadlock if player does unexpected action
- save corruption falls back safely and offers export/reset

## V2 UI/auth/leaderboard presentation scope

UI implementation must reproduce the target hierarchy in `/DESIGN.md` and the U001–U018 reference set in `docs/art/FULL_IMAGE_PLAN.md`. Required screen coverage now includes first-run Guest/Google/Email choices, account linking, profile, Global/Daily/Weekly leaderboard views, cloud-save status, offline state, and replay library.

Do not block the first bot match behind authentication. Do not show email on any public profile or leaderboard. UI must pass grayscale/readability and color-vision checks in addition to visual comparison.

## Exit gate — Usability
With testers who have not read the docs:
- >=80% complete onboarding without help
- median “I knew what to do” >=8/10
- at least 70% can explain why a support run/pass matters
- time from launch to first actual match remains short
