/** Near-white QR background pixels become transparent on export. */
export const QR_WHITE_PUNCH_THRESHOLD = 245

export function shouldPunchToTransparent(
  r: number,
  g: number,
  b: number,
  threshold = QR_WHITE_PUNCH_THRESHOLD,
): boolean {
  return r >= threshold && g >= threshold && b >= threshold
}
