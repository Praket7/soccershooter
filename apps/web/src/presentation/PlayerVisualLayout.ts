export const PLAYER_VISUAL_LAYOUT = Object.freeze({
  torsoHeight: 0.76,
  torsoCenterY: 1.03,
  torsoTopRadius: 0.32,
  torsoBottomRadius: 0.30,
  legHeight: 0.66,
  legCenterY: 0.33,
  legRadius: 0.105,
  legOffsetX: 0.15,
  headRadius: 0.24,
  headCenterY: 1.61,
  facingBarY: 1.06,
  facingBarForward: 0.38,
});

/** Bottom of the visible player marker in world/support-relative Y. */
export function playerVisualFootY(baseY = 0): number {
  return baseY + PLAYER_VISUAL_LAYOUT.legCenterY - PLAYER_VISUAL_LAYOUT.legHeight / 2;
}
