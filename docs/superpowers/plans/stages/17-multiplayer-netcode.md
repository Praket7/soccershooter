# Stage 17 — Authoritative Multiplayer, Prediction, Reconciliation, and Bot Fill

## AI execution mode

**Primary AI role:** Multiplayer/Netcode Agent

This stage is executed by AI under `docs/ai/AI_EXECUTION_CONTRACT.md`. Before any change, the worker must read `/DESIGN.md`, the master plan, this stage, the previous gate, and every subsystem document linked below. The AI must produce the cheapest measurable proof first, write tests before implementation where applicable, capture evidence, and stop rather than beginning a future stage when this stage's gate fails.

**Required AI output for this stage:** implementation or artifact changes, automated tests/validators, evidence paths or reproducible seeds, a concise worker handoff, and the stage gate report. “Looks good” and “runs locally” are not acceptance evidence.


> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Use checkbox steps for progress.

**Tech Stack:** Colyseus 0.18, TypeScript, shared simulation, Vitest, network simulator

**Spec:** `docs/superpowers/specs/2026-10-17-soccershooter-design.md`  
**Master:** `docs/superpowers/plans/2026-10-17-soccershooter-master.md`

## Global Constraints

- No credit card, paid/timed trial, or adult-only account dependency.
- `FICTIONAL_PUBLIC` is the only deployable content mode.
- Simulation correctness outranks presentation shortcuts.
- Tests and measured gate evidence are required before the next stage.
- Do not implement later-stage scope unless a minimal interface is required to test this stage.

## Review Focus

- client-authoritative outcomes
- reconciliation snapping
- duplicate events under loss
- lag-compensation abuse
- bot/human ownership handoff bugs

## Planned File Map

- `packages/protocol/src/messages.ts`
- `packages/protocol/src/schema.ts`
- `apps/server/src/rooms/MatchRoom.ts`
- `apps/server/src/authority/validateInput.ts`
- `apps/web/src/network/PredictedClient.ts`
- `apps/web/src/network/Reconciler.ts`
- `apps/web/src/network/RemoteInterpolation.ts`
- `apps/server/src/bots/BotFill.ts`
- `tools/perf/network-simulator.ts`
- `apps/server/src/network.test.ts`

---

**Goal:** Make 3v3 online play preserve the responsive local feel under realistic latency while keeping authority on the server.

**Architecture:** Colyseus 0.18 rooms run shared simulation at 30 Hz authority. Clients send input intents, predict local movement, interpolate remote players, and reconcile authoritative corrections. Bots run on the server from the same shared state.

## Protocol
Messages include:
- input sequence/tick
- normalized intent
- join/leave
- ready/restart
- technique requests encoded as input, not outcome

Server snapshots/events include:
- authoritative tick
- player states
- ball state
- score/restart state
- acknowledged input sequence
- authoritative gameplay events

## Authority rules
Server validates:
- movement bounds
- cooldown/stamina
- legal technique eligibility
- kick/contact geometry
- tackle legality
- score/goal plane
- restart ownership

Client can never submit “goal,” “hit,” or final ball position as truth.

## Prediction
- local player prediction
- ball prediction only from deterministic known local interactions, with conservative reconciliation
- remote interpolation buffer
- deterministic bot future prediction where useful

## Reconciliation UX
Small errors:
- smooth correction

Large errors:
- fast but readable correction
- debug records cause

Never hide large recurring divergence; fix the cause.

## Lag compensation
Use rewind only for carefully defined contested checks where fairness improves. Do not let extreme latency create impossible retroactive outcomes.

## Bot fill
- match can start with bots immediately
- humans replace bots only at safe boundaries
- bot skill matches lobby target
- bot identity is transparent to users

## Network simulator
Profiles:
- 0 ms
- 50 ms
- 100 ms
- 150 ms
- jitter bursts
- 2%/5% loss
- reordering where practical

## Implementation Task Sequence

- [ ] **Task 1:** Write failing protocol tests for duplicate inputs, dropped packets, illegal movement/actions, reconnect, and goal authority.
- [ ] **Task 2:** Implement typed input and authoritative snapshot/event schemas.
- [ ] **Task 3:** Implement Colyseus match room running the shared 30 Hz simulation.
- [ ] **Task 4:** Implement server-side input/cooldown/contact/goal validation.
- [ ] **Task 5:** Implement local player prediction and authoritative reconciliation.
- [ ] **Task 6:** Implement remote interpolation and conservative deterministic ball prediction.
- [ ] **Task 7:** Implement server-side bot fill and safe bot-to-human replacement boundaries.
- [ ] **Task 8:** Implement network simulator profiles and run 0/50/100/150 ms plus loss/jitter suites.
- [ ] **Task 9:** Add reconciliation/debug metrics and fix recurring divergence before gate approval.

## Tests
- duplicate input packet is idempotent
- dropped packet does not duplicate technique event
- reconnect preserves correct authoritative score/state
- goal cannot occur from client-only ball state
- 150 ms trace remains deterministic server-side
- loss/jitter never duplicates score
- malicious impossible movement/action rejected
- bot/human replacement preserves entity ownership cleanly

## V2 account/session integration boundary

Stage 17 networking remains focused on authoritative gameplay. It consumes the authenticated/guest identity abstraction defined by Stage 17A but never trusts the client for result authority. Match completion emits a signed/trusted result payload for persistence; leaderboard writes happen outside client-controlled code.

Stage 17 and 17A may be developed on parallel worktrees only after identity/result protocol interfaces are frozen.

## Exit gate
- local/LAN 3v3 works
- 50/100/150 ms simulated RTT stays playable
- reconciliation error metrics are visible
- no duplicated authoritative events in stress suite
- bots fill empty slots reliably
- online feel remains close to offline feel
