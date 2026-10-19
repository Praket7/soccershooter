# Stage 09 — Engineering Gate

**Plan:** `docs/superpowers/plans/stages/09-road-to-legend.md`
**Status:** partial engineering proof; Stage 09 exit gate remains open.

## Evidence

- Fresh local profile starts at OVR 67 with basic mechanics and three limited technique slots.
- Versioned v1→v2 migration, IndexedDB/local-storage adapters, JSON import/export, reward ledger anti-farming, medals, XP, mastery, evolution unlocks, and temporary run choices are implemented and tested.
- Six data-driven campaign acts define nine encounters across eight tactical problems. The seeded headless benchmark records physical goal crossings, simulation ticks, legal contacts, and checksums. It runs the same standard bot behavior for all archetype labels, so identical clears (9/9, 660 ticks, 81 contacts at seed 1234) are not evidence of comparative build viability.
- The career screen now starts the current challenge in practice. The challenge exposes its tactical prompt, and only a ball crossing the physical goal plane awards the encounter, advances the profile, saves progress, and returns to career. Abandoning awards the bounded loss result; after campaign completion, a Legacy gauntlet can be started and progressed by scoring a physical goal. Browser tests cover challenge start and abandonment; actual owner/new-tester completion remains untested.
- Three freely switchable archetypes change contact timing, sprint stamina drain, and shot power in practice. The power modifier caps the target launch speed at 36 m/s and impulse at 15.5 Ns, and rebuilds the command against the ball's incoming velocity. Tests apply that command to moving-ball snapshots, including an extreme incoming case that remains limited by the existing impulse envelope; browser probes verify pace/power settings reach the live practice surface.
- `packages/progression/src/progression.test.ts` verifies physical headless goal evidence, reward anti-farming, migration, legacy continuation, and free switching. `e2e/stage09-road-to-legend.spec.ts` covers career display, challenge start, abandonment, and practice modifier wiring.
- Latest local checks pass: `pnpm lint`, `pnpm typecheck`, `pnpm test` (81 files / 338 tests), `pnpm build`, and `pnpm test:e2e` (48/48). The public production bundle check passes; Vite reports a 771.67 kB minified JS chunk above its 500 kB advisory threshold.

## Open human check

The plan requires a new tester to complete Act 1 without developer explanation and at least three materially viable build paths. Both remain unverified. The headless benchmark uses authored tactical start states with one generic bot behavior; the live challenge is a physical-goal practice scenario without distinct tactical opponents or full match play. Those are engineering gaps, in addition to the pending owner usability session. Legacy's escalating modifiers are represented in progression data, but have not yet been applied to a live challenge simulation.
