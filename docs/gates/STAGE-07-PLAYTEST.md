# Stage 07 Owner Playtest — Adaptive Bots and Personalities

Stage 07 engineering is automated-test green, but the human exit gate is intentionally still open. This playtest exists to answer the parts simulation cannot answer truthfully: whether the bots **feel** fair, useful, readable, and meaningfully different across difficulty tiers.

**Do not merge Stage 06 or Stage 07 before this playtest is accepted.**

## Branches to compare

Baseline tactical AI:

- `stage/06-tactical-bots`

Adaptive/personality AI:

- `stage/07-adaptive-bots`

Stage 07 is built directly on Stage 06, so comparing the two branches isolates the adaptive/personality layer from the deterministic tactical baseline.

## Local setup

Use Node 24 and pnpm 12.9.1.

### Stage 06 baseline

```bash
git fetch origin
git switch stage/06-tactical-bots
pnpm install --frozen-lockfile
pnpm --filter @soccershooter/web dev
```

Open the Vite URL, normally `http://localhost:5173`, and select **Tactical Bot Lab**.

### Stage 07

```bash
git fetch origin
git switch stage/07-adaptive-bots
pnpm install --frozen-lockfile
pnpm --filter @soccershooter/web dev
```

Use the same Tactical Bot Lab/scenarios so differences are attributable to Stage 07 rather than a different test environment.

## Pass A — Stage 06 baseline, roles OFF

Keep role labels off first.

Check whether you can infer tactical intent without the overlay:

- carrier mixes pass, dribble, protect, and shoot decisions;
- support player finds a useful diagonal lane rather than stacking on the carrier;
- team avoids permanent ball swarming;
- turnover causes a sensible defensive transition;
- nearest defender presses while the other covers/recover goal-side;
- defenders sometimes block dangerous paths instead of both chasing the ball;
- keeper shifts with the ball while staying connected to goal.

Use **Force Turnover** repeatedly from different moments.

Then turn **Show Roles** on. The labels should confirm what you already saw, not make unreadable behavior seem sensible after the fact.

## Pass B — Stage 07 difficulty ladder

Test novice, standard, and elite with the same starting scenarios whenever possible.

### Novice

Target feel: **beatable but intentional**.

Look for:

- visible reaction delay without bots looking frozen;
- occasional imperfect perception/aim that still looks like a believable football mistake;
- no reduced movement speed, fake stamina loss, shrunken tackle reach, or other physical handicap;
- enough tactical structure that winning feels earned rather than handed to you.

Red flags:

- bots simply stand still;
- deliberate-looking own-goal behavior;
- aim error so large it looks broken;
- difficulty is obvious only because bots violate basic football logic.

### Standard

Target feel: **useful teammate and credible opponent**.

Look for:

- good support timing;
- passing choices that advance or stabilize possession;
- sensible defensive cover;
- reactions that feel responsive without reading your input unfairly;
- teammate behavior you would willingly rely on during a real match.

Give **teammate usefulness a 1–10 score**. The Stage 07 target is a median of at least **7.5/10** across accepted playtest runs.

### Elite

Target feel: **forces tactical adaptation without physical cheating**.

Look for:

- earlier reaction to turnovers and developing lanes;
- cleaner positioning/aim rather than supernatural movement;
- better risk selection and coordinated choices;
- pressure that makes you change how you attack or defend;
- mistakes still possible when the game state is genuinely difficult.

Red flags:

- instant response before your action is simulation-visible;
- impossible recovery speed;
- stamina that never depletes when equivalent players would tire;
- enlarged tackle/save reach;
- altered ball flight;
- mid-possession difficulty spikes that feel like the game decided you should lose.

## Pass C — Rubber-band / legal-boundary test

Play through several full possessions on Stage 07.

During one continuous possession, deliberately:

1. play badly for a while;
2. then suddenly play well;
3. create a dangerous attack;
4. force a turnover;
5. continue until a legitimate restart/encounter boundary.

The difficulty should **not visibly flip mid-possession** to force an outcome. Any adaptation should become apparent only at a legal boundary such as an encounter start or restart.

If you notice a sudden behavior shift, report the exact moment and whether a restart occurred.

## Pass D — Personality legibility

Where the lab exposes/configures personality assignments, compare repeated scenarios with different profiles.

Expected tendencies:

- **playmaker** — looks for useful passes and connective positions more often;
- **winger** — preserves width, overlaps, and attacks wide/far-side space more often;
- **poacher** — attacks finishing space and favors shots/runs more often;
- **anchor** — protects structure, recycles, covers, and blocks lanes more often;
- **aggressive presser** — closes/intercepts more aggressively but should not gain physical speed;
- **calm keeper** — favors positioning/claim/distribution discipline rather than reckless dives;
- **balanced** — neutral reference behavior.

A personality should change **preference**, not rules. If an archetype only feels different because it seems faster, stronger, or has extra reach, that is a Stage 07 defect.

## Pass E — Blind comparison if practical

If someone else is available, have them choose novice/standard/elite without telling you which one is active for a few short runs.

Ask yourself after each run:

- Did the opponent seem smarter or merely physically stronger?
- Did teammate usefulness change in a believable way?
- Could you tell which run forced more tactical adaptation?
- Did any run feel scripted or rubber-banded?

Blind testing is useful but not required for your first owner pass.

## Automated commands

Stage 06 baseline:

```bash
pnpm typecheck
pnpm test
pnpm bots:tournament
pnpm test:e2e
```

Stage 07:

```bash
pnpm typecheck
pnpm test
pnpm bots:tournament
pnpm bots:adaptive-tournament
pnpm test:e2e
```

Focused Stage 07 tests:

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

## Feedback format

Send one block per issue or strong positive finding:

```text
Branch: stage/06-tactical-bots or stage/07-adaptive-bots
Difficulty: novice / standard / elite / n/a
Personality: name or n/a
Input: keyboard+mouse / controller
Scenario: what was happening
Observed: exactly what the bot did
Expected: what would have felt better or fairer
Frequency: once / sometimes / often / every time
Severity: cosmetic / minor / major / blocker
Fairness (1-10):
Teammate usefulness (1-10):
Tactical readability without role labels (1-10):
Did it feel physically stronger rather than smarter?: yes/no + why
Did behavior change mid-possession?: yes/no + exact moment
Video/timestamp: optional
```

The most useful tuning feedback is comparative, for example:

- “novice reaction delay is believable, but aim error looks random rather than human”;
- “standard support is useful but recycles one pass too often”;
- “elite reads the turnover well but the press arrives so fast it feels like speed cheating”;
- “playmaker and balanced feel almost identical”;
- “aggressive presser pulls shape apart too often”;
- “calm keeper is too passive on reachable claims”;
- “I could identify support/cover roles without labels”;
- “standard teammate usefulness 8/10, elite 8.5/10, novice 6.5/10.”

## Acceptance rule

Stage 07 can move from engineering PASS to final owner PASS only when:

- novice feels beatable without appearing broken;
- standard feels like a useful teammate;
- elite forces tactical adaptation;
- no tier appears to cheat physical laws;
- no live-possession rubber-banding is observed;
- personalities are meaningfully legible as preferences;
- teammate usefulness reaches the required human threshold.

Until then, the correct status is **ENGINEERING PASS — OWNER PLAYTEST PENDING — DO NOT MERGE**.