# Stage 06 Handoff — Owner Test Before Merge

Stage 06 tactical-bot engineering is ready for owner playtest on:

- branch: `stage/06-tactical-bots`
- draft PR: `#15`
- verified implementation head before documentation: `4196abd546b538596230601d853abcc7fb5382e1`
- verified CI run: `39158217835`
- verified CI job: `117765780488`

**Do not merge yet.**

## Local test setup

```bash
git fetch origin
git switch stage/06-tactical-bots
pnpm install --frozen-lockfile
pnpm --filter @soccershooter/web dev
```

Open the Vite address printed by the dev server, normally `http://localhost:5173`.

Select **Tactical Bot Lab**.

## First pass — role labels OFF

Keep the role overlay off first. The Stage 06 exit gate is about whether the movement makes tactical sense without labels telling you what the bots are supposed to be doing.

Watch for:

- the ball carrier making a mix of pass/dribble/protect/shoot decisions instead of repeating one action;
- one teammate finding a useful diagonal support lane rather than standing directly behind or on top of the carrier;
- the other teammate preserving useful team shape when the scenario contains that role capacity;
- the two field players avoiding permanent clustering around the ball;
- a turnover causing an immediate defensive response;
- the closest defender pressing when appropriate while the other recovers or covers goal-side;
- defenders blocking a dangerous shooting/passing path rather than both diving at the ball;
- goalkeepers shifting with ball angle while remaining connected to their goal.

Use **Force Turnover** repeatedly from different moments.

## Second pass — role labels ON

After forming your own read, click **Show Roles**.

Compare what you inferred with the assigned roles. The labels should explain behavior rather than rescue behavior that was unreadable without them.

## Automated checks you can rerun

```bash
pnpm typecheck
pnpm test
pnpm bots:tournament
pnpm test:e2e
```

The verified implementation head produced:

- `178 / 178` unit/contract tests PASS across 35 files;
- `26 / 26` Chromium tests PASS;
- `5000 / 5000` tournament possessions completed;
- `0` simulation failures;
- `0` keeper abandonments;
- `0` permanent-swarm possessions;
- `68.4%` completed-pass rate;
- `91.46%` multi-pass possessions;
- `4.5287 m` average support distance;
- `0.00833 ms/team` average tactical decision time;
- `2.0720 ms/team` max measured tactical decision time;
- deterministic tournament checksum `f8ba9988`;
- role occupancy exported for goalkeeper, carrier, support, presser, and cover roles in the 3v3 benchmark.

The benchmark uses one goalkeeper plus two field players per side, so `width-support` and `recovery-runner` occupancy are zero there by construction. Dedicated larger-team unit scenarios exercise those roles separately.

## Feedback to send back

Useful feedback is concrete, for example:

- “support player is too wide / too close / too static”;
- “second defender joins the press too often”;
- “keeper is too deep / too aggressive”;
- “passes look safe but pointless”;
- “they recycle too much”;
- “turnover recovery is too slow”;
- “roles are obvious without labels”;
- or explicit acceptance if it feels correct.

Any defect should be reproduced as a RED regression before tuning the implementation.

## Stage boundary

Do not add Stage 07 adaptive difficulty or learned-policy work while evaluating this branch. The point of this playtest is to accept the deterministic/fair Stage 06 baseline first.