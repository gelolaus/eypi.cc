/** The lock screen clock and widgets sit in the top 30% of the screen, so nothing is drawn there. */
export const SAFE_ZONE_RATIO = 0.3

export function contentTop(height: number): number {
  return Math.round(height * SAFE_ZONE_RATIO)
}
