import { contentBottom, sizingUnit } from './safeZone'
import { FONT_FAMILY as FAMILY, fontString } from './text'
import type { Theme } from './themes'

const LOGO_URL = '/eypi-mark.png'

let logo: Promise<CanvasImageSource | null> | null = null

/** The Eypi mark, loaded once. Resolves to null when it cannot be loaded, so the wallpaper still draws. */
export function loadLogo(): Promise<CanvasImageSource | null> {
  logo ??= new Promise((resolve) => {
    if (typeof Image === 'undefined') return resolve(null)
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => {
      logo = null
      resolve(null)
    }
    image.src = LOGO_URL
  })
  return logo
}

/** "Made with [Eypi mark] Eypi", centred in the bottom margin. */
export function drawWatermark(ctx: CanvasRenderingContext2D, width: number, height: number, theme: Theme, mark: CanvasImageSource | null): void {
  const margin = height - contentBottom(height)
  const size = Math.min(sizingUnit(width, height) * 0.026, margin * 0.4)
  const gap = size * 0.4
  const markSize = size * 1.6
  const centerY = contentBottom(height) + margin / 2

  ctx.textBaseline = 'middle'
  ctx.textAlign = 'left'
  ctx.font = fontString(500, size, FAMILY)
  const madeWidth = ctx.measureText('Made with').width
  ctx.font = fontString(700, size, FAMILY)
  const nameWidth = ctx.measureText('Eypi').width
  const total = madeWidth + gap + (mark ? markSize + gap : 0) + nameWidth

  let x = (width - total) / 2
  ctx.globalAlpha = 0.8
  ctx.fillStyle = theme.muted
  ctx.font = fontString(500, size, FAMILY)
  ctx.fillText('Made with', x, centerY)
  x += madeWidth + gap
  if (mark) {
    ctx.drawImage(mark, x, centerY - markSize / 2, markSize, markSize)
    x += markSize + gap
  }
  ctx.fillStyle = theme.text
  ctx.font = fontString(700, size, FAMILY)
  ctx.fillText('Eypi', x, centerY)
  ctx.globalAlpha = 1
}
