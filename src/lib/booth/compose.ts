// Photo booth composition: cover-crop each shot into its window, filter it, then lay the frame on top.
// The export is never mirrored (only the live preview is), so no negative scale is ever used.
import { BOOTH_HEIGHT, BOOTH_WIDTH, type BoothWindow } from '@shared/boothWindows'
import { applyFilter, type BoothFilterId } from './filters'

export type CropRect = { sx: number; sy: number; sw: number; sh: number }

/** The largest centred region of the source that has the destination's aspect ratio. */
export function coverCrop(srcW: number, srcH: number, destW: number, destH: number): CropRect {
  const srcRatio = srcW / srcH
  const destRatio = destW / destH
  if (srcRatio > destRatio) {
    const sw = srcH * destRatio
    return { sx: (srcW - sw) / 2, sy: 0, sw, sh: srcH }
  }
  const sh = srcW / destRatio
  return { sx: 0, sy: (srcH - sh) / 2, sw: srcW, sh }
}

export type ComposeInput = {
  frame: CanvasImageSource
  windows: BoothWindow[]
  shots: (CanvasImageSource | null)[]
  shotSize: (shot: CanvasImageSource) => { width: number; height: number }
  filter: BoothFilterId
  makeScratch: (w: number, h: number) => CanvasRenderingContext2D
}

export function composeStrip(ctx: CanvasRenderingContext2D, input: ComposeInput): void {
  ctx.clearRect(0, 0, BOOTH_WIDTH, BOOTH_HEIGHT)
  input.windows.forEach((win, i) => {
    const shot = input.shots[i]
    if (!shot) return
    const { width, height } = input.shotSize(shot)
    const { sx, sy, sw, sh } = coverCrop(width, height, win.w, win.h)
    const scratch = input.makeScratch(win.w, win.h)
    scratch.clearRect(0, 0, win.w, win.h)
    scratch.drawImage(shot, sx, sy, sw, sh, 0, 0, win.w, win.h)
    const image = scratch.getImageData(0, 0, win.w, win.h)
    applyFilter(input.filter, image.data, win.w, win.h)
    scratch.putImageData(image, 0, 0)
    ctx.drawImage(scratch.canvas, win.x, win.y, win.w, win.h)
  })
  ctx.drawImage(input.frame, 0, 0, BOOTH_WIDTH, BOOTH_HEIGHT)
}
