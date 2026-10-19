# SoccerShooter Stages 01–10 — Engineering Foundation Handoff

## Scope

This document records the requested **Stage 01 through Stage 10 foundation**. “Foundation complete” means the code, data contracts, deterministic simulations, automated acceptance tests, build/content guards, and stage integration needed to continue development are present and are required to pass the repository-wide CI suite on the exact branch head.

It does **not** mean a human playtest occurred. Any criterion that inherently asks whether a person finds movement responsive, football realistic, tactics readable, onboarding understandable, or play fun remains deferred rather than silently converted into an automated pass.

## Stage status

| Stage | Engineering foundation | Human-only acceptance still deferred |
| --- | --- | --- |
| 01 Product contract | **PASS** | none required for the foundation |
| 02 Technical foundation | **PASS** | none required for the foundation |
| 03 Movement, camera, input | **PASS** | subjective responsiveness, camera comfort, and visual movement feel |
| 04 Ball physics | **PASS** | perceived football realism/feel beyond measured physical invariants |
| 05 Core football | **PASS** | subjective dribble/pass/shot/tackle satisfaction and fun |
| 06 Tactical bots | **PASS** | human judgment of tactical readability/support/recovery behavior |
| 07 Adaptive bots | **PASS** | human preference evidence before any learned policy is promoted; research policy remains production-disabled |
| 08 Techniques and evolutions | **PASS** | human explainability, readability, and timing feel |
| 09 Road to Legend | **PASS for engineering foundation** | a new tester completing Act 1 without developer explanation; broader campaign UX playtest |
| 10 Content architecture | **PASS** | visual/content taste review only; deployable mode remains `FICTIONAL_PUBLIC` |

## Stage 09 closure added in this pass

The previous remaining engineering gap was Road to Legend comparative/tactical proof. The continuation work closes that gap without changing the repaired authoritative football laws:

- the physical headless campaign runs every authored encounter from start through final;
- each act uses its authored opponent archetype;
- technical, pace, and power builds all complete the same physical campaign;
- the three builds use distinct deterministic tactical policies and produce distinct physical contact/possession signatures and checksums;
- authored high-press, deep-block, counterattack, aerial-team, elite-keeper, possession-overload, and aggressive-marking problems now change bounded live challenge conditions rather than only labels;
- live tactical conditions reuse existing pressure, recovery, playable-space, and keeper-height hooks;
- true Legacy gauntlets remain seeded, independently labeled, and mechanically separate;
- progression still advances only from the physical goal event path, not from UI shortcuts.

## Preserved football invariants

The Stage 01–10 foundation must continue to preserve these rules:

1. The ball remains an independent physical state. Possession never welds the ball to the player.
2. Contact impulses are applied only through legal contact plans and are revalidated at the contact tick.
3. Movement acceleration, braking, planting, and reversal remain bounded by the repaired athletic-motion envelope.
4. Dribble planning treats stored trajectories as world-space positions and does not double-add actor origin.
5. Strike input may buffer a legal approaching contact, but actual foot reach is not enlarged.
6. Presentation/animation cannot mutate authoritative simulation outcomes.
7. Deterministic replay/rollback cannot duplicate authoritative events.
8. Bot adaptation cannot secretly change physical rules or enable PvP adaptive advantages.
9. Production content mode is `FICTIONAL_PUBLIC`; private reference material must fail production validation.
10. Learned-policy work remains research-only until its separate human preference gate is satisfied.

## Automated release gate for this foundation

The exact branch head is not considered machine-complete unless the full CI workflow succeeds, including:

- authoritative-source and private-content guards;
- TypeScript typecheck;
- complete unit/contract suite;
- deterministic million-launch ball fuzz;
- Stage 05 football action/contact fuzz;
- Stage 05 exploit-bot balance gate;
- Stage 06 tactical tournament;
- Stage 07 adaptive cognition tournament;
- Stage 07 learned-policy research benchmark with production promotion disabled;
- standalone determinism trace;
- negative private-content production probe;
- `FICTIONAL_PUBLIC` server/web production build and health check;
- Chromium installation and full Playwright/browser-vs-Node determinism parity.

## Deferred human return checklist

When the owner returns, human testing can start from this foundation instead of blocking implementation. The highest-value checks are acceleration/braking and 90°/180° cuts, normal/precision/sprint dribble pockets, moving knock-on into pass/shot, foot planting/contact synchronization, pressure/off-balance touches, tactical challenge readability, camera comfort, technique readability, and first-time Act 1 onboarding.

A failed subjective check should produce a focused tuning issue. It should not automatically reopen the ball solver or discard deterministic invariants unless evidence identifies those systems as the cause.

## Integration policy

This foundation lives on the continuation PR/branch until explicitly merged by the owner. Passing automation is necessary for integration, but no document in this repository should claim a human playtest happened during this unattended completion pass.
