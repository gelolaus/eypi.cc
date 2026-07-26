/** Max edge length for QR center logos before render/persist. */
export const QR_LOGO_MAX_EDGE = 384

export function qrLogoTargetSize(
  width: number,
  height: number,
  maxEdge = QR_LOGO_MAX_EDGE,
): { width: number; height: number } {
  const w = Math.max(1, Math.round(width))
  const h = Math.max(1, Math.round(height))
  const longest = Math.max(w, h)
  if (longest <= maxEdge) return { width: w, height: h }
  const scale = maxEdge / longest
  return {
    width: Math.max(1, Math.round(w * scale)),
    height: Math.max(1, Math.round(h * scale)),
  }
}
