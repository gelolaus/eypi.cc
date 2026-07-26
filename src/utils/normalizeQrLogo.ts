import { QR_LOGO_MAX_EDGE, qrLogoTargetSize } from '@shared/qrLogoSize'
import { knockOutEdgeConnectedBackground } from '@shared/qrLogoMatte'

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('Failed to decode logo image.'))
    img.src = src
  })
}

/**
 * Downscale oversized logos and knock out edge-connected backgrounds
 * (solid black/white pads) so only the artwork remains.
 */
export async function normalizeQrLogoDataUrl(
  dataUrl: string,
  maxEdge = QR_LOGO_MAX_EDGE,
): Promise<string> {
  const img = await loadImage(dataUrl)
  const srcW = img.naturalWidth || img.width
  const srcH = img.naturalHeight || img.height
  const { width, height } = qrLogoTargetSize(srcW, srcH, maxEdge)

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d', { alpha: true })
  if (!ctx) throw new Error('Canvas unavailable for logo normalize.')
  ctx.clearRect(0, 0, width, height)
  ctx.drawImage(img, 0, 0, width, height)

  const imageData = ctx.getImageData(0, 0, width, height)
  knockOutEdgeConnectedBackground(imageData.data, width, height)
  ctx.putImageData(imageData, 0, 0)

  return canvas.toDataURL('image/png')
}
