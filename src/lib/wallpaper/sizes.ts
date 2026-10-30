export type Size = { width: number; height: number }
export type SizePreset = Size & { id: string; label: string }

export const DEFAULT_SIZE: Size = { width: 1170, height: 2532 }

const MIN_SIDE = 320
const MAX_SIDE = 4000
const MAX_AREA = 16_000_000

export const PRESETS: SizePreset[] = [
  { id: 'iphone-15', label: 'iPhone 15 and 16 (1179 × 2556)', width: 1179, height: 2556 },
  { id: 'iphone-13', label: 'iPhone 13 and 14 (1170 × 2532)', width: 1170, height: 2532 },
  { id: 'iphone-se', label: 'iPhone SE (750 × 1334)', width: 750, height: 1334 },
  { id: 'pixel-8', label: 'Pixel 8 and most Android 20:9 (1080 × 2400)', width: 1080, height: 2400 },
  { id: 'galaxy-s24', label: 'Galaxy S24 (1080 × 2340)', width: 1080, height: 2340 },
  { id: 'android-16-9', label: 'Android 16:9 (1080 × 1920)', width: 1080, height: 1920 },
  { id: 'laptop-1366', label: 'Laptop (1366 × 768)', width: 1366, height: 768 },
  { id: 'laptop-1440', label: 'Laptop (1440 × 900)', width: 1440, height: 900 },
  { id: 'desktop-fhd', label: 'Full HD desktop (1920 × 1080)', width: 1920, height: 1080 },
  { id: 'desktop-qhd', label: 'QHD desktop (2560 × 1440)', width: 2560, height: 1440 },
  { id: 'laptop-retina', label: 'Retina laptop (2880 × 1800)', width: 2880, height: 1800 },
  { id: 'desktop-4k', label: '4K desktop (3840 × 2160)', width: 3840, height: 2160 },
]

/**
 * The screen's own pixel size: portrait on a phone (a landscape reading is swapped back), and as the screen
 * reports it on a desktop or laptop. Null when the browser does not report a screen size.
 */
export function detectSize(env: { screenWidth: number; screenHeight: number; pixelRatio: number; coarsePointer: boolean }): Size | null {
  if (!(env.screenWidth > 0 && env.screenHeight > 0)) return null
  let width = env.screenWidth * env.pixelRatio
  let height = env.screenHeight * env.pixelRatio
  const longest = Math.max(width, height)
  if (longest > MAX_SIDE) {
    // A screen wider than the limit is scaled down as a whole so it keeps its shape.
    width = (width * MAX_SIDE) / longest
    height = (height * MAX_SIDE) / longest
  }
  if (!env.coarsePointer) return clampSize({ width, height })
  return clampSize({ width: Math.min(width, height), height: Math.max(width, height) })
}

function side(value: number, fallback: number): number {
  return Number.isFinite(value) ? Math.min(MAX_SIDE, Math.max(MIN_SIDE, Math.round(value))) : fallback
}

/** Each side 320 to 4000 pixels and at most 16,000,000 pixels in all (the canvas limit on some phones), keeping the ratio. */
export function clampSize(size: Size): Size {
  const width = side(size.width, DEFAULT_SIZE.width)
  const height = side(size.height, DEFAULT_SIZE.height)
  if (width * height <= MAX_AREA) return { width, height }
  const scale = Math.sqrt(MAX_AREA / (width * height))
  return { width: Math.floor(width * scale), height: Math.floor(height * scale) }
}
