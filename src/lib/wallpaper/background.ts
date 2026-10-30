import type { Theme } from './themes'

const MAX_SIDE = 4096
const MAX_DIM = 0.8

/** The centred crop of the source that has the destination's aspect ratio. */
export function coverRect(srcW: number, srcH: number, dstW: number, dstH: number): { sx: number; sy: number; sw: number; sh: number } {
  const dstRatio = dstW / dstH
  if (srcW / srcH > dstRatio) {
    const sw = srcH * dstRatio
    return { sx: (srcW - sw) / 2, sy: 0, sw, sh: srcH }
  }
  const sh = srcW / dstRatio
  return { sx: 0, sy: (srcH - sh) / 2, sw: srcW, sh }
}

/** True when the photo would be stretched to cover the output. */
export function isSmallerThan(photo: { width: number; height: number }, width: number, height: number): boolean {
  const scale = Math.max(width / photo.width, height / photo.height)
  return scale > 1
}

/** Decodes the photo with its EXIF rotation, scaled down so the longest side is at most 4096 px. */
export async function loadPhoto(file: File): Promise<ImageBitmap> {
  if (!file.type.startsWith('image/')) throw new Error('Choose an image file.')
  const options = { imageOrientation: 'from-image' } as const
  let bitmap: ImageBitmap
  try {
    bitmap = await createImageBitmap(file, options)
  } catch {
    throw new Error('Choose an image file.')
  }
  const longest = Math.max(bitmap.width, bitmap.height)
  if (longest <= MAX_SIDE) return bitmap
  const scale = MAX_SIDE / longest
  const resizeWidth = Math.round(bitmap.width * scale)
  const resizeHeight = Math.round(bitmap.height * scale)
  bitmap.close?.()
  return createImageBitmap(file, { ...options, resizeWidth, resizeHeight })
}

/** Fills the theme background, then the photo cropped to cover with an overlay in the theme colour. */
export function drawBackground(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  theme: Theme,
  photo: ImageBitmap | null,
  dim: number,
): void {
  ctx.fillStyle = theme.bg
  ctx.fillRect(0, 0, width, height)
  if (!photo) return
  const { sx, sy, sw, sh } = coverRect(photo.width, photo.height, width, height)
  ctx.drawImage(photo, sx, sy, sw, sh, 0, 0, width, height)
  ctx.globalAlpha = Math.min(Math.max(dim, 0), MAX_DIM)
  ctx.fillStyle = theme.bg
  ctx.fillRect(0, 0, width, height)
  ctx.globalAlpha = 1
}
