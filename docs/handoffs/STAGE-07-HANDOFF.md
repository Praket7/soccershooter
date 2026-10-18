# Stage 07 Handoff — Adaptive Bots Ready for Owner Test

Stage 07 adaptive-bot engineering is complete on the isolated branch and remains intentionally unmerged.

- branch: `stage/07-adaptive-bots`
- draft PR: `#17`
- base: `stage/06-tactical-bots`
- verified implementation head before documentation: `f47e37722c8a5f911c4fe87dbdbccd33e3973caa`
- verified full CI run: `39160734855`
- verified full CI job: `117773298690`
- result: **SUCCESS**

**Do not merge yet.** The owner requested a local feel/playtest pass before accepting Stage 06 or Stage 07.

## What Stage 07 adds

### Fair difficulty profiles

Novice, standard, and elite use identical physical parameters. Difficulty changes only inspectable cognition controls:

- reaction delay;
- observation noise;
- tactical evaluation interval;
- prediction horizon;
- aim/spin error;
- pass-risk tolerance;
- skill repertoire;
- coordinated-run frequency;
- defensive anticipation.

No tier receives speed, acceleration, stamina, tackle-collider, goalkeeper-reach, or ball-physics advantages.

### Rolling player model

The player model tracks decayed gameplay-only estimates:

- pass accuracy;
- shot conversion;
- pressured turnovers;
- dribble success;
- defensive timing;
- reaction proxy;
- favored zones;
- technique diversity;
- confidence.

It stores no biometric or identity-sensitive profile fields.

### Legal-boundary PvE adaptation

The adaptive director may adjust PvE difficulty only at encounter-start/restart boundaries and only when player-model confidence is sufficient. It cannot change difficulty during live possession and it is disabled for PvP.

### Data-driven personalities

Seven profiles bias the shared deterministic utility system rather than creating separate bot implementations:

- balanced;
- playmaker;
- winger;
- poacher;
- anchor;
- aggressive presser;
- calm keeper.

### Isolated learning lane

The optional high-level policy interface accepts only role/action/target proposals. Physical-control fields are rejected. The learned-policy path is disabled by default.

The Learning Lab includes reward-hacking checks and a promotion contract covering cooperation, safety, exploits, latency, readability, win rate, and required human preference.

No learned policy is promoted in Stage 07.

## Exact automated evidence

Full current implementation verification on run `39160734855`:

- strict TypeScript: PASS;
- unit/contract suite: **211 / 211 PASS across 43 files**;
- Stage 04 ball fuzz: **1,000,000 launches / 4,000,000 states / 0 failures**, checksum `e0afd3f7`;
- Stage 05 football fuzz: **250,000 cases / 1,000,000 actions / 0 failures**, checksum `fecee5e1`;
- Stage 05 exploit-bot gate: PASS;
- Stage 06 tactical tournament: **5,000 / 5,000 possessions, 0 simulation failures, 0 keeper abandonments, 0 permanent swarms**, gate PASS;
- Stage 07 adaptive tournament: **2,000 scenarios per tier**, gate PASS;
- canonical deterministic trace: `d55b2d0b968372a5` unchanged;
- FICTIONAL_PUBLIC web/server build: PASS;
- health endpoint: PASS;
- Chromium/browser parity: **26 / 26 PASS**.

## Stage 07 adaptive-tournament evidence

Seed: `117471761`

Global safety:

- physical invariant: `true`;
- simulation failures: `0`;
- illegal mid-possession adaptive changes: `0`;
- PvP adaptive changes: `0`;
- learned policy enabled by default: `false`;
- personality distinctness fingerprints: `6`;
- pass-spam reward exploit flagged: `true`;
- winning episode reward higher than pass spam: `true`;
- learned-policy promotion: `false`, reason `human-preference-pending`;
- average Stage 07 decision time: `0.015726 ms`;
- max measured Stage 07 decision time: `0.741794 ms`;
- deterministic checksum: `474b847d`.

Cognition scaling:

| Tier | Reference agreement | Turnover reaction success | Mean aim error (rad) |
|---|---:|---:|---:|
| Novice | 0.64692 | 0.0930 | 0.57220 |
| Standard | 0.69192 | 0.6390 | 0.53240 |
| Elite | 0.71244 | 0.9435 | 0.51264 |

The trend is deliberate: stronger tiers react more reliably and make more reference-aligned decisions while authoritative physical parameters stay unchanged.

## Local test setup

### Stage 06 baseline

```bash
git fetch origin
git switch stage/06-tactical-bots
pnpm install --frozen-lockfile
pnpm --filter @soccershooter/web dev
```

Open the Vite URL and select **Tactical Bot Lab**.

### Stage 07

```bash
git fetch origin
git switch stage/07-adaptive-bots
pnpm install --frozen-lockfile
pnpm --filter @soccershooter/web dev
```

Use `docs/gates/STAGE-07-PLAYTEST.md` for the exact comparison sequence.

## Automated commands

```bash
pnpm typecheck
pnpm test
pnpm bots:tournament
pnpm bots:adaptive-tournament
pnpm test:e2e
```

Focused Stage 07 verification:

```bash
pnpm exec vitest run \
  packages/bots/src/difficulty.test.ts \
  packages/bots/src/playerModel.test.ts \
  packages/bots/src/personalities.test.ts \
  packages/bots/src/adaptiveDirector.test.ts \
  packages/bots/src/adaptiveRuntime.test.ts \
  packages/bots/src/highLevelPolicy.test.ts \
  tools/balance/learning-lab/evaluate.test.ts \
  tools/balance/adaptiveTournament.test.ts \
  --reporter=verbose
```

## Owner feedback still required

Automation cannot determine whether:

- novice feels beatable without looking broken;
- standard feels like a teammate worth relying on;
- elite genuinely forces tactical adaptation without feeling unfair;
- personality differences are perceptible and useful;
- teammate usefulness reaches the Stage 07 human target of median `>= 7.5/10`.

Those are the only reasons the branch is not a final owner PASS.

## Stage boundary

Do not start Stage 08 from this branch until Stage 06 and Stage 07 owner playtests are accepted or their remaining findings are converted into RED regressions and repaired.

Do not promote a learned policy merely to make Stage 07 appear more advanced. The deterministic production path is the accepted baseline, and the learning lane remains optional and disabled until it earns promotion.