/** Corner alpha below this is treated as already-transparent (no matte). */
export const LOGO_CORNER_ALPHA_MIN = 128

export function colorsClose(
  r1: number,
  g1: number,
  b1: number,
  r2: number,
  g2: number,
  b2: number,
  tolerance = 24,
): boolean {
  return (
    Math.abs(r1 - r2) <= tolerance
    && Math.abs(g1 - g2) <= tolerance
    && Math.abs(b1 - b2) <= tolerance
  )
}

export function shouldSampleAsBackgroundCorner(alpha: number): boolean {
  return alpha >= LOGO_CORNER_ALPHA_MIN
}

/**
 * Remove opaque background connected to the image edges (flood fill from corners).
 * Keeps enclosed logo fills (e.g. white letters ringed by dark outlines).
 */
export function knockOutEdgeConnectedBackground(
  data: Uint8ClampedArray | Buffer,
  width: number,
  height: number,
  tolerance = 24,
): void {
  const idx = (x: number, y: number) => (y * width + x) * 4
  const corners: Array<[number, number]> = [
    [0, 0],
    [width - 1, 0],
    [0, height - 1],
    [width - 1, height - 1],
  ]

  const seeds: Array<[number, number, number, number, number]> = []
  for (const [x, y] of corners) {
    const i = idx(x, y)
    if (!shouldSampleAsBackgroundCorner(data[i + 3])) continue
    seeds.push([x, y, data[i], data[i + 1], data[i + 2]])
  }
  if (seeds.length === 0) return

  const seen = new Uint8Array(width * height)
  const stack: number[] = []

  const enqueue = (x: number, y: number, r: number, g: number, b: number) => {
    if (x < 0 || y < 0 || x >= width || y >= height) return
    const p = y * width + x
    if (seen[p]) return
    const i = p * 4
    if (data[i + 3] < LOGO_CORNER_ALPHA_MIN) {
      seen[p] = 1
      return
    }
    if (!colorsClose(data[i], data[i + 1], data[i + 2], r, g, b, tolerance)) return
    seen[p] = 1
    data[i + 3] = 0
    stack.push(x, y, r, g, b)
  }

  for (const [x, y, r, g, b] of seeds) enqueue(x, y, r, g, b)

  while (stack.length) {
    const b = stack.pop()!
    const g = stack.pop()!
    const r = stack.pop()!
    const y = stack.pop()!
    const x = stack.pop()!
    enqueue(x + 1, y, r, g, b)
    enqueue(x - 1, y, r, g, b)
    enqueue(x, y + 1, r, g, b)
    enqueue(x, y - 1, r, g, b)
  }
}
