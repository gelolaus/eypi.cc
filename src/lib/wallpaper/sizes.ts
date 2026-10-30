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
  { id: 'pixel-8', label: 'Pixel 8 (1080 × 2400)', width: 1080, height: 2400 },
  { id: 'galaxy-s24', label: 'Galaxy S24 (1080 × 2340)', width: 1080, height: 2340 },
  { id: 'android-20-9', label: 'Android 20:9 (1080 × 2400)', width: 1080, height: 2400 },
  { id: 'android-16-9', label: 'Android 16:9 (1080 × 1920)', width: 1080, height: 1920 },
]

/** The phone's own pixel size in portrait, or null on a desktop where the student should pick one. */
export function detectSize(env: { screenWidth: number; screenHeight: number; pixelRatio: number; coarsePointer: boolean }): Size | null {
  if (!env.coarsePointer) return null
  const short = Math.min(env.screenWidth, env.screenHeight) * env.pixelRatio
  const long = Math.max(env.screenWidth, env.screenHeight) * env.pixelRatio
  return clampSize({ width: short, height: long })
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
