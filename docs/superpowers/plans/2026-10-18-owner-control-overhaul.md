# SoccerShooter Stage 05–07 Owner Control Overhaul Implementation Plan

**Goal:** Replace the Stage 05 interaction vocabulary with explicit football intent and prove Stage 06/07 bots inside the same physical 3D football loop before any later-stage work.

**Architecture:** Preserve the Stage 03 deterministic movement and Stage 04 physical ball. Extend the shared action/football runtime with explicit pass/receive/modifier intents. The browser maps pointer lock and center-reticle world aim into those intents. The tactical bot layer continues choosing high-level actions, but a new physical scrimmage adapter realizes those actions through shared legal control/pass/shot/challenge contacts rather than symbolic possession.

**Tech stack:** TypeScript, Three.js, shared `packages/sim` football contacts, `packages/physics` ball stepping, Stage 06/07 deterministic bots, Vitest, Playwright.

**Design spec:** `docs/superpowers/specs/2026-10-18-owner-control-overhaul-design.md`

## Constraints

- branch from Stage 07 head; do not rewrite Stage 05/06/07 checkpoint branches;
- no changes to `main`;
- physical ball never teleports or rigidly attaches;
- difficulty never changes physical rules;
- TDD: every changed contract begins RED;
- full Stage 01–07 CI remains blocking;
- owner feel acceptance remains human and cannot be self-certified.

## Task 1 — Input contract and pointer-lock separation

**Files:**
- `apps/web/src/input/ActionMap.owner-overhaul.test.ts` (new)
- `apps/web/src/input/ActionMap.ts`
- `packages/sim/src/player/PlayerState.ts`
- `apps/web/src/input/GamepadAdapter.ts` if required for parity

**RED:** prove an unlocked primary press produces capture intent only; prove locked primary press maps shoot; prove F/E/Q/R plus Z/X modifiers produce distinct device-agnostic bits.

**GREEN:** add explicit action bits and a pointer-down resolver with lock-state input. Pointer capture must be semantically separate from gameplay action emission.

**Verify:** focused Vitest + typecheck.

## Task 2 — Receive intent and deterministic buffer

**Files:**
- `packages/sim/src/football/receive.test.ts` (new)
- `packages/sim/src/football/receive.ts` (new)
- `packages/sim/src/football/runtime.ts`
- `packages/sim/src/football/controlEnvelope.ts`

**RED:** early F arms receive; buffer expires deterministically; F+zero movement requests kill; F+movement requests controlled exit; cancel/failure reason is observable.

**GREEN:** implement a small receive-intent state machine and pass explicit `receiveMode` into legal control-touch generation. Remove trap eligibility dependence on precision+idle input.

**Verify:** receive tests, football tests, football fuzz.

## Task 3 — Dedicated passing and shot modifiers

**Files:**
- `packages/sim/src/football/actionIntent.test.ts` (new)
- `packages/sim/src/football/actionIntent.ts` (new)
- `apps/web/src/dev/FootballPractice.ts`
- `apps/web/src/main.ts`

**RED:** E ground, Q through, R lofted, Z+E driven, Z+Q chipped-through; LMB normal, Z+LMB finesse, X+LMB chip.

**GREEN:** centralize action decoding so browser and future bot/gamepad callers share one deterministic mapping. Remove normal reliance on the 1–6 selector.

**Verify:** unit tests + Stage 05 browser regression.

## Task 4 — World aim and visible intent

**Files:**
- `apps/web/src/input/WorldAim.test.ts` (new)
- `apps/web/src/input/WorldAim.ts` (new)
- `apps/web/src/dev/FootballPractice.ts`
- `apps/web/src/main.ts`
- `apps/web/src/styles.css`
- `e2e/football-practice.spec.ts`

**RED:** center camera ray yields deterministic ground/goal-plane aim; unlocked overlay visible; locked reticle visible; pass lane/receiver/lead state is exposed; first capture click cannot charge.

**GREEN:** add center reticle/capture overlay and aim-ray helpers; use world aim target to derive football aim direction; show advisory pass lane, selected receiver ring/lead marker and shot charge/goal marker.

**Verify:** focused browser tests at 1080p-equivalent viewport plus build.

## Task 5 — Sharp-turn carry timing

**Files:**
- `packages/sim/src/football/controlEnvelope.owner.test.ts`
- `packages/sim/src/football/controlEnvelope.ts`
- `packages/sim/src/football/runtime.test.ts`
- `packages/sim/src/football/runtime.ts`

**RED:** 70°+ requested heading change produces a shorter next-touch interval; hard turn brakes old travel vector; precision and sprint retain distinct recoverable envelopes.

**GREEN:** make control-touch cadence depend on touch mode and requested turn severity while keeping bounded impulses.

**Verify:** control tests + fuzz/checksum.

## Task 6 — Aim-first receiver/lane selection

**Files:**
- `packages/sim/src/football/passing.owner-overhaul.test.ts` (new)
- `packages/sim/src/football/passing.ts`
- browser practice feedback files

**RED:** candidate outside aim cone cannot steal selection; clear open-space aim returns no selected receiver; selected through receiver exposes solver lead point; blocked lane loses score.

**GREEN:** add deterministic candidate-ranking helper around existing pass solver and expose lead/lane telemetry.

**Verify:** unit/fuzz/browser tests.

## Task 7 — Physical 3v3 scrimmage core

**Files:**
- `packages/bots/src/physicalScrimmage.test.ts` (new)
- `packages/bots/src/physicalScrimmage.ts` (new)
- shared football/physics imports only; no renderer dependency

**RED:** ball never copies carrier transform; a dribble is a legal control contact; pass/shot update actual velocity; interception/challenge can create loose state; same seed reproduces trace; difficulty physical snapshot invariant.

**GREEN:** build a deterministic headless 3v3 adapter that converts Stage 06 `TeamBotIntent` high-level choices into Stage 05 physical contact commands and steps Stage 04 ball physics. Possession is inferred from control context and may be null.

**Verify:** new scenario tests, Stage 06/07 tournaments, determinism.

## Task 8 — 3D physical scrimmage browser surface

**Files:**
- `apps/web/src/dev/PhysicalBotScrimmage.ts` (new)
- `apps/web/src/dev/BotTacticalLab.ts`
- `apps/web/src/dev/AdaptiveBotLab.ts`
- `apps/web/src/main.ts` or bootstrap module
- `apps/web/src/styles.css`
- `e2e/physical-bot-scrimmage.spec.ts` (new)

**RED:** Physical 3v3 mode must expose six actors, one free physical ball, loose-ball counter, real contact events, difficulty/personality controls, and physical-invariance proof.

**GREEN:** render the headless physical scrimmage in Three.js using lightweight greybox actors and existing pitch/camera language. Rename/explain 2D Tactical Bot Lab as Tactical Debug. Reuse Stage 07 controls in the new 3D mode; retain static cards as optional debug detail.

**Verify:** Playwright, no browser console errors, deterministic state probes.

## Task 9 — Documentation, gate and full verification

**Files:**
- `docs/decisions/STAGE-05-07-OWNER-CONTROL-OVERHAUL-RULINGS.md`
- `docs/handoffs/STAGE-05-07-OWNER-CONTROL-OVERHAUL-HANDOFF.md`
- `docs/gates/STAGE-05-07-OWNER-CONTROL-OVERHAUL-GATE.md`

**Run on fresh head:**

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm ball:fuzz
pnpm football:fuzz
pnpm football:balance
pnpm bots:tournament
pnpm bots:adaptive-tournament
pnpm bots:learning-lab
pnpm determinism:headless
pnpm build
pnpm test:e2e
```

Record exact counts, checksums and CI run IDs. Engineering green does **not** authorize merge to main. Stop at owner playtest gate.
