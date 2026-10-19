# Stage 09 — Engineering Gate

**Plan:** `docs/superpowers/plans/stages/09-road-to-legend.md`  
**Status:** machine-verifiable engineering foundation complete; human onboarding acceptance deferred.

## Evidence

- Fresh local profile starts at OVR 67 with basic mechanics and three limited technique slots.
- Versioned v1→v2 migration, IndexedDB/local-storage adapters, JSON import/export, reward-ledger anti-farming, medals, XP, mastery, evolution unlocks, and temporary run choices are implemented and tested.
- Six data-driven campaign acts define nine encounters across eight tactical problems. The seeded headless benchmark records physical goal crossings, simulation ticks, legal contacts, possession changes, contact-type playstyle metrics, and deterministic checksums.
- Each act supplies its authored opponent archetype to distinct physical-bot personalities. Technical, pace, and power builds now use distinct tactical policies while sharing the same authoritative movement, collision, stamina-capacity, contact, and free-ball laws. All three complete the same deterministic physical campaign and produce distinct playstyle signatures/checksums.
- The live career challenge now turns authored tactical problems into bounded existing simulation conditions rather than labels only. High press/aggressive marking change contact pressure, possession overload/deep block compress playable space, counterattack changes recovery timing, and aerial/elite-keeper problems change legal keeper save height. These conditions reuse existing authoritative hooks and do not alter the repaired ball solver or grant magnetic possession.
- Normal campaign tactical conditions are not exposed to the player as Legacy. Seeded Legacy gauntlets retain their original independent pressure/small-pitch/quick-recovery/aerial-pressure behavior and presentation.
- The career screen starts the current challenge in practice. Only a physical whole-ball goal crossing awards the encounter, advances the profile, saves progress, and returns to career. Abandoning awards the bounded loss result.
- Three freely switchable archetypes continue to change contact timing, sprint stamina drain, and shot power in live practice, while the headless campaign now additionally proves distinct physical playstyle behavior instead of identical-label clears.
- `packages/progression/src/progression.test.ts` covers full physical campaign completion, deterministic three-build viability/signatures, authored opponent archetypes, reward anti-farming, migration, and Legacy continuation.
- `apps/web/src/dev/campaignChallengeModifiers.test.ts` covers bounded authored tactical conditions and their mapping onto existing authoritative challenge hooks.
- `e2e/stage09-road-to-legend.spec.ts` covers campaign challenge start/abandonment, archetype settings reaching live practice, authored high-press conditions reaching the live challenge without Legacy mislabeling, and seeded Legacy modifier delivery.

## Deferred human-only acceptance

The plan also asks for a new tester to complete Act 1 without developer explanation. The owner explicitly requested completion without human testing for this pass. That criterion is therefore **deferred, not passed**. No claim is made that subjective onboarding, fun, realism perception, or difficulty feel has been human validated.

The live user campaign remains a physical-goal challenge slice rather than a complete user-controlled full-team match presentation. Full-team physical campaign viability is proven headlessly, which is sufficient for the requested Stage 1–10 foundation but not a substitute for later UX/playtest acceptance.

## Gate result

- Headless start-to-final campaign: **PASS (automated)**
- Three viable machine-verified playstyle paths: **PASS (automated)**
- Progression choices materially alter physical behavior: **PASS (automated + browser probes)**
- Authored tactical problems materially alter live challenge conditions: **PASS (automated + browser probes)**
- Postgame Legacy continuation: **PASS (automated)**
- New tester completes Act 1 unaided: **DEFERRED (human-only)**

Stage 09 is closed as an **engineering-foundation gate** once the exact branch head passes the repository-wide CI suite. Human acceptance remains intentionally open.
