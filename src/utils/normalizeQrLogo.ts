import { QR_LOGO_MAX_EDGE, qrLogoTargetSize } from '@shared/qrLogoSize'

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('Failed to decode logo image.'))
    img.src = src
  })
}

/**
 * Downscale oversized logos so qr-code-styling's canvas/SVG pipeline stays reliable.
 * Large pixel dimensions (e.g. 1920²) blank the preview even when file size is under 2 MB.
 */
export async function normalizeQrLogoDataUrl(
  dataUrl: string,
  maxEdge = QR_LOGO_MAX_EDGE,
): Promise<string> {
  const img = await loadImage(dataUrl)
  const srcW = img.naturalWidth || img.width
  const srcH = img.naturalHeight || img.height
  const { width, height } = qrLogoTargetSize(srcW, srcH, maxEdge)
  const alreadySized = width === srcW && height === srcH
  const alreadyPngOrJpeg =
    dataUrl.startsWith('data:image/png;base64,')
    || dataUrl.startsWith('data:image/jpeg;base64,')

  if (alreadySized && alreadyPngOrJpeg) return dataUrl

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas unavailable for logo normalize.')
  ctx.clearRect(0, 0, width, height)
  ctx.drawImage(img, 0, 0, width, height)
  return canvas.toDataURL('image/png')
}
