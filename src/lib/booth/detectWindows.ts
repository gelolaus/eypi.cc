import { sortWindows, type BoothWindow } from '@shared/boothWindows'

export const ALPHA_CUTOFF = 32
export const MIN_REGION_FRACTION = 0.01

/**
 * Connected (4-neighbour) regions of pixels with alpha below the cutoff, as bounding boxes.
 * Regions covering under 1% of the image are dropped. Result is sorted top to bottom.
 */
export function findTransparentRegions(rgba: Uint8ClampedArray, width: number, height: number): BoothWindow[] {
  const total = width * height
  const visited = new Uint8Array(total)
  const stack = new Int32Array(total)
  const minPixels = total * MIN_REGION_FRACTION
  const regions: BoothWindow[] = []

  for (let start = 0; start < total; start++) {
    if (visited[start] || rgba[start * 4 + 3] >= ALPHA_CUTOFF) continue
    let top = 0
    stack[top++] = start
    visited[start] = 1
    let count = 0
    let minX = width
    let minY = height
    let maxX = 0
    let maxY = 0
    while (top > 0) {
      const p = stack[--top]
      const x = p % width
      const y = (p - x) / width
      count++
      if (x < minX) minX = x
      if (x > maxX) maxX = x
      if (y < minY) minY = y
      if (y > maxY) maxY = y
      if (x > 0) top = push(p - 1, rgba, visited, stack, top)
      if (x < width - 1) top = push(p + 1, rgba, visited, stack, top)
      if (y > 0) top = push(p - width, rgba, visited, stack, top)
      if (y < height - 1) top = push(p + width, rgba, visited, stack, top)
    }
    if (count >= minPixels) regions.push({ x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 })
  }
  return sortWindows(regions)
}

function push(p: number, rgba: Uint8ClampedArray, visited: Uint8Array, stack: Int32Array, top: number): number {
  if (visited[p] || rgba[p * 4 + 3] >= ALPHA_CUTOFF) return top
  visited[p] = 1
  stack[top] = p
  return top + 1
}

/** Loads the image, reads its pixels on a canvas and finds the transparent windows. */
export async function detectWindowsFromDataUrl(
  dataUrl: string,
): Promise<{ width: number; height: number; windows: BoothWindow[] }> {
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image()
    el.onload = () => resolve(el)
    el.onerror = () => reject(new Error('Could not read that image.'))
    el.src = dataUrl
  })
  const width = img.naturalWidth
  const height = img.naturalHeight
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) throw new Error('Could not read that image.')
  ctx.drawImage(img, 0, 0)
  const { data } = ctx.getImageData(0, 0, width, height)
  return { width, height, windows: findTransparentRegions(data, width, height) }
}
