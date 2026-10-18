# AGENTS.md — SoccerShooter Execution Contract

Any coding agent working in this repository must follow these rules.

## Required reading

Before modifying product code read, in order:

1. `/DESIGN.md`
2. `docs/ai/AI_EXECUTION_CONTRACT.md`
3. `docs/superpowers/specs/2026-10-17-soccershooter-design.md`
4. `docs/superpowers/plans/2026-10-17-soccershooter-master.md`
5. the current stage file in `docs/superpowers/plans/stages/`
6. the immediately previous stage gate report
7. any subsystem spec linked by the current stage
8. `docs/constraints/FREE_TOOL_MATRIX.md`
9. `docs/constraints/CONTENT_MODES.md`

## Stage discipline

- Work on exactly one numbered stage at a time.
- Do not implement future-stage features “while you are here.”
- A later stage cannot begin until the current stage's gate passes.
- Every stage must create `docs/gates/STAGE-XX-GATE.md` using the gate template.
- Measure what the plan says to measure; do not substitute visual inspection for instrumentation.
- If a dependency is missing, add only the smallest interface or test double needed for the current stage.

## Development method

For simulation, bots, networking, progression, replay, and utilities use TDD:

1. write the failing test
2. run it and confirm the expected failure
3. implement the smallest correct behavior
4. run focused tests
5. run stage regression tests
6. commit a coherent unit of work

## AI orchestration

- Every worker follows `docs/ai/AI_EXECUTION_CONTRACT.md`.
- The Lead Integrator owns acceptance and merges.
- Workers must receive explicit file ownership, tests, budgets, visual targets, and stop conditions.
- Parallel agents may not silently modify the same shared interface.
- Visual agents must provide renders/contact sheets plus measured validation; code agents provide tests/benchmarks.
- Discovered exploits and recurring feel complaints become regression tests or explicit review criteria.

## Blender AI

Blender work follows `docs/tools/BLENDER_AI_PIPELINE.md` and `docs/art/FULL_IMAGE_PLAN.md`. Use a local Blender MCP bridge and versioned checkpoints. `nicceasy/3d-product` is used for its research-first, measured-reference, greybox, contact-sheet, preview-ladder, and gated-review discipline, adapted to runtime game assets. Paid Octane/Resolve/AI-credit paths are not required.

## Accounts and leaderboards

Stage 17A follows `docs/backend/AUTH_LEADERBOARDS.md`. Guest mode is mandatory. Google is the preferred optional sign-in and email is the fallback. Never store plaintext passwords. Competitive leaderboard writes must originate from trusted authoritative result processing, never directly from the browser.

## Repository architecture contract

```text
apps/
  web/                  # renderer, UI, browser input/audio
  server/               # Colyseus authoritative rooms
packages/
  sim/                  # deterministic game rules/state
  physics/              # football-specific motion/contact
  bots/                 # role/utility AI and player model
  protocol/             # network messages and schemas
  content/              # deployable public content definitions
  progression/          # Road to Legend and mastery
  replay/               # deterministic replay/events
  telemetry/            # privacy-preserving event contracts
  ui-contracts/         # shared UI-facing data contracts
 tools/
  assets/               # GLB/texture validators and optimization
  blender/              # Blender automation scripts
  balance/              # headless bot tournaments/exploit agents
  replay/               # replay inspection and state-diff tools
  perf/                 # benchmark harnesses
private/
  reference-content/    # LOCAL ONLY; gitignored
```

## Dependency rules

- `packages/sim` may not import browser DOM or Node server APIs.
- `packages/physics` must run headlessly.
- `packages/bots` consumes public simulation state, never renderer internals.
- `apps/web` and `apps/server` may depend on shared packages, never the reverse.
- Presentation-only state can never determine authoritative outcomes.
- Audio, particles, camera effects, crowd animation, facial animation, and cloth do not alter simulation state.

## Content modes

### `FICTIONAL_PUBLIC`
Deployable. Uses original teams, badges, kits, sponsors, player identities, and arena branding.

### `REFERENCE_PRIVATE`
Local prototype only. May contain manually entered real player names/numbers and non-image metadata for comparison. Must remain under `private/reference-content/`, stay gitignored, display a visible private-build watermark, and be impossible to build in production CI.

Renaming a club alone does not make copied crests, exact kit trade dress, sponsor marks, or real-person likenesses automatically safe.

## Free-tool rule

Never add a critical-path dependency that requires:

- a credit card
- a paid trial
- a timed trial
- a mandatory adult-only account
- a paid tier to perform the planned workflow

When terms are uncertain, use a local/open alternative instead.

## Quality priorities

1. input latency and control
2. ball-contact feel
3. animation/contact synchronization
4. tactical readability
5. bot usefulness
6. network correctness
7. frame pacing
8. audio feedback
9. lighting/material quality
10. content quantity

Do not hide bad mechanics under effects.

## Baseline budgets

- target stable 60 FPS on ordinary modern desktop hardware
- render cadence never controls simulation results
- initial playable payload target under 20 MB
- first premium arena streamed payload target under 45 MB
- tactical bot decision cost under 1 ms average per team on reference desktop
- no authoritative action accepted outside legal input/cooldown bounds
- no silent reconciliation spikes or duplicated authoritative events

## Commit style

Examples:

- `feat(sim): add deterministic kick impulse`
- `test(physics): cover high-spin trajectory envelope`
- `feat(bots): add support-run utility`
- `perf(assets): compress arena textures to ktx2`
- `fix(netcode): reconcile predicted possession`
