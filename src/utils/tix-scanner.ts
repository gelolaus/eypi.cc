// qr-scanner's own decode throughput cap (Web Worker / jsQR fallback path).
// The native BarcodeDetector path is not throttled by this constant — it runs
// on every animation frame the GPU/OS hands us, since modern hardware decodes
// a full frame in well under a millisecond and any artificial cap only adds
// latency for zero benefit.
export const SCAN_FPS = 25
export const SCAN_COOLDOWN_MS = 1500

export type ScanStatus =
  | 'idle'
  | 'ready'
  | 'decoding'
  | 'submitting'
  | 'success'
  | 'error'

export const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export function isValidQrToken(s: string): boolean {
  return UUID_RE.test(s.trim())
}

export function formatScannerError(err: unknown): string {
  if (err instanceof Error) return `${err.name}: ${err.message}`
  if (err && typeof err === 'object' && 'name' in err && 'message' in err) {
    return `${String((err as { name: unknown }).name)}: ${String((err as { message: unknown }).message)}`
  }
  return String(err ?? 'Unknown camera error')
}

/**
 * True when a getUserMedia() failure is about *camera selection* (wrong facing
 * mode, unsupported resolution, device momentarily busy) rather than a hard
 * stop (permission denied, insecure context). Selection failures are worth
 * retrying with looser constraints; hard stops are not.
 */
export function isRetriableCameraError(err: unknown): boolean {
  if (err instanceof DOMException) {
    return err.name === 'NotFoundError'
      || err.name === 'NotReadableError'
      || err.name === 'OverconstrainedError'
      || err.name === 'ConstraintNotSatisfiedError'
  }
  if (typeof err === 'string') return err.toLowerCase().includes('camera not found')
  return false
}

export function isPermissionDeniedError(err: unknown): boolean {
  if (err instanceof DOMException) {
    return err.name === 'NotAllowedError' || err.name === 'SecurityError'
  }
  return false
}

export function scannerPermissionHint(err: unknown): string | null {
  if (!isPermissionDeniedError(err)) return null
  if (typeof window !== 'undefined' && !window.isSecureContext) {
    return 'Camera requires HTTPS. Open this page over a secure connection.'
  }
  return 'Camera blocked. Tap Enable Camera and allow access when prompted, or check site permissions in your browser settings.'
}

/**
 * Progressively looser getUserMedia() constraints. We acquire the stream
 * ourselves — rather than letting qr-scanner manage its own camera
 * acquisition — because qr-scanner's internal implementation catches every
 * per-constraint DOMException silently and always rethrows the same generic
 * "Camera not found." string, making it impossible to tell a permission
 * block (NotAllowedError) apart from a missing rear camera (NotFoundError)
 * or a device already in use (NotReadableError).
 */
export const CAMERA_CONSTRAINTS: MediaStreamConstraints[] = [
  { video: { facingMode: { exact: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } }, audio: false },
  { video: { facingMode: 'environment' }, audio: false },
  { video: { facingMode: 'user' }, audio: false },
  { video: true, audio: false },
]

export async function canUseNativeBarcodeDetector(): Promise<boolean> {
  if (!('BarcodeDetector' in window)) return false
  try {
    // @ts-expect-error BarcodeDetector is not yet in all TS lib targets
    const formats: string[] = await window.BarcodeDetector.getSupportedFormats()
    return formats.includes('qr_code')
  } catch {
    return false
  }
}

export function playScanFeedback() {
  if (navigator.vibrate) {
    navigator.vibrate(50)
    return
  }
  try {
    const ctx = new AudioContext()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.frequency.value = 880
    gain.gain.value = 0.08
    osc.start()
    osc.stop(ctx.currentTime + 0.08)
    osc.onended = () => ctx.close()
  } catch {
    /* no audio permission */
  }
}
