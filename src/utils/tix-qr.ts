/**
 * High-contrast, scanner-friendly QR styling for ticket codes.
 * Square black modules on white maximize decode success across
 * BarcodeDetector, jsQR, and real-world glare/reflection.
 */
export const TIX_QR_RENDER_OPTIONS = {
  dotsOptions: { color: '#000000', type: 'square' as const },
  cornersSquareOptions: { color: '#000000', type: 'square' as const },
  cornersDotOptions: { color: '#000000', type: 'square' as const },
  backgroundOptions: { color: '#ffffff' as const },
  qrOptions: { errorCorrectionLevel: 'H' as const },
}
