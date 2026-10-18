# Stage 07 Handoff — Adaptive Bots Ready for Owner Test

Stage 07 engineering is complete on the isolated branch and remains intentionally unmerged.

- branch: `stage/07-adaptive-bots`
- draft PR: `#17`
- base: `stage/06-tactical-bots`
- fully verified implementation head: `10f8c401364273afb05f5efad5f112b655d34c27`
- full CI run: `39162193996`
- full CI job: `117777643428`
- Stage 01 contract run: `39162194003`
- Stage 01 contract job: `117777643052`
- result: **SUCCESS**

**Do not merge yet.** The owner requested to test Stage 06 and Stage 07 locally before accepting either branch.

## What is finished

### Fair adaptive difficulty

Novice, standard, and elite use identical physical rules. Difficulty varies only cognition:

- reaction delay;
- observation noise;
- tactical cadence;
- prediction horizon;
- aim/spin error;
- pass-risk tolerance;
- repertoire;
- coordinated-run frequency;
- defensive anticipation.

Speed, acceleration, stamina, tackle geometry, goalkeeper reach, and ball physics stay identical.

### Rolling gameplay-only player model

The model tracks decayed gameplay estimates and confidence without identity-sensitive profiling.

### Legal PvE adaptation

Difficulty may change only at encounter/restart boundaries with enough confidence. Live-possession changes are rejected and PvP adaptation is locked off.

### Seven data-driven personalities

- balanced
- playmaker
- winger
- poacher
- anchor
- aggressive presser
- calm keeper

They bias the same deterministic tactical engine rather than receiving separate physics or special-case AI stacks.

### Real runtime integration

Stage 07 configuration changes actual Stage 06 tactical decisions. Seeded repeatability and authoritative-world immutability are tested.

### Adaptive Bot Lab

The browser now has a dedicated **Adaptive Bot Lab** alongside **Tactical Bot Lab**. It lets you inspect tier parameters, compare real runtime decisions, inject player-model evidence, test legal vs illegal adaptation boundaries, toggle PvE/PvP, and switch carrier personalities.

### Executable learning lane

The research lane is no longer interface-only. `pnpm bots:learning-lab` trains and evaluates a seeded local tabular behavior-cloning experiment through the same strict high-level proposal schema.

The machine benchmark passes, but the experiment is still:

- disabled in production;
- unable to alter physics;
- blocked from promotion because human preference is pending.

## Fresh automated evidence

Verified on CI run `39162193996`:

- TypeScript: PASS
- unit/contract suite: **214 / 214 PASS across 44 files**
- Stage 04 million-ball fuzz: **0 failures**, checksum `e0afd3f7`
- Stage 05 football fuzz: **0 failures**, checksum `fecee5e1`
- Stage 05 exploit-bot gate: PASS
- Stage 06 5,000-possession tournament: PASS, checksum `ab7ba617`
- Stage 07 6,000-scenario adaptive tournament: PASS, checksum `474b847d`
- Stage 07 executable learning-lab machine gate: PASS, checksum `c37c30c3`
- canonical deterministic trace: `d55b2d0b968372a5`
- FICTIONAL_PUBLIC web/server build: PASS
- health endpoint: PASS
- browser/Node parity + Stage 07 browser surface: **29 / 29 PASS**

### Stage 07 adaptive simulation

- 2,000 scenarios per tier
- 0 simulation failures
- physical invariant: true
- 0 illegal mid-possession changes
- 0 PvP adaptive changes
- learned default: false
- personality distinctness: 6
- pass-spam exploit flagged: true
- winning football reward > pass spam: true
- promotion blocked only on human preference

| Tier | Reference agreement | Reaction success | Mean aim error |
|---|---:|---:|---:|
| Novice | 0.64692 | 0.0930 | 0.57220 rad |
| Standard | 0.69192 | 0.6390 | 0.53240 rad |
| Elite | 0.71244 | 0.9435 | 0.51264 rad |

### Executable learning smoke benchmark

- 2,200 training examples
- 600 held-out episodes
- adapter: `tabular-behavior-clone-v1`
- expert agreement: 1.0
- cooperation: 1.0
- corner-case safety: 1.0
- exploit rate: 0
- readability: 1.0
- benchmark win proxy: 1.0
- average inference: `0.00154046 ms`
- max inference: `0.468235 ms`
- invalid proposals: 0
- production enabled: false
- promotion: false, `human-preference-pending`

This proves the learning interface can be trained and benchmarked. It does **not** promote that smoke policy to gameplay.

## How to test Stage 06

```bash
git fetch origin
git switch stage/06-tactical-bots
pnpm install --frozen-lockfile
pnpm --filter @soccershooter/web dev
```

Open the Vite URL, normally `http://localhost:5173`, and select **Tactical Bot Lab**.

Test roles OFF before roles ON. Use **Force Turnover** repeatedly. Check:

- useful pass chains;
- diagonal support instead of stacking on the carrier;
- team width;
- nearest defender presses while the other covers/recover goal-side;
- no permanent ball swarm;
- goalkeeper remains connected to goal;
- tactical intent is understandable even before role labels are shown.

Stage 06 automated commands:

```bash
pnpm typecheck
pnpm test
pnpm bots:tournament
pnpm test:e2e
```

## How to test Stage 07

```bash
git fetch origin
git switch stage/07-adaptive-bots
pnpm install --frozen-lockfile
pnpm --filter @soccershooter/web dev
```

Open the same Vite URL and select **Adaptive Bot Lab**.

Check the following in order:

1. Verify the UI says the authoritative physical snapshot is identical across tiers.
2. Compare novice, standard, and elite cognition cards/real runtime decisions.
3. Click **Add elite-like samples** until confidence is high.
4. Click **Try mid-possession change**. The tier must not change.
5. Click **Apply restart boundary**. PvE may adapt one tier.
6. Toggle to **PvP**. Further restart attempts must not adapt difficulty.
7. Switch carrier personality among balanced/playmaker/winger/poacher/anchor/aggressive-presser/calm-keeper and compare decision output.
8. Confirm the learned-policy display remains disabled.

Then play normal/tactical scenarios and judge the feel rather than only the diagnostics.

Stage 07 automated commands:

```bash
pnpm typecheck
pnpm test
pnpm bots:tournament
pnpm bots:adaptive-tournament
pnpm bots:learning-lab
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
  tools/balance/learning-lab/harness.test.ts \
  tools/balance/adaptiveTournament.test.ts \
  --reporter=verbose
```

## What feedback matters most

Automation cannot tell whether the AI **feels** good. The highest-value feedback is comparative and specific:

- Does novice look intentionally weaker or simply broken?
- Does standard feel like a teammate you trust?
- Does elite make you change tactics, or does it just feel unfair?
- Does any tier appear physically faster/stronger rather than cognitively better?
- Do difficulty changes ever feel like they happen mid-possession?
- Can you recognize support/press/cover intent without role labels?
- Are playmaker vs balanced, poacher vs playmaker, anchor vs presser meaningfully different?
- Is the calm keeper too passive/aggressive on claims?
- Does the aggressive presser destroy team shape?
- Does the elite press read your action fairly, or appear to react before it becomes visible in simulation?

Rate each relevant run:

- fairness: 1–10
- teammate usefulness: 1–10
- tactical readability without labels: 1–10

The Stage 07 human target is teammate usefulness median `>= 7.5/10`.

Use the full issue template in `docs/gates/STAGE-07-PLAYTEST.md` when possible.

## Owner feedback still required

The remaining gate is purely human:

- novice feels beatable but intentional;
- standard feels useful;
- elite forces adaptation without physical cheating;
- personalities feel distinct but believable;
- no rubber-banding is perceived;
- teammate usefulness meets the human score target.

Until that is accepted, the correct status is:

**ENGINEERING PASS — OWNER PLAYTEST PENDING — DO NOT MERGE.**

Do not start Stage 08 as if these human criteria had already passed.