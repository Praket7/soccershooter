export const PLAYER_VISUAL_LAYOUT = Object.freeze({
  torsoHeight: 1.14,
  torsoCenterY: 0.57,
  torsoTopRadius: 0.34,
  torsoBottomRadius: 0.38,
  headRadius: 0.24,
  headCenterY: 1.36,
  facingBarY: 0.9,
  facingBarForward: 0.42,
});

/** Bottom of the visible player marker in world/support-relative Y. */
export function playerVisualFootY(baseY = 0): number {
  return baseY + PLAYER_VISUAL_LAYOUT.torsoCenterY - PLAYER_VISUAL_LAYOUT.torsoHeight / 2;
}
