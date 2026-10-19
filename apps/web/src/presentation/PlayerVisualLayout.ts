export const PLAYER_VISUAL_LAYOUT = Object.freeze({
  torsoHeight: 0.76,
  torsoCenterY: 1.03,
  torsoTopRadius: 0.32,
  torsoBottomRadius: 0.30,
  legHeight: 0.58,
  legCenterY: 0.39,
  legRadius: 0.105,
  legOffsetX: 0.15,
  footWidth: 0.20,
  footHeight: 0.10,
  footLength: 0.34,
  footCenterY: 0.05,
  footForward: 0.08,
  headRadius: 0.24,
  headCenterY: 1.61,
  facingBarY: 1.06,
  facingBarForward: 0.38,
});

/** Bottom of the visible player marker in world/support-relative Y. */
export function playerVisualFootY(baseY = 0): number {
  return baseY + PLAYER_VISUAL_LAYOUT.footCenterY - PLAYER_VISUAL_LAYOUT.footHeight / 2;
}
