// Photo booth filters: pure pixel functions over RGBA data, applied in place.
// Alpha is never touched. No Math.random, no CSS or ctx.filter.

// Tuning knobs (adjust on real selfies).
export const SOFT_LIFT = 12 // added to every channel
export const SOFT_CONTRAST = 0.88 // < 1 flattens contrast around mid grey
export const BRIGHT_GAIN = 1.12 // multiplies every channel
export const BRIGHT_LIFT = 8 // added to every channel
export const WARM_RED = 14
export const WARM_BLUE = -16
export const COOL_RED = -14
export const COOL_BLUE = 16
export const FILM_GRAIN = 14 // peak grain amplitude (+/-)
export const FILM_FADE = 0.92 // contrast multiplier around mid grey
export const FILM_TINT_RED = 6
export const FILM_TINT_BLUE = -6
export const MATTE_BLACK_LIFT = 28 // the darkest value after the filter
export const MATTE_WHITE_CAP = 245 // the brightest value after the filter
export const VIVID_SATURATION = 1.45
export const VIVID_CONTRAST = 1.06

export type BoothFilterId =
  | 'normal'
  | 'soft'
  | 'bright'
  | 'warm'
  | 'cool'
  | 'film'
  | 'matte'
  | 'bw'
  | 'vivid'

export const BOOTH_FILTERS: readonly { id: BoothFilterId; label: string }[] = [
  { id: 'normal', label: 'Normal' },
  { id: 'soft', label: 'Soft' },
  { id: 'bright', label: 'Bright' },
  { id: 'warm', label: 'Warm' },
  { id: 'cool', label: 'Cool' },
  { id: 'film', label: 'Film' },
  { id: 'matte', label: 'Matte' },
  { id: 'bw', label: 'B&W' },
  { id: 'vivid', label: 'Vivid' },
]

type PixelFn = (d: Uint8ClampedArray, p: number, index: number) => void

// Uint8ClampedArray assignment clamps to 0-255 and rounds, so no manual clamp is needed.
const contrast = (v: number, c: number) => (v - 128) * c + 128

// Integer hash of the pixel index to a value in [-1, 1].
function hashNoise(n: number): number {
  let h = Math.imul(n + 1, 0x9e3779b1)
  h ^= h >>> 15
  h = Math.imul(h, 0x85ebca6b)
  h ^= h >>> 13
  return ((h >>> 0) / 0xffffffff) * 2 - 1
}

const FILTERS: Record<BoothFilterId, PixelFn | null> = {
  normal: null,
  soft: (d, p) => {
    for (let c = 0; c < 3; c++) d[p + c] = contrast(d[p + c], SOFT_CONTRAST) + SOFT_LIFT
  },
  bright: (d, p) => {
    for (let c = 0; c < 3; c++) d[p + c] = d[p + c] * BRIGHT_GAIN + BRIGHT_LIFT
  },
  warm: (d, p) => {
    d[p] += WARM_RED
    d[p + 2] += WARM_BLUE
  },
  cool: (d, p) => {
    d[p] += COOL_RED
    d[p + 2] += COOL_BLUE
  },
  film: (d, p, i) => {
    const grain = hashNoise(i) * FILM_GRAIN
    d[p] = contrast(d[p], FILM_FADE) + FILM_TINT_RED + grain
    d[p + 1] = contrast(d[p + 1], FILM_FADE) + grain
    d[p + 2] = contrast(d[p + 2], FILM_FADE) + FILM_TINT_BLUE + grain
  },
  matte: (d, p) => {
    const range = MATTE_WHITE_CAP - MATTE_BLACK_LIFT
    for (let c = 0; c < 3; c++) d[p + c] = MATTE_BLACK_LIFT + (d[p + c] / 255) * range
  },
  bw: (d, p) => {
    const y = 0.299 * d[p] + 0.587 * d[p + 1] + 0.114 * d[p + 2]
    d[p] = y
    d[p + 1] = y
    d[p + 2] = y
  },
  vivid: (d, p) => {
    const y = 0.299 * d[p] + 0.587 * d[p + 1] + 0.114 * d[p + 2]
    for (let c = 0; c < 3; c++) d[p + c] = contrast(y + (d[p + c] - y) * VIVID_SATURATION, VIVID_CONTRAST)
  },
}

export function applyFilter(
  id: BoothFilterId,
  data: Uint8ClampedArray,
  width: number,
  height: number,
): void {
  const fn = FILTERS[id]
  if (!fn) return
  const count = width * height
  for (let i = 0; i < count; i++) fn(data, i * 4, i)
}
