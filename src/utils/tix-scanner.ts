export const SCAN_FPS = 18
export const SCAN_COOLDOWN_MS = 1500
export const CROP_DOWNSCALE = 400

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

export function computeScanRegion(video: HTMLVideoElement) {
  const s = Math.min(video.videoWidth, video.videoHeight)
  const x = (video.videoWidth - s) / 2
  const y = (video.videoHeight - s) / 2
  return {
    x,
    y,
    width: s,
    height: s,
    downScaledWidth: CROP_DOWNSCALE,
    downScaledHeight: CROP_DOWNSCALE,
  }
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
  { video: { facingMode: { exact: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false },
  { video: { facingMode: 'environment' }, audio: false },
  { video: { facingMode: 'user' }, audio: false },
  { video: true, audio: false },
]

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
