# Stage 19 — QA, Balance, Security, Accessibility Regression, and Performance Optimization

## AI execution mode

**Primary AI role:** QA/Red-Team + Performance Agent

This stage is executed by AI under `docs/ai/AI_EXECUTION_CONTRACT.md`. Before any change, the worker must read `/DESIGN.md`, the master plan, this stage, the previous gate, and every subsystem document linked below. The AI must produce the cheapest measurable proof first, write tests before implementation where applicable, capture evidence, and stop rather than beginning a future stage when this stage's gate fails.

**Required AI output for this stage:** implementation or artifact changes, automated tests/validators, evidence paths or reproducible seeds, a concise worker handoff, and the stage gate report. “Looks good” and “runs locally” are not acceptance evidence.


> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Use checkbox steps for progress.

**Tech Stack:** Vitest, Playwright, fuzz/property tests, GitHub Actions, browser profilers

**Spec:** `docs/superpowers/specs/2026-10-17-soccershooter-design.md`  
**Master:** `docs/superpowers/plans/2026-10-17-soccershooter-master.md`

## Global Constraints

- No credit card, paid/timed trial, or adult-only account dependency.
- `FICTIONAL_PUBLIC` is the only deployable content mode.
- Simulation correctness outranks presentation shortcuts.
- Tests and measured gate evidence are required before the next stage.
- Do not implement later-stage scope unless a minimal interface is required to test this stage.

## Review Focus

- exploit regressions
- memory leaks
- browser-specific failures
- protocol abuse
- optimization that changes feel

## Planned File Map

- `tools/balance/exploit-suite.ts`
- `tools/perf/soak.ts`
- `tools/perf/browser-matrix.md`
- `apps/web/tests/regression.spec.ts`
- `apps/server/src/security/rateLimit.ts`
- `apps/server/src/security/validation.test.ts`
- `docs/SECURITY.md`
- `docs/KNOWN_ISSUES.md`
- `.github/workflows/regression.yml`

---

**Goal:** Prove the game survives abuse, latency, bad assets, exploit strategies, long sessions, and real browser conditions before public alpha.

**Architecture:** Automated regression layers plus structured human playtesting. Fix measured bottlenecks rather than performing fashionable rewrites.

## Test matrix

### Unit/determinism
- physics
- movement
- techniques
- progression
- bots
- replay
- content guards

### Property/fuzz
- random legal ball launches
- random input traces
- random technique eligibility states
- malformed protocol packets
- save migration fuzz

### Bot exploit suite
- sprint-forward bot
- no-pass dribbler
- long-shot spammer
- tackle spammer
- corner/wall trap
- possession staller
- optimal pass searcher
- defensive turtle

Every discovered exploit becomes a permanent regression test.

### Network
- RTT profiles
- loss
- jitter
- reconnect
- duplicate packets
- delayed inputs
- malicious impossible inputs

### Browser
- current Chrome/Edge/Firefox/Safari desktop where accessible
- WebGL capability fallback messaging
- gamepad variants
- resize/fullscreen
- background-tab pause/recovery

### Performance
Profile:
- JS CPU
- physics
- bots
- rendering
- shadows
- crowd
- particles
- GPU memory
- network serialization
- bundle/load

## Security posture
- server authoritative outcomes
- validate all input ranges
- rate-limit protocol messages
- sanitize user-entered local display names if/when introduced
- no secret keys in client
- no production reference-private content
- dependency audit

## Balance targets
Measure per technique/team/bot profile:
- win rate
- pick/usage rate
- scoring contribution
- possession impact
- turnover impact
- counter success

Balance toward multiple viable styles, not exact symmetric numbers.

## Long-run soak
- 60+ minute bot match simulation
- repeated arena load/unload
- repeated replay open/close
- repeated reconnect
- memory plateau verification

## Accessibility regression
- remaps
- controller
- shake/motion settings
- contrast
- UI scale
- tutorial completion

## Implementation Task Sequence

- [ ] **Task 1:** Expand unit/property/fuzz coverage across simulation, content, progression, replay, bots, and protocol.
- [ ] **Task 2:** Build the full exploit-bot suite and convert every discovered exploit into a regression test.
- [ ] **Task 3:** Run network loss/jitter/reconnect/malicious-input matrices and fix authoritative inconsistencies.
- [ ] **Task 4:** Run browser/gamepad/fullscreen/background-tab compatibility matrix on accessible target browsers.
- [ ] **Task 5:** Profile CPU, physics, bots, renderer, shadows, crowd, particles, GPU memory, serialization, and loading.
- [ ] **Task 6:** Run long-session and repeated load/unload/reconnect/replay soak tests for memory plateaus.
- [ ] **Task 7:** Run dependency/security checks and confirm no private content/secrets ship.
- [ ] **Task 8:** Balance technique/team/bot profiles from measured usage and counter success, then rerun all gates.

## V2 AI red-team scope

The QA/Red-Team Agent must attack auth and leaderboard boundaries in addition to gameplay: direct score writes, duplicate submissions, stale builds, replay-hash mismatch, invalid sessions, name abuse, and guest/account merge retries. Visual regression also compares golden reference frames for HUD, first athlete, ball, and Foundry arena.

## Exit gate
- all critical automated suites green
- no known severity-1/2 defect
- stable 60 FPS target on reference profile
- 1% low target met or explicitly justified with measured fallback preset
- no unbounded memory growth in soak
- no dominant exploit strategy
- no private reference leakage
