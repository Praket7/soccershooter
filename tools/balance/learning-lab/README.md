# Stage 07 Learning Lab

The Learning Lab is an **optional local research lane**. SoccerShooter's shipping bot path remains the deterministic Stage 06/07 hybrid runtime.

The production difficulty system changes cognition, not physics. Reaction delay, observation noise, tactical cadence, prediction horizon, aim/spin error, pass-risk tolerance, repertoire, coordinated-run frequency, and defensive anticipation are inspectable. Movement, acceleration, stamina, tackle geometry, goalkeeper reach, and ball physics remain identical across novice, standard, and elite.

## Research grounding

This architecture is intentionally conservative and modular.

- Souza et al., *Solutions for Dynamic Difficulty Adjustment in digital games: A Systematic Literature Review*, Entertainment Computing 55 (2025), 101041, DOI `10.1016/j.entcom.2025.101041`, found substantial use of both AI and heuristic/parameter techniques and highlighted a need for flexible, modular DDA systems.
- Guo, Thawonmas, and Ren, *Rethinking dynamic difficulty adjustment for video game design*, Entertainment Computing 50 (2024), 100663, DOI `10.1016/j.entcom.2024.100663`, argues that DDA should serve explicit game-design goals instead of blindly optimizing a generic flow signal.
- Kurach et al., *Google Research Football: A Novel Reinforcement Learning Environment*, AAAI 2020, DOI `10.1609/aaai.v34i04.5878`, demonstrates the value of reproducible football simulations, fixed baselines, multi-agent experiments, and isolated RL benchmarking.

For SoccerShooter the rule is simple: **a learned system may propose tactics, but it never owns physics.**

## Hard isolation boundary

A learned policy may propose only high-level football intent:

- role;
- action;
- optional target player.

`packages/bots/src/highLevelPolicy.ts` validates that boundary. A proposal cannot set or override:

- movement speed or acceleration;
- stamina capacity or drain;
- tackle radius/collider size;
- goalkeeper reach;
- player position or velocity;
- ball impulse, velocity, spin, drag, Magnus, bounce, friction, or other ball-physics values;
- low-level authoritative input traces;
- human input before it becomes simulation-visible.

Unexpected proposal fields are rejected. The default adapter is disabled and no learned policy is a production dependency.

The adapter may receive safe read-only scalar/categorical research features, but that does not expand its output authority.

## Executable Stage 07 smoke experiment

Stage 07 includes a real research-only benchmark in `harness.ts`.

It deliberately uses a lightweight seeded **tabular behavior-cloning** experiment rather than adding a production ML framework. The harness:

1. generates deterministic abstract football states;
2. labels them with a deterministic high-level expert;
3. trains a tabular high-level action policy from seeded examples;
4. evaluates on held-out seeded episodes;
5. validates every output through `validateHighLevelProposal`;
6. measures cooperation, safety, exploit rate, readability/expert agreement, inference latency, and a football-performance proxy;
7. keeps `humanPreference` null;
8. keeps `enabledInProduction` false;
9. refuses promotion until human preference evidence exists.

This is a **smoke benchmark**, not a claim that tabular cloning is the final learned football architecture. Its purpose is to prove the research adapter can actually be trained, executed, validated, timed, reproduced, and compared against a deterministic expert without contaminating the shipping bot.

A future experiment may replace the tabular learner with PPO, MAPPO, self-play, imitation learning, or another method as long as it obeys the same high-level adapter and promotion contract.

## Reward design and specification-gaming defenses

`evaluate.ts` keeps training reward separate from team-performance measurement. Goals and goal prevention dominate. Progressive passing and useful support receive bounded auxiliary reward. Repeated pair passing, non-progressive possession, turnovers, and obvious non-winning reward farming are penalized and flagged.

`evaluateLearningEpisode` explicitly detects:

- repeated pair-pass loops;
- excessive backward/non-progressive possession without threat;
- proxy-reward accumulation that does not produce winning football.

The adaptive tournament verifies that pass spam is flagged and that a genuinely winning episode earns a higher reward.

## Promotion benchmark

A candidate learned policy must be compared with the deterministic production bot/expert on the same seeded scenarios. Promotion evidence must cover:

1. **Cooperation** — support, passing, spacing, and team shape.
2. **Corner-case safety** — legal finite behavior around restarts, pressure, loose balls, near-goal states, and sparse-action states.
3. **Exploit rate** — no pass loops, non-progressive reward farms, or comparable proxy exploits.
4. **Inference time** — only the high-level learned layer is timed.
5. **Readability / predictability** — humans can coordinate with the behavior and understand its intent.
6. **Win rate / football performance** — it improves football outcomes rather than only proxy scores.
7. **Human preference** — testers actually prefer the candidate behavior.

`evaluatePromotion` currently requires:

- cooperation score `>= 0.75`;
- corner-case safety `>= 0.90`;
- exploit rate `<= 0.05`;
- high-level inference time `<= 1 ms`;
- readability score `>= 0.75`;
- win rate `>= 0.52`;
- human preference `>= 0.60`.

Human preference is intentionally required and cannot be fabricated by automation. Missing human evidence produces `human-preference-pending` and blocks promotion.

## Reproducible commands

From the repository root:

```bash
pnpm install --frozen-lockfile
pnpm typecheck
pnpm test -- packages/bots/src/highLevelPolicy.test.ts tools/balance/learning-lab/evaluate.test.ts tools/balance/learning-lab/harness.test.ts
pnpm bots:tournament
pnpm bots:adaptive-tournament
pnpm bots:learning-lab
```

Canonical adaptive cognition gate:

```bash
pnpm bots:adaptive-tournament
```

It runs 2,000 seeded scenarios per novice, standard, and elite tier and exits nonzero if the automated Stage 07 adaptive gate fails.

Canonical learned-policy smoke benchmark:

```bash
pnpm bots:learning-lab
```

It trains on 2,200 seeded examples, evaluates 600 held-out episodes, prints the machine metrics/checksum, and exits nonzero if any machine-side benchmark fails. A successful machine gate still reports promotion false until human preference exists.

## Verified Stage 07 smoke result

On full CI run `39162193996`:

- adapter: `tabular-behavior-clone-v1`
- training examples: `2200`
- held-out episodes: `600`
- expert agreement: `1.0`
- invalid proposals: `0`
- cooperation: `1.0`
- corner-case safety: `1.0`
- exploit rate: `0`
- readability: `1.0`
- benchmark win proxy: `1.0`
- average inference: `0.00154046 ms`
- max inference: `0.468235 ms`
- checksum: `c37c30c3`
- machine gate: PASS
- production enabled: false
- promotion: false, `human-preference-pending`

The perfect agreement is specific to the deliberately small abstract smoke environment. It proves the plumbing and benchmark discipline, not full-game learned superiority.

## Current Stage 07 state

Implemented now:

- isolated high-level policy adapter;
- strict proposal validation;
- safe research feature input;
- default-disabled learned lane;
- reward-hack detector;
- promotion-metric contract;
- deterministic Stage 06 baseline;
- Stage 07 adaptive cognition simulation gate;
- executable seeded learned-policy smoke experiment;
- named CI command and machine-side gate.

**No learned policy is promoted or enabled.** The research lane is ready for future experiments while the shipping bot remains deterministic, inspectable, fair, and fully disableable.

## Stage boundary

Do not add TensorFlow, PyTorch, PPO, MAPPO, or another training framework to the browser or production server dependency graph merely to make Stage 07 look more advanced. A future learned policy must obey the high-level adapter, beat the deterministic baseline on the full benchmark suite, and clear the human preference gate before later-stage production integration is considered.