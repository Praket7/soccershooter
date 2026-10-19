# Stage 08 — Engineering Gate

**Plan:** `docs/superpowers/plans/stages/08-techniques-evolutions.md`
**Status:** automated engineering PASS; human technique-usability check remains open.

## Evidence

- 20 declarative techniques span dribble, pass/shot, and aerial families.
- Five evolution chains change execution mechanics: phantom-step, whipped-curl, thunder-strike, threaded-ball, and acrobat.
- Eligibility, stamina, cooldown, windup, bounded contact, interruption recovery, and readable counter windows are deterministic and covered by unit tests.
- The practice selector and `T` action connect selected techniques to physical contact execution; the debug HUD exposes eligibility, timing, and failure reasons.
- Technique tournament: seed `0x8a11ce`, 512 trials per technique, dominant contribution share `0.0699238` (gate threshold `<0.16`).
- Browser proof: `e2e/stage08-techniques.spec.ts` verifies windup, counter window, and contact. It passes in the full 47-test Playwright run.
- Full `pnpm lint`, `pnpm typecheck`, and `pnpm test` pass (335 tests total).

## Open human check

The plan asks testers to explain when two different techniques are appropriate. This requires a human playtest and remains unverified.
