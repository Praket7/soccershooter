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

## Suggested local experiments

A future experiment may use a free local Python stack such as PyTorch plus PPO, MAPPO, self-play, imitation learning, or a small high-level classifier in a simplified headless environment. The experiment may be trained outside the production dependency graph as long as its runtime output is converted into the validated high-level proposal schema.

Training hardware availability is not a Stage 07 shipping requirement. Stage 07 creates the safe interface and benchmark contract so later research cannot contaminate the deterministic production baseline.

## Reward design and specification-gaming defenses

`evaluate.ts` keeps training reward separate from team-performance measurement. Goals and goal prevention dominate. Progressive passing and useful support receive bounded auxiliary reward. Repeated pair passing, non-progressive possession, turnovers, and obvious non-winning reward farming are penalized and flagged.

`evaluateLearningEpisode` explicitly detects:

- repeated pair-pass loops;
- excessive backward/non-progressive possession without threat;
- proxy-reward accumulation that does not produce winning football.

The adaptive tournament verifies that pass spam is flagged and that a genuinely winning episode earns a higher reward.

## Promotion benchmark

A candidate learned policy must be compared with the deterministic production bot on the same seeded scenarios. Promotion evidence must cover all of these dimensions:

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

Human preference is intentionally required and cannot be fabricated by automation. A missing human result produces `human-preference-pending` and blocks promotion.

## Reproducible commands

From the repository root:

```bash
pnpm install --frozen-lockfile
pnpm typecheck
pnpm test -- packages/bots/src/highLevelPolicy.test.ts tools/balance/learning-lab/evaluate.test.ts
pnpm bots:tournament
pnpm bots:adaptive-tournament
```

The canonical adaptive command is:

```bash
pnpm bots:adaptive-tournament
```

It runs 2,000 seeded scenarios per novice, standard, and elite tier and exits nonzero if the automated Stage 07 gate fails.

When comparing a future learned experiment, keep the deterministic seed and scenario set fixed so differences are attributable to the policy rather than scenario drift.

## Current Stage 07 state

Implemented now:

- isolated high-level policy adapter;
- strict proposal validation;
- default-disabled learned lane;
- reward-hack detector;
- promotion-metric contract;
- deterministic Stage 06 baseline;
- Stage 07 adaptive cognition simulation gate.

**No learned policy is promoted or enabled.** This is intentional. The research lane is ready for optional future experiments while the shipping bot remains deterministic, inspectable, fair, and fully disableable.

## Stage boundary

Do not add TensorFlow, PyTorch, PPO, MAPPO, or other training frameworks to the browser or production server dependency graph merely to satisfy Stage 07. The learning lane is local, optional, replaceable, and disabled by default. A learned policy must outperform the deterministic baseline on the full promotion suite and clear the human preference gate before later-stage integration is considered.