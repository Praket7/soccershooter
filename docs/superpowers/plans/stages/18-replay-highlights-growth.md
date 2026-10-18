# Stage 18 — Replay, Highlights, Challenge Codes, and Growth Hooks

## AI execution mode

**Primary AI role:** Replay/Leaderboard/Growth Agent

This stage is executed by AI under `docs/ai/AI_EXECUTION_CONTRACT.md`. Before any change, the worker must read `/DESIGN.md`, the master plan, this stage, the previous gate, and every subsystem document linked below. The AI must produce the cheapest measurable proof first, write tests before implementation where applicable, capture evidence, and stop rather than beginning a future stage when this stage's gate fails.

**Required AI output for this stage:** implementation or artifact changes, automated tests/validators, evidence paths or reproducible seeds, a concise worker handoff, and the stage gate report. “Looks good” and “runs locally” are not acceptance evidence.


> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Use checkbox steps for progress.

**Tech Stack:** TypeScript deterministic replay, browser capture/media APIs, Vitest

**Spec:** `docs/superpowers/specs/2026-10-17-soccershooter-design.md`  
**Master:** `docs/superpowers/plans/2026-10-17-soccershooter-master.md`

## Global Constraints

- No credit card, paid/timed trial, or adult-only account dependency.
- `FICTIONAL_PUBLIC` is the only deployable content mode.
- Simulation correctness outranks presentation shortcuts.
- Tests and measured gate evidence are required before the next stage.
- Do not implement later-stage scope unless a minimal interface is required to test this stage.

## Review Focus

- replay desync
- version incompatibility
- clip missing buildup
- capture blocking gameplay
- challenge code non-determinism

## Planned File Map

- `packages/replay/src/format.ts`
- `packages/replay/src/Recorder.ts`
- `packages/replay/src/Player.ts`
- `packages/replay/src/highlights.ts`
- `packages/replay/src/challengeCode.ts`
- `apps/web/src/replay/ReplayViewer.ts`
- `apps/web/src/replay/ClipExporter.ts`
- `packages/replay/src/replay.test.ts`

---

**Goal:** Turn excellent plays into understandable replays and frictionless shareable moments without building dark-pattern growth systems.

**Architecture:** Replays store deterministic inputs/events plus periodic state checkpoints and a versioned simulation identifier. Highlights are selected from meaningful event windows and rendered locally.

## Replay data
Record:
- sim version
- content version
- seed
- inputs/events
- periodic state checkpoints
- camera metadata only if user saves it

Replay must survive small presentation changes. If simulation compatibility breaks, show explicit version incompatibility rather than silently corrupting playback.

## Replay views
- broadcast
- free camera
- player follow
- tactical overhead
- ball follow
- goal buildup

## Highlight detector
Score candidate moments from:
- goal
- shot difficulty
- distance
- curve/spin magnitude
- technique rarity
- pass-chain length
- tackle/interception leading to goal
- keeper save
- match importance

Never show only the final touch when buildup was the interesting part.

## Clip windows
- 8–15 second default
- longer buildup option
- 16:9
- 9:16 social crop with safe UI framing

Use local browser capture/export APIs where supported. Provide replay-code export even if encoded video export is unavailable.

## Challenge codes
Encode:
- seed
- arena
- team/opponent profile
- modifiers
- target condition

No account required.

## Growth hooks
- rematch
- copy challenge code
- save replay
- save clip
- personal best
- seeded daily/weekly challenge

No spam invitations or forced social posting.

## Implementation Task Sequence

- [ ] **Task 1:** Write replay determinism, checkpoint seek, version mismatch, and highlight-selection tests.
- [ ] **Task 2:** Implement versioned replay format with inputs/events and periodic state checkpoints.
- [ ] **Task 3:** Implement recorder/player and deterministic seek.
- [ ] **Task 4:** Implement broadcast, follow, free, tactical, ball, and goal-buildup camera modes.
- [ ] **Task 5:** Implement highlight scoring for goals, technique, distance, curve, pass chain, saves, and match context.
- [ ] **Task 6:** Implement 8–15 second default clip windows plus extended buildup option.
- [ ] **Task 7:** Implement 16:9 and 9:16 safe framing and local export/replay-code fallback.
- [ ] **Task 8:** Implement deterministic challenge-code encoding/decoding and seeded challenge launch.

## Tests
- same replay reproduces same authoritative event sequence
- checkpoint seek produces same final hash as full replay
- highlight detector selects buildup for multi-pass goal
- clip framing keeps ball/action inside safe region
- old incompatible simulation version fails gracefully

## V2 verified challenge and leaderboard hooks

Challenge codes remain usable without an account, but **verified global results** require Stage 17A identity and authoritative result validation. Every eligible leaderboard result stores build/sim version, challenge seed/ruleset, match/result ID, and replay hash/reference.

Add replay entry points from leaderboard rows where public replay data is available. Growth hooks must never rely on dark patterns or fake scarcity.

## Exit gate
- full-match replay works
- goal buildup replay is understandable
- user can save/share at least a replay/challenge artifact locally
- vertical framing works for representative goals
- replay system adds negligible gameplay-frame overhead
