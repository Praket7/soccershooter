# Stage 09 — Engineering Gate

**Plan:** `docs/superpowers/plans/stages/09-road-to-legend.md`
**Status:** local progression and deterministic benchmark PASS; Act 1 usability playtest remains open.

## Evidence

- Fresh local profile starts at OVR 67 with basic mechanics and three limited technique slots.
- Versioned v1→v2 migration, IndexedDB/local-storage adapters, JSON import/export, reward ledger anti-farming, medals, XP, mastery, evolution unlocks, and temporary run choices are implemented and tested.
- Six data-driven campaign acts cover the seven planned tactical problems; deterministic skilled-agent simulation clears every encounter and records highlights.
- Three freely switchable archetypes expose different timing, sprint-stamina, and strike-power modifiers. Legacy provides seeded, escalating modifier gauntlets, perfect-clear objectives, personal bests, and prestige cosmetics at milestone levels.
- The Road to Legend screen displays the seven campaign/Legacy entries, local baseline, team badges, build selector, and save tools. Browser coverage changes and persists a build selection.
- `packages/progression/src/progression.test.ts` verifies a full deterministic campaign run for all three archetypes, campaign completion, legacy continuation, reward anti-farming, migration, and free switching.
- Full `pnpm lint`, `pnpm typecheck`, and `pnpm test` pass (335 tests); full Playwright run passes 47/47.

## Open human check

The plan requires a new tester to complete Act 1 without developer explanation. No owner usability session was available during this implementation, so that gate is pending.
