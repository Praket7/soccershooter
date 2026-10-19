# Stage 09 — Engineering Gate

**Plan:** `docs/superpowers/plans/stages/09-road-to-legend.md`
**Status:** physical encounter benchmark and build-path gameplay integration PASS; Act 1 usability playtest remains open.

## Evidence

- Fresh local profile starts at OVR 67 with basic mechanics and three limited technique slots.
- Versioned v1→v2 migration, IndexedDB/local-storage adapters, JSON import/export, reward ledger anti-farming, medals, XP, mastery, evolution unlocks, and temporary run choices are implemented and tested.
- Six data-driven campaign acts define nine encounters across eight tactical problems. The seeded benchmark runs each encounter through `stepPhysicalScrimmage`, the bot runtime, legal ball contacts, and ball physics; it records actual goal crossings, simulation ticks, contact counts, and checksums. Seed 1234 clears 9/9 encounters in 660 ticks with 81 physical contacts for each of the three profile labels.
- Three freely switchable archetypes expose different timing, sprint-stamina, and strike-power modifiers in the career screen and apply those modifiers in practice: contact timing window, sprint stamina drain, and shot impulse. `e2e/stage09-road-to-legend.spec.ts` switches pace and power profiles and verifies the selected values reach the live practice surface. The headless benchmark still uses the standard physical agent for each profile label and does not compare archetype-specific match outcomes; a comparative viability check remains open. Legacy provides seeded, escalating modifier gauntlets, perfect-clear objectives, personal bests, and prestige cosmetics at milestone levels.
- The Road to Legend screen displays the seven campaign/Legacy entries, local baseline, team badges, build selector, and save tools. Browser coverage changes and persists a build selection.
- `packages/progression/src/progression.test.ts` verifies seeded physical goal evidence, campaign completion for all three profile labels, legacy continuation, reward anti-farming, migration, and free switching.
- Latest local checks pass: `pnpm lint`, `pnpm typecheck`, `pnpm test` (80 files / 336 tests), `pnpm build`, and `pnpm test:e2e` (47/47). The public production bundle check passes; Vite reports a 765.36 kB minified JS chunk above its 500 kB advisory threshold.

## Open human check

The plan requires a new tester to complete Act 1 without developer explanation. No owner usability session was available during this implementation, so that gate is pending. The physical benchmark uses authored tactical start states and does not replace the new-tester usability test or comparative archetype viability check.
