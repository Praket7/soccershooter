# SoccerShooter Playtest Scorecard

Use this scorecard for milestone human playtests. Record the build commit, scenario, input device, tester/session pseudonymous code, and whether the tester had prior SoccerShooter experience. Do not record name, email, IP address, school, location, or other identifying information.

## Session metadata

- build commit / version
- stage
- scenario ID
- deterministic seed if applicable
- input device
- graphics preset
- tester/session code generated only for this study/session
- prior-experience bucket: first session / returning
- session duration

## Rating scale

Every scored item uses 1–10.

- **1–2:** broken, obstructive, or immediately unpleasant
- **3–4:** clearly poor; frequent friction or confusion
- **5–6:** usable but ordinary/inconsistent
- **7:** good; minor issues remain
- **8:** strong/premium-feeling for the current milestone
- **9:** exceptional with only tiny issues
- **10:** reference-quality for the tested scope

Do not coach a tester toward a score. Record the first score, then collect explanation.

## Core feel scores

| Dimension | 1–10 | What the tester is judging |
|---|---:|---|
| Movement responsiveness |  | How immediately and predictably the athlete responds to direction/speed intent |
| Camera comfort |  | Control, framing, motion comfort, obstruction recovery, and absence of fighting the camera |
| Ball control |  | Whether the ball feels separate, controllable, and physically understandable |
| First-touch predictability |  | Whether receiving outcomes make sense from speed, angle, body orientation, and input |
| Passing satisfaction |  | Aim, power, contact, readability, and sense of control |
| Shooting satisfaction |  | Preparation, contact, power/curve readability, and outcome credibility |
| Defensive fairness |  | Whether challenges, recovery, and opponent wins/losses feel earned |
| Teammate usefulness |  | Support runs, spacing, passing options, recovery, and cooperation |
| Opponent fairness |  | Whether opponent success comes from readable decisions rather than hidden advantages |
| HUD clarity / readability |  | Whether important live-play information can be found without distracting from the ball |
| Ball readability |  | Whether ball position, height, spin/trajectory, and ownership pressure stay understandable |
| Visual quality |  | Coherence, authored feel, materials/lighting/animation for the milestone |
| Audio impact |  | Whether actions sound distinct, useful, and satisfying without becoming noisy |
| Desire to rematch |  | How strongly the tester wants another match immediately |

## Behavioral signals

These are separate from ratings.

- **Voluntary rematch started:** yes / no
- **Tutorial completed without external help:** yes / no / not tested
- **Replay/highlight voluntarily opened or saved:** yes / no / not available
- **Advanced technique intentionally attempted:** yes / no / not available
- **Exploit intentionally attempted:** yes / no

A voluntary rematch counts only when the tester chooses another match without being instructed, automatically queued, or blocked from another action.

## Open-response prompts

Record concise verbatim/paraphrased notes without personal information.

1. One thing that felt **cheap**.
2. One thing that felt **premium**.
3. One **confusing moment**.
4. One **exploit attempted** or strategy that seemed abnormally strong.
5. One moment **worth clipping**.
6. What single change would most improve another match?

## Milestone aggregation

For every declared cohort report:
- valid session count
- median per rating dimension
- interquartile range where sample size permits
- voluntary-rematch numerator/denominator/percentage
- onboarding-without-help numerator/denominator/percentage when applicable
- recurring comments grouped by concrete symptom, never erased because they are subjective

Repeated complaints become a tracked hypothesis, regression test, instrumentation task, or explicit review criterion.

## Current north-star thresholds

Before noncommercial alpha:
- movement responsiveness median >= 8.0/10
- shooting/contact satisfaction median >= 8.0/10
- teammate usefulness median >= 7.5/10
- >= 70% voluntary rematch after first completed match
- >= 80% blind onboarding completion without external help

Earlier stage gates may test a subset, but they may not silently lower these final targets.

## Privacy rule

This scorecard is intentionally pseudonymous. Never add fields for raw names, email, phone, IP address, precise location, account ID, OAuth ID, device advertising ID, or other direct identifiers.