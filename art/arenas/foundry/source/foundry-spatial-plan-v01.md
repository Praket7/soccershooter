# Foundry Arena Spatial Plan — v01

**State:** working blockout specification; do not treat as approved final architecture.

## Playable footprint

- Small-sided field: **24 m wide × 36 m long**. These dimensions match the current Stage 06 physical scrimmage field (`halfWidth: 12`, `halfLength: 18`).
- Center at world origin; world X is width, world Z is length.
- Goals sit on the short ends at Z = ±18 m; opening is 7.32 m wide, centered on X = 0.
- 3 m clear runoff between the touchline/endline and low safety boards.
- Board line at X = ±15 m and Z = ±21 m. Keep transparent/low-profile behind each goal so the ball silhouette remains legible.
- No gameplay collision uses the render mesh. Pitch, boards, posts, crossbar, and out-of-play planes receive separate simple collision geometry.

## Building footprint and landmarks

- Lower seating bowl begins outside the 3 m runoff; sideline seats stay below the camera sightline near the ball.
- Two compact end stands sit behind each goal, with service tunnels centered on both ends and accessible from the exterior concourse.
- Main player tunnel is on the west sideline near midfield; reserve/team entrances are at the east sideline corners.
- Main scoreboard is centered high on the north short-end stand; no advertising board is allowed to cover goals or camera-safe play space.
- Industrial roof trusses span the pitch but keep the central ball-flight envelope unobstructed.
- Perimeter service/concourse ring supports lights, entrances, and crowd circulation. All signs and brands are original fictional Foundry identity.

## Camera and readability envelopes

- Live third-person camera: preserve the design envelope of 5.0–6.2 m player distance, 2.7–3.5 m elevation, and 0.35–0.55 m shoulder offset.
- Keep a clear aim/camera corridor from playable positions to both goals. No posts, trusses, scoreboards, crowd cards, or roof supports may enter that corridor.
- Spectator fascia stays below the ball/goal silhouette at the far end wherever practical.
- Free-camera/replay envelope extends above the roof and behind each goal; live camera collision is constrained by the inner concourse/roof supports, not decorative mesh.

## First review questions

1. Can a player read the ball and the far goal from the live camera at the opposite end line?
2. Are keeper, goal mouth, and shot trajectory distinguishable under floodlights?
3. Does the 24 × 36 m layout create useful three-a-side spacing rather than a crowded tunnel?
4. Are entrances and supports outside the normal player and camera paths?

## Evidence and next step

The vector plan at `foundry-spatial-plan-v01.svg` is the geometry source for working arena mood references. Validate field dimensions against any future authoritative arena rules before building collision or final assets. Lock sightlines and massing before material detail, crowd simulation, or roof decoration.
