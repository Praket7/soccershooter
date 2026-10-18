# Balance Tournament Evidence Contract

`tools/balance` will later run headless tactical/balance tournaments and exploit agents. Stage 01 defines the evidence format before any bot or technique system exists.

## Tournament identity

Every tournament records:
- schema version
- commit/build version
- simulation version
- ruleset ID
- content mode
- deterministic tournament seed
- match count
- team/configuration IDs
- bot policy/configuration IDs
- difficulty/personality configuration
- map/arena simulation geometry ID when relevant
- start/end timestamps for the run

## Required aggregate outputs

### Outcome
- wins, losses, draws by side/configuration
- win rate with numerator/denominator
- goals for/against
- score differential distribution

### Possession
- possession percentage
- possession-duration distribution
- possession changes
- time spent in uncontested possession where available

### Passing
- passes attempted/completed
- completion rate
- pass-chain length distribution
- progressive/line-breaking pass count when that definition exists
- turnovers caused by pass decisions

### Attacking
- shots attempted
- shots on target
- goals
- shot locations/types where available
- technique usage count and success outcome

### Defense
- tackles/challenges attempted
- successful challenges
- interceptions
- blocks
- recoveries
- turnovers conceded/created

### Roles and spacing
- role assignment time distribution
- number of simultaneous ball pressers
- support/width/depth/cover/recovery role occupancy
- stuck/no-valid-action time
- permanent-ball-swarm flags

### Exploit flags
Every tournament output includes named exploit detectors. Initial detector namespace is reserved for:
- sprint-only dominance
- no-pass dribbler
- long-shot spam
- tackle spam
- wall/corner trapping
- possession stalling
- defensive turtle
- repeated invalid/illegal technique attempt
- any new exploit discovered in playtesting

An exploit detector reports count, affected seeds/matches, severity, and reproduction trace rather than only `true/false` when possible.

## Canonical summary shape

```json
{
  "schemaVersion": 1,
  "buildVersion": "<commit>",
  "simVersion": "foundation",
  "ruleset": "arena-3v3",
  "contentMode": "FICTIONAL_PUBLIC",
  "seed": 12345,
  "matches": 1000,
  "outcome": {},
  "possession": {},
  "passing": {},
  "attacking": {},
  "defense": {},
  "roles": {},
  "techniques": {},
  "exploitFlags": []
}
```

Empty objects above are shape examples, not acceptable completed tournament evidence.

## Reproducibility

For every flagged match retain enough information to reproduce it:
- seed
- ordered input/action trace or bot-decision trace
- participating configuration IDs
- simulation version
- final state/result hash

If a bot learns or exposes a new exploit, the lead agent converts the exploit into either:
- a deterministic regression scenario, or
- a named exploit detector with a fixed reproduction seed.

## Statistical posture

Do not declare balance from a handful of matches.

A gate report states:
- number of unique seeds
- total matches
- pairing/order methodology
- whether sides/spawn positions were mirrored
- uncertainty/confidence method if inferential statistics are used

Comparisons should use mirrored or otherwise controlled seeds when practical so environment randomness does not masquerade as policy strength.

## Fairness guard

Difficulty/personality comparisons must also record protected physical parameters. A lower/higher bot difficulty is invalid if the tournament configuration silently changes:
- top speed
- acceleration envelope reserved for player physics
- stamina capacity
- collider size
- ball mass/drag/contact coefficients
- authoritative cooldown rules

Difficulty should change cognition, observation/reaction, tactical horizon, precision/risk, repertoire, and coordination as allowed by the design.

## Gate integration

Balance evidence is never a substitute for human feel testing, and human opinion is never a substitute for exploit/tournament evidence when a stage explicitly requires automated balance checks. Both forms of evidence are recorded separately in the gate report.