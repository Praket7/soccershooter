# Stage 04 Final Handoff — Calibrated Premium Football Physics

## Status

Stage 04 is feature-complete. This final handoff supersedes earlier Stage 04 verification numbers for the final-audit changes only; the original Stage 04 handoff remains the implementation history.

No Stage 05 mechanics were added.

## Final-audit changes

1. Owner custom-chip CSV was reproduced from its exact launch state and showed that export stopped at first grounding while the ball was still rolling at about `3.41 m/s`.
2. Complete CSV export now runs the authoritative 120 Hz `stepBall` loop through translational settlement with a deterministic 20 s safety cap.
3. Live Ball Lab now uses the same settlement/safety policy and no longer freezes a still-moving ball at 8 s.
4. Turf coefficients were calibrated from `groundRestitution 0.56 → 0.62` and `rollingResistance 0.34 → 0.80`.
5. The exact shared TypeScript model now produces about `0.699 m` rebound from a 2 m underside drop and `6.653 m` roll from the 1 m ramp-equivalent no-slip probe.
6. Flight drag, Magnus, spin-decay, knuckle, post/crossbar, radius, mass, and gravity were left unchanged because the evidence did not justify retuning them.

## Additional direct simulation evidence

The real Stage 04 TypeScript physics was compiled and executed in the chat runtime.

A deterministic 10,000-full-trajectory legal launch sweep produced:
- zero finite-state failures;
- zero turf penetration events;
- zero positive mechanical-energy events;
- zero trajectories still translating after 15 s;
- zero duplicate determinism mismatches across 100 duplicate cases.

A 120 Hz vs 240 Hz sensitivity audit over representative 1.25 s flights produced approximately 2–3.5 cm positional difference, supporting the existing 120 Hz runtime cadence.

Full details are in `docs/gates/STAGE-04-FINAL-AUDIT.md`.

## Verified implementation head before documentation

- implementation head: `2716874d5421da6799c3882f8767bdb6690bc071`
- CI run: `39137595123`
- job: `117705179893`
- unit / contract: `105 / 105 PASS`
- CI random launches: `1,000,000`
- CI states checked: `4,000,000`
- fuzz failures: `0`
- fuzz checksum: `e0afd3f7`
- canonical deterministic hash: `d55b2d0b968372a5`
- Chromium: `11 / 11 PASS`
- build / health / guards / strict typecheck: PASS

## Required integration sequence

1. verify the documentation-inclusive branch head is green;
2. inspect the final PR diff for accidental scope or content drift;
3. mark PR #11 ready;
4. merge PR #11 using its exact verified head SHA;
5. verify `main` points to the merge commit;
6. require the post-merge `main` CI to pass;
7. only then declare Stage 04 finally closed and allow Stage 05 to begin.
