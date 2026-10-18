# Stage 07 Learning Lab

The Learning Lab is an **optional local research lane**. SoccerShooter's shipping bot path remains the deterministic Stage 06/07 hybrid runtime.

## Boundary

A learned policy may propose only high-level football intent:

- role;
- action;
- optional target player.

`packages/bots/src/highLevelPolicy.ts` validates that boundary. Physical control is forbidden. A proposal cannot set movement speed, acceleration, stamina, tackle radius/collider, goalkeeper reach, ball impulse, ball velocity, spin, or any other authoritative physics value.

The default adapter is disabled. No learned policy is a production dependency.

## Suggested local experiments

A future experiment may use a free local Python stack such as PyTorch plus PPO/MAPPO/self-play in a simplified headless environment. Google Research Football and multi-agent football literature show that football is useful as a reproducible coordination benchmark, but Stage 07 does not require a neural policy to ship.

The deterministic production bot should always remain the baseline and fallback.

## Reward design

`evaluate.ts` keeps training reward separate from team-performance measurement. Goals and goal prevention dominate. Progressive passing and support receive bounded auxiliary reward. Repeated pair passing, non-progressive possession, turnovers, and obvious non-winning reward farming are penalized/flagged.

This is deliberate protection against specification gaming: a policy should not be promoted because it discovered an easy proxy objective that looks numerically good but produces bad football.

## Promotion gate

A candidate is not eligible for promotion unless all of these pass:

- cooperation score >= 0.75;
- corner-case safety >= 0.90;
- exploit rate <= 0.05;
- inference time <= 1 ms for the high-level decision layer;
- readability score >= 0.75;
- win rate >= 0.52 against the defined baseline population;
- human preference >= 0.60.

Human preference is intentionally required and cannot be fabricated by automation. Therefore the Stage 07 repository keeps learned policy promotion **pending** and the production adapter **disabled** until a future experiment and human playtest earn promotion.

## Research grounding

The design is consistent with:

- Dynamic Difficulty Adjustment reviews that favor transparent parameter/heuristic adaptation when a system must remain controllable and inspectable.
- Google Research Football as a reproducible football reinforcement-learning environment (`10.1609/aaai.v34i04.5878`).
- Multi-agent football research using centralized-training/decentralized-execution and self-play as research tools rather than reasons to surrender production control.
- Reward-hacking/specification-gaming safety work, including *Concrete Problems in AI Safety* (`arXiv:1606.06565`) and *AI Safety Gridworlds* (`arXiv:1711.09883`).

## Stage boundary

Do not add TensorFlow/PyTorch/PPO/MAPPO to the browser or production server dependency graph merely to satisfy Stage 07. The learning lane is local, optional, replaceable, and disabled by default. A learned policy must outperform the deterministic baseline on the full promotion suite before integration is even considered.
