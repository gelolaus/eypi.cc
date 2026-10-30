/** The lock screen clock and widgets sit in the top 30% of a portrait screen, so nothing is drawn there. */
export const SAFE_ZONE_RATIO = 0.3

/** A landscape wallpaper has no lock screen clock, so content only keeps a small gap from the top edge. */
export const LANDSCAPE_TOP_RATIO = 0.08

/** The lowest 4% of a wallpaper stays empty so nothing sits against the screen edge. */
export const BOTTOM_MARGIN_RATIO = 0.04

/** Text on a landscape wallpaper is sized from this share of the height, so it matches the portrait proportions. */
const LANDSCAPE_UNIT_RATIO = 0.46

export function isLandscape(width: number, height: number): boolean {
  return width > height
}

export function contentBottom(height: number): number {
  return Math.floor(height * (1 - BOTTOM_MARGIN_RATIO))
}

/** Pass the width too on a wallpaper that may be landscape. */
export function contentTop(height: number, width = 0): number {
  return Math.round(height * (isLandscape(width, height) ? LANDSCAPE_TOP_RATIO : SAFE_ZONE_RATIO))
}

/** The length every font size and gap is a fraction of: the width in portrait, a share of the height in landscape. */
export function sizingUnit(width: number, height: number): number {
  return isLandscape(width, height) ? height * LANDSCAPE_UNIT_RATIO : width
}
