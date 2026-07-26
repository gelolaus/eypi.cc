/** Geometry for compositing a center logo onto a finished QR canvas. */
export function qrLogoLayout(
  size: number,
  logoRatio = 0.28,
  padRatio = 0.04,
): {
  logoSize: number
  pad: number
  x: number
  y: number
  clearX: number
  clearY: number
  clearSize: number
} {
  const logoSize = Math.max(1, Math.round(size * logoRatio))
  const pad = Math.max(1, Math.round(size * padRatio))
  const x = Math.round((size - logoSize) / 2)
  const y = Math.round((size - logoSize) / 2)
  return {
    logoSize,
    pad,
    x,
    y,
    clearX: x - pad,
    clearY: y - pad,
    clearSize: logoSize + pad * 2,
  }
}
