import QRCodeStyling from 'qr-code-styling'
import type { LinkQrConfig } from '@shared/linkQrConfig'
import { qrLogoLayout } from '@shared/qrLogoLayout'

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('Failed to decode logo image.'))
    img.src = src
  })
}

function buildBaseOptions(size: number, data: string, config: LinkQrConfig) {
  const hasLogo = Boolean(config.logoDataUrl)
  return {
    width: size,
    height: size,
    type: 'canvas' as const,
    data,
    // Never pass image into qr-code-styling — its embed path blanks the canvas.
    backgroundOptions: { color: '#ffffff' },
    dotsOptions: { color: config.color, type: config.dotType },
    cornersSquareOptions: { color: config.color, type: config.eyeFrameType },
    cornersDotOptions: { color: config.color, type: config.eyeBallType },
    qrOptions: { errorCorrectionLevel: hasLogo ? 'H' as const : 'Q' as const },
  }
}

async function drawLogo(
  ctx: CanvasRenderingContext2D,
  size: number,
  logoDataUrl: string,
): Promise<void> {
  const logo = await loadImage(logoDataUrl)
  const { logoSize, x, y, clearX, clearY, clearSize } = qrLogoLayout(size)
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(clearX, clearY, clearSize, clearSize)
  ctx.drawImage(logo, x, y, logoSize, logoSize)
}

/** Render a styled QR (optional center logo composited by us). */
export async function renderLinkQrCanvas(
  size: number,
  data: string,
  config: LinkQrConfig,
): Promise<HTMLCanvasElement> {
  const qr = new QRCodeStyling(buildBaseOptions(size, data, config))
  const blob = await qr.getRawData('png')
  if (!blob || !(blob instanceof Blob)) {
    throw new Error('QR render produced no image data.')
  }

  const bitmap = await createImageBitmap(blob)
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas unavailable for QR render.')
  ctx.drawImage(bitmap, 0, 0, size, size)
  bitmap.close()

  if (config.logoDataUrl) {
    await drawLogo(ctx, size, config.logoDataUrl)
  }

  return canvas
}

export async function downloadLinkQrPng(
  size: number,
  data: string,
  config: LinkQrConfig,
  filename: string,
): Promise<void> {
  const canvas = await renderLinkQrCanvas(size, data, config)
  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob((b) => resolve(b), 'image/png')
  })
  if (!blob) throw new Error('Failed to encode PNG.')

  const url = URL.createObjectURL(blob)
  try {
    const a = document.createElement('a')
    a.href = url
    a.download = filename.endsWith('.png') ? filename : `${filename}.png`
    document.body.appendChild(a)
    a.click()
    a.remove()
  } finally {
    URL.revokeObjectURL(url)
  }
}
