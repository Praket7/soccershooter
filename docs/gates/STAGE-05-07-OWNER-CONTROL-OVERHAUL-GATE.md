# Stage 05–07 Owner Control Overhaul Gate

**Branch:** `stage/05-07-owner-control-overhaul`  
**Gate type:** engineering + owner feel acceptance  
**Current decision:** **REOPENED / BLOCKED BY STAGE 05R OWNER-FEEL REMEDIATION**

## Owner rejection supersedes the earlier engineering green

The owner completed a 74.87 s manual playtest on 2026-10-18/19 and explicitly rejected the current dribbling/movement feel. That verdict is authoritative for the subjective Stage 05 feel gate.

The pre-remediation functional head is `8d5f2099b2b87d9f02ad42da3abc848d143a2377`. The Stage 05R implementation plan was added at `2cc2feb72cbfae40ac2e67a4acbe5bdaa3f707f5`.

Automated green status on the old controller **must not** be interpreted as owner approval. The existing bounded-separation and deterministic-control tests remain useful regressions, but they do not prove professional contact provenance or human feel.

Stage 05R is governed by:

- `docs/superpowers/plans/2026-10-19-professional-motion-dribbling-overhaul.md`
- `docs/gates/STAGE-05R-PLAYTEST-BASELINE.md`
- `docs/research/STAGE-05R-MOTION-DRIBBLING-BASIS.md`

The normal Stage 05R release gate remains closed until the owner completes the required micro-playtest and accepts the revised feel. The owner's explicit 2026-10-19 request to push to `main` is a one-time integration authorization; it does not waive, pass, or supersede any Stage 05R sequencing or feel-acceptance criteria.

## Automated blocking checks

The final branch head must pass, from a fresh checkout:

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

The CI workflow additionally verifies authoritative-source/private-content guards and the FICTIONAL_PUBLIC shell.

## Required behavioral evidence

The following legacy contracts remain required unless Stage 05R replaces them with a stricter equivalent:

- capture click emits no football action;
- permanent locked reticle and camera-center world aim are present;
- F receive buffer supports kill and controlled-exit semantics;
- E/Q/R decode into explicit ground/through/lofted pass families;
- RMB+E decodes as driven ground pass;
- Ctrl+Q decodes as chipped through pass;
- RMB+LMB latches finesse at shot start and remains finesse if RMB is released before LMB;
- Ctrl+LMB latches chip at shot start and remains chip if Ctrl is released before LMB;
- Ctrl is no longer a tackle alias; C remains the primary tackle key and B remains a fallback;
- Z/X do not activate the normal advanced pass/shot modifiers;
- no player action teleports or rigidly attaches the ball;
- sprint touches remain longer/riskier than normal or precision touches;
- close control reduces movement authority and disables sprint;
- aim-cone receiver selection respects deliberate open space;
- shot feedback exposes preparation/contact/failure and technique states;
- physical bot scrimmage does not weld ball to a carrier;
- physical bot scrimmage produces real contacts, loose-ball windows and control changes;
- difficulty tiers preserve identical physical constants;
- Stage 02 determinism, Stage 04/05 fuzz, Stage 06 tournament and Stage 07 adaptive gates remain green.

Stage 05R additionally requires:

- routine dribble cadence comes from gait/contact opportunity rather than `controlTouchCooldown`;
- every routine dribble impulse has a planned foot, contact tick and legal geometry;
- the ball remains free between contacts;
- a missed contact can produce a true loose-ball chase state;
- normal/precision dribbling contains no continuous lateral corridor servo;
- render cadence cannot change authoritative contact timing;
- owner manual playtest confirms a meaningful improvement before sprint/skill migration continues.

## Regression tests added for owner playtest round 2

The previous owner-feedback tests remain regression coverage, but their interpretation is narrowed:

1. `packages/sim/src/football/controlEnvelope.owner.test.ts` protects bounded legacy contact behavior while migration proceeds.
2. `packages/sim/src/football/runtime.test.ts` protects shot-technique latching and legacy paths still using cooldowns.
3. `apps/web/src/input/ActionMap.owner-overhaul.test.ts` protects Ctrl/C/B/Z/X keyboard semantics.
4. `packages/sim/src/football/actionIntent.test.ts` protects RMB/precision and Ctrl/lift intent composition.
5. `e2e/football-practice.spec.ts` protects browser chords and basic physical possession behavior.

These are not, by themselves, a professional-feel certificate.

## Integration status

The owner explicitly requested a push to `main` on 2026-10-19, authorizing that integration despite the normal release hold. This does not certify the subjective Stage 05R feel gate or retroactively satisfy the required intermediate Task 3 micro-playtest. The final owner playtest and scorecard remain pending. Stage 05/06/07 checkpoint branches remain preserved as independent history.
