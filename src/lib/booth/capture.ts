// Photo booth captures: grab a video frame or decode a picked photo, never wider than 1080 px.
// Captures are drawn as-is (never mirrored); only the live preview is mirrored, with CSS.

export const MAX_CAPTURE_WIDTH = 1080

export type BoothShot = HTMLCanvasElement | ImageBitmap

/** A still from the camera, or `null` while the video has no size yet (coverCrop needs one). */
export function captureVideoFrame(video: HTMLVideoElement): HTMLCanvasElement | null {
  const width = video.videoWidth
  const height = video.videoHeight
  if (!width || !height) return null
  const scale = Math.min(1, MAX_CAPTURE_WIDTH / width)
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(width * scale)
  canvas.height = Math.round(height * scale)
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
  return canvas
}

/** Decodes a picked photo, downscaled so it is at most 1080 px wide. */
export async function decodePhoto(file: File): Promise<ImageBitmap> {
  const bitmap = await createImageBitmap(file)
  if (bitmap.width <= MAX_CAPTURE_WIDTH) return bitmap
  const scale = MAX_CAPTURE_WIDTH / bitmap.width
  const resized = await createImageBitmap(bitmap, {
    resizeWidth: MAX_CAPTURE_WIDTH,
    resizeHeight: Math.max(1, Math.round(bitmap.height * scale)),
    resizeQuality: 'high',
  })
  bitmap.close()
  return resized
}

export function shotSize(shot: CanvasImageSource): { width: number; height: number } {
  const { width, height } = shot as { width: number; height: number }
  return { width: Number(width) || 0, height: Number(height) || 0 }
}

/** One reusable scratch canvas for `composeStrip`, freed with `release()`. */
export function createScratch() {
  let canvas: HTMLCanvasElement | null = null
  return {
    make(w: number, h: number): CanvasRenderingContext2D {
      canvas ??= document.createElement('canvas')
      canvas.width = w
      canvas.height = h
      return canvas.getContext('2d', { willReadFrequently: true }) as CanvasRenderingContext2D
    },
    release() {
      releaseShot(canvas)
      canvas = null
    },
  }
}

/** Frees a capture's pixels now instead of waiting for garbage collection. */
export function releaseShot(shot: CanvasImageSource | null | undefined): void {
  if (!shot) return
  if (typeof (shot as ImageBitmap).close === 'function') {
    ;(shot as ImageBitmap).close()
    return
  }
  if (typeof HTMLCanvasElement !== 'undefined' && shot instanceof HTMLCanvasElement) {
    shot.width = 0
    shot.height = 0
  }
}
