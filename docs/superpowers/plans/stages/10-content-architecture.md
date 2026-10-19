# Stage 10 — Team, Roster, and Content Architecture

## AI execution mode

**Primary AI role:** Content/Schema + IP Boundary Agent

This stage is executed by AI under `docs/ai/AI_EXECUTION_CONTRACT.md`. Before any change, the worker must read `/DESIGN.md`, the master plan, this stage, the previous gate, and every subsystem document linked below. The AI must produce the cheapest measurable proof first, write tests before implementation where applicable, capture evidence, and stop rather than beginning a future stage when this stage's gate fails.

**Required AI output for this stage:** implementation or artifact changes, automated tests/validators, evidence paths or reproducible seeds, a concise worker handoff, and the stage gate report. “Looks good” and “runs locally” are not acceptance evidence.


> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Use checkbox steps for progress.

**Tech Stack:** TypeScript content packs, build-time guards, SVG/JSON assets

**Spec:** `docs/superpowers/specs/2026-10-17-soccershooter-design.md`  
**Master:** `docs/superpowers/plans/2026-10-17-soccershooter-master.md`

## Global Constraints

- No credit card, paid/timed trial, or adult-only account dependency.
- `FICTIONAL_PUBLIC` is the only deployable content mode.
- Simulation correctness outranks presentation shortcuts.
- Tests and measured gate evidence are required before the next stage.
- Do not implement later-stage scope unless a minimal interface is required to test this stage.

## Review Focus

- private data leakage
- copied brand geometry
- confusable team identity
- roster schema instability
- production mode misconfiguration

## Planned File Map

- `packages/content/src/teams/schema.ts`
- `packages/content/src/teams/blaugrena.ts`
- `packages/content/src/teams/royalWhites.ts`
- `packages/content/src/teams/oilNorth.ts`
- `packages/content/src/teams/oilCapital.ts`
- `packages/content/src/contentMode.ts`
- `packages/content/src/contentGuard.test.ts`
- `private/reference-content/.gitkeep`

---

**Goal:** Support distinctive football identities while making accidental private-reference leakage structurally impossible.

**Architecture:** Typed content packs implement one interface. Public pack is repository-native. Reference pack is local-only and CI-blocked.

## Public teams

### Blaugrena
- technical possession
- deep garnet / rich blue / warm gold
- original badge and kit
- fictional roster

### Royal Whites
- elite transition
- white / navy / champagne gold
- original badge and kit
- fictional roster

### Oil Company North
- positional press
- sky blue / charcoal / copper
- original badge and kit
- fictional roster

### Oil Company Capital
- speed/flair
- navy / crimson / warm gold
- original badge and kit
- fictional roster

## Reference-private mapping
May locally store real:
- names
- numbers
- role
- preferred foot
- broad physical notes
- manually observed style tags

Never commit player photos, face scans, club crests, copied kit textures, sponsor marks, or scraped likeness assets.

## Interface

```ts
interface TeamDefinition {
  id: string;
  displayName: string;
  palette: TeamPalette;
  badgeAsset: string;
  homeKit: KitDefinition;
  awayKit: KitDefinition;
  tacticalProfile: TacticalProfileId;
  roster: PlayerDefinition[];
}
```

## Guardrails
- production asserts fictional content mode
- build scans for private directory references
- private mode shows watermark
- public SVG badges live in source and are original
- stable roster IDs separate from display names

## Implementation Task Sequence

- [x] **Task 1:** Write failing production-build tests for private-mode activation and private-string leakage.
- [x] **Task 2:** Implement typed team, kit, roster, palette, and tactical-profile schemas.
- [x] **Task 3:** Create four fictional public team definitions with stable IDs.
- [x] **Task 4:** Create original SVG badge placeholders and original kit-layout metadata.
- [x] **Task 5:** Implement content-mode loader and visible private-reference watermark.
- [x] **Task 6:** Implement build-time guard that rejects private imports in production.
- [x] **Task 7:** Implement bundle text scan for private names/paths.
- [x] **Task 8:** Run public build and verify only fictional assets/strings are present.

## Tests
- every public team loads
- palettes meet contrast/readability requirements
- every roster has required roles
- production build fails in private mode
- private strings absent from production bundle text scan

## Exit gate
Public build contains four distinct teams and zero private-reference strings/assets.
