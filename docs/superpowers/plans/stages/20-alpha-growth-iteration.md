# Stage 20 — Noncommercial Alpha, Feedback Loop, and Growth Iteration

## AI execution mode

**Primary AI role:** Lead Integrator + Alpha/Telemetry Agent

This stage is executed by AI under `docs/ai/AI_EXECUTION_CONTRACT.md`. Before any change, the worker must read `/DESIGN.md`, the master plan, this stage, the previous gate, and every subsystem document linked below. The AI must produce the cheapest measurable proof first, write tests before implementation where applicable, capture evidence, and stop rather than beginning a future stage when this stage's gate fails.

**Required AI output for this stage:** implementation or artifact changes, automated tests/validators, evidence paths or reproducible seeds, a concise worker handoff, and the stage gate report. “Looks good” and “runs locally” are not acceptance evidence.


> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Use checkbox steps for progress.

**Tech Stack:** GitHub release workflow, local/self-host server, privacy-preserving telemetry

**Spec:** `docs/superpowers/specs/2026-10-17-soccershooter-design.md`  
**Master:** `docs/superpowers/plans/2026-10-17-soccershooter-master.md`

## Global Constraints

- No credit card, paid/timed trial, or adult-only account dependency.
- `FICTIONAL_PUBLIC` is the only deployable content mode.
- Simulation correctness outranks presentation shortcuts.
- Tests and measured gate evidence are required before the next stage.
- Do not implement later-stage scope unless a minimal interface is required to test this stage.

## Review Focus

- expanding content before retention
- feedback bias
- privacy creep
- release containing private assets
- retention tricks that harm fairness

## Planned File Map

- `docs/ALPHA_RELEASE_CHECKLIST.md`
- `docs/PLAYTEST_PROTOCOL.md`
- `docs/PRIVACY.md`
- `docs/SELF_HOSTING.md`
- `docs/FEEDBACK_ANALYSIS.md`
- `.github/workflows/release.yml`
- `apps/web/src/telemetry/LocalTelemetry.ts`
- `packages/telemetry/src/metrics.ts`

---

**Goal:** Release a rights-clean noncommercial alpha that people voluntarily replay and use real behavior to decide what deserves expansion.

**Architecture:** Public-safe static/browser client plus local/self-hosted multiplayer instructions. Telemetry is privacy-preserving and optional/local-first where possible. Expansion is gated by retention and qualitative feedback, not by feature wishlists.

## Alpha content target
Keep it deliberately focused:
- Road to Legend first full route
- four public-safe teams
- one premium arena + one lightweight training arena
- 3v3 core
- bots + humans
- >=12 techniques and >=4 evolution chains
- one elite/final tournament
- local guest profile
- persistent XP/mastery
- seeded challenge
- replays
- highlight export/replay sharing
- settings/accessibility

Do not add more content before validating retention.

## GitHub release workflow
- tag version
- attach build notes
- publish public-safe client where allowed
- provide local/self-host server instructions
- include known issues
- include asset-license/provenance manifest
- include privacy note
- include feedback link/process that does not require adult-only service

## Playtest cohorts
Run staged exposure:
1. internal/dev
2. 5–10 trusted testers
3. 20–50 testers
4. wider alpha only after crash/perf blockers are fixed

## Collect
Quantitative:
- tutorial completion
- first-match completion
- rematch rate
- Road-to-Legend continuation
- quit points
- technique usage
- bot match satisfaction
- frame/perf profile

Qualitative:
- “what was most fun?”
- “what felt unfair?”
- “when did you feel in control?”
- “when did the ball feel wrong?”
- “which teammate behavior helped/hurt?”
- “would you send this clip/game to a friend?”

## Growth experiments
Only test one major variable at a time:
- tutorial length
- first arena reveal
- first technique unlock timing
- challenge-code placement
- highlight prompt timing
- rematch UI

Do not manipulate difficulty secretly to inflate retention.

## Expansion decision rules
Add a second premium arena only if:
- core retention/rematch meets target
- first arena quality is stable
- content pipeline is repeatable

Add more teams only if existing four show differentiated play and users ask for variety.

Add public managed multiplayer hosting only if a compliant no-card/no-trial option exists or the project constraints change.

## Implementation Task Sequence

- [ ] **Task 1:** Create versioned alpha release checklist, known-issues file, privacy note, and self-hosting instructions.
- [ ] **Task 2:** Produce a clean public-safe build and verify provenance/private-content checks one final time.
- [ ] **Task 3:** Run internal/dev cohort and fix crash, save, performance, and onboarding blockers.
- [ ] **Task 4:** Run 5–10 trusted tester cohort and analyze completion/rematch/qualitative feedback.
- [ ] **Task 5:** Run 20–50 tester cohort only after prior blockers are resolved.
- [ ] **Task 6:** Analyze tutorial completion, match completion, rematch, progression continuation, quit points, technique usage, bot satisfaction, and performance.
- [ ] **Task 7:** Run only one growth experiment at a time, prioritizing rematch/highlight/challenge friction rather than dark patterns.
- [ ] **Task 8:** Expand content only if voluntary replay and core satisfaction metrics pass the final success gate.

## V2 alpha identity/persistence acceptance

The noncommercial alpha must support immediate guest play. If authenticated deployment is enabled, Google is the preferred sign-in and email is the fallback; users can link existing local progress. At least one verified challenge leaderboard must work end to end without exposing email or trusting client score values.

A hosted backend is optional. If no compliant no-card/account-compatible host is available, local/self-hosted auth and leaderboard remain the acceptance baseline rather than violating the project constraints.

## Exit gate — Final Success
A successful noncommercial alpha demonstrates:
- >=70% voluntary rematch after first completed match in target cohort
- movement and shooting satisfaction medians >=8/10
- bot teammate usefulness median >=7.5/10
- strong tutorial completion
- no critical network/physics exploit
- stable performance on declared reference hardware
- users can articulate why SoccerShooter feels different from generic football games
- multiple testers voluntarily share a replay/highlight/challenge without being forced

If these fail, improve the core loop before adding more content.
