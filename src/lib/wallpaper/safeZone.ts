/** The lock screen clock and widgets sit in the top 30% of the screen, so nothing is drawn there. */
export const SAFE_ZONE_RATIO = 0.3

/** The lowest 4% of a wallpaper stays empty so nothing sits against the screen edge. */
export const BOTTOM_MARGIN_RATIO = 0.04

export function contentBottom(height: number): number {
  return Math.floor(height * (1 - BOTTOM_MARGIN_RATIO))
}

export function contentTop(height: number): number {
  return Math.round(height * SAFE_ZONE_RATIO)
}
