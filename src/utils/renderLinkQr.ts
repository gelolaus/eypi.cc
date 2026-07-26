import QRCodeStyling from 'qr-code-styling'
import type { LinkQrConfig } from '@shared/linkQrConfig'
import { qrLogoLayout } from '@shared/qrLogoLayout'
import { knockOutEdgeConnectedBackground } from '@shared/qrLogoMatte'
import { shouldPunchToTransparent } from '@shared/qrTransparency'

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('Failed to decode logo image.'))
    img.src = src
  })
}

export type QrBackground = 'white' | 'transparent'

function buildBaseOptions(size: number, data: string, config: LinkQrConfig) {
  const hasLogo = Boolean(config.logoDataUrl)
  return {
    width: size,
    height: size,
    type: 'canvas' as const,
    data,
    // Always render on white first — library "transparent" still bakes opaque white into PNG.
    backgroundOptions: { color: '#ffffff' },
    dotsOptions: { color: config.color, type: config.dotType },
    cornersSquareOptions: { color: config.color, type: config.eyeFrameType },
    cornersDotOptions: { color: config.color, type: config.eyeBallType },
    qrOptions: { errorCorrectionLevel: hasLogo ? 'H' as const : 'Q' as const },
  }
}

/** Turn baked white QR background into real PNG alpha. */
function punchWhiteBackground(ctx: CanvasRenderingContext2D, size: number): void {
  const imageData = ctx.getImageData(0, 0, size, size)
  const d = imageData.data
  for (let i = 0; i < d.length; i += 4) {
    if (shouldPunchToTransparent(d[i], d[i + 1], d[i + 2])) {
      d[i + 3] = 0
    }
  }
  ctx.putImageData(imageData, 0, 0)
}

/** Prepare logo: scale, knock out edge-connected bg (black/white pads), keep artwork. */
async function prepareLogoCanvas(
  logoDataUrl: string,
  logoSize: number,
): Promise<HTMLCanvasElement> {
  const logo = await loadImage(logoDataUrl)
  const canvas = document.createElement('canvas')
  canvas.width = logoSize
  canvas.height = logoSize
  const ctx = canvas.getContext('2d', { alpha: true })
  if (!ctx) throw new Error('Canvas unavailable for logo prepare.')
  ctx.clearRect(0, 0, logoSize, logoSize)
  ctx.drawImage(logo, 0, 0, logoSize, logoSize)
  const imageData = ctx.getImageData(0, 0, logoSize, logoSize)
  knockOutEdgeConnectedBackground(imageData.data, logoSize, logoSize)
  ctx.putImageData(imageData, 0, 0)
  return canvas
}

async function drawLogo(
  ctx: CanvasRenderingContext2D,
  size: number,
  logoDataUrl: string,
  backdrop: 'white' | 'none',
): Promise<void> {
  const { logoSize, x, y } = qrLogoLayout(size, 0.28, 0)
  const logoCanvas = await prepareLogoCanvas(logoDataUrl, logoSize)

  if (backdrop === 'white') {
    // Preview only: solid plate so the mark reads on the dark sidebar.
    const pad = Math.max(4, Math.round(logoSize * 0.1))
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(x - pad, y - pad, logoSize + pad * 2, logoSize + pad * 2)
  } else {
    // Export: transparent under the logo — no white plate.
    ctx.clearRect(x, y, logoSize, logoSize)
  }

  ctx.drawImage(logoCanvas, x, y)
}

/** Render a styled QR (optional center logo composited by us). */
export async function renderLinkQrCanvas(
  size: number,
  data: string,
  config: LinkQrConfig,
  background: QrBackground = 'white',
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
  const ctx = canvas.getContext('2d', { alpha: true })
  if (!ctx) throw new Error('Canvas unavailable for QR render.')
  ctx.clearRect(0, 0, size, size)
  ctx.drawImage(bitmap, 0, 0, size, size)
  bitmap.close()

  if (background === 'transparent') {
    punchWhiteBackground(ctx, size)
  }

  if (config.logoDataUrl) {
    // White logo plate in preview only; export stays fully transparent.
    await drawLogo(ctx, size, config.logoDataUrl, background === 'white' ? 'white' : 'none')
  }

  return canvas
}

export async function downloadLinkQrPng(
  size: number,
  data: string,
  config: LinkQrConfig,
  filename: string,
  background: QrBackground = 'transparent',
): Promise<void> {
  const canvas = await renderLinkQrCanvas(size, data, config, background)
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
