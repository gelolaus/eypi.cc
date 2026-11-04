export type BoothWindow = { x: number; y: number; w: number; h: number }

export const BOOTH_WIDTH = 1080
export const BOOTH_HEIGHT = 1920
export const BOOTH_WINDOW_COUNT = 3
/** A window must be at least this fraction of the image width and of its height. */
export const BOOTH_MIN_WINDOW_FRACTION = 0.05

const isWindow = (value: unknown): value is BoothWindow => {
  if (typeof value !== 'object' || value === null) return false
  const v = value as Record<string, unknown>
  return ['x', 'y', 'w', 'h'].every((key) => typeof v[key] === 'number' && Number.isInteger(v[key]))
}

/** A plain-language problem with the windows, or `null` when they suit a booth frame of this size. */
export function validateBoothWindows(windows: unknown, width: number, height: number): string | null {
  const count = Array.isArray(windows) ? windows.length : 0
  if (!Array.isArray(windows) || count !== BOOTH_WINDOW_COUNT) {
    return `We found ${count} photo windows. A booth frame needs exactly ${BOOTH_WINDOW_COUNT} separate transparent areas.`
  }
  if (!windows.every(isWindow)) return 'The photo windows are not valid. Upload the frame again.'
  const list = windows as BoothWindow[]
  for (const win of list) {
    if (win.x < 0 || win.y < 0 || win.w <= 0 || win.h <= 0) return 'The photo windows are not valid. Upload the frame again.'
    if (win.x + win.w > width || win.y + win.h > height) return 'A photo window reaches outside the frame.'
    if (win.w < width * BOOTH_MIN_WINDOW_FRACTION || win.h < height * BOOTH_MIN_WINDOW_FRACTION) {
      return 'A photo window is too small. Each one must be at least 5% of the frame width and height.'
    }
  }
  for (let i = 0; i < list.length; i++) {
    for (let j = i + 1; j < list.length; j++) {
      const a = list[i]
      const b = list[j]
      if (a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h) {
        return 'Two photo windows overlap. Each window must be a separate transparent area.'
      }
    }
  }
  return null
}

/** Top to bottom, then left to right. Returns a new array. */
export function sortWindows(windows: BoothWindow[]): BoothWindow[] {
  return [...windows].sort((a, b) => a.y - b.y || a.x - b.x)
}

/** Reads the stored JSON string or an array of windows. `null` when absent or invalid. */
export function parseWindows(raw: unknown): BoothWindow[] | null {
  let value = raw
  if (typeof raw === 'string') {
    try {
      value = JSON.parse(raw)
    } catch {
      return null
    }
  }
  if (!Array.isArray(value) || !value.every(isWindow)) return null
  return value.map(({ x, y, w, h }) => ({ x, y, w, h }))
}
