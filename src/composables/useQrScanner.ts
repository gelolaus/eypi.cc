import { computed, nextTick, ref } from 'vue'
import { api } from '@/lib/api'
import {
  CAMERA_CONSTRAINTS,
  SCAN_COOLDOWN_MS,
  SCAN_FPS,
  canUseNativeBarcodeDetector,
  formatScannerError,
  isRetriableCameraError,
  isValidQrToken,
  playResultFeedback,
  scannerPermissionHint,
  type ScanResultKind,
  type ScanStatus,
} from '@/utils/tix-scanner'

export const SCAN_REMEMBER_MS = 5000

export interface ScanSubmission {
  ok: boolean
  kind: ScanResultKind
  message: string
}

type QrScannerInstance = InstanceType<typeof import('qr-scanner').default>
type QrScannerModule = typeof import('qr-scanner').default

type NativeBarcodeDetector = {
  detect: (source: HTMLVideoElement) => Promise<{ rawValue: string }[]>
}

const QR_SCANNER_OPTIONS = {
  highlightScanRegion: false,
  highlightCodeOutline: false,
  maxScansPerSecond: SCAN_FPS,
  returnDetailedScanResult: true as const,
}

async function submitCheckIn(slug: string, qrToken: string): Promise<ScanSubmission> {
  try {
    const res = await api.raw(`/api/events/${slug}/checkin`, {
      method: 'POST',
      body: JSON.stringify({ qrToken }),
    })
    const data = await res.json() as { message?: string; error?: { code?: string } }
    const message = data.message ?? (res.ok ? 'Checked in.' : 'Check-in failed.')
    if (res.ok) return { ok: true, kind: 'success', message }
    if (data.error?.code === 'already_checked_in') return { ok: false, kind: 'already_checked_in', message }
    if (res.status === 403) return { ok: false, kind: 'removed', message }
    return { ok: false, kind: 'error', message }
  } catch {
    return { ok: false, kind: 'error', message: 'Network error' }
  }
}

export function useQrScanner(options: {
  slug: string
  now?: () => number
  rememberMs?: number
  onCheckedIn?: () => void
  submit?: (token: string) => Promise<ScanSubmission>
}) {
  const videoRef = ref<HTMLVideoElement | null>(null)
  const scannerError = ref('')
  const scanStatus = ref<ScanStatus>('idle')
  const scanMessage = ref('')
  const cameraStarting = ref(false)

  let qrScanner: QrScannerInstance | null = null
  let activeStream: MediaStream | null = null
  let resetTimer: ReturnType<typeof setTimeout> | null = null
  let scanCooldown = false
  let startToken = 0
  let remembered: { token: string; at: number } | null = null
  let nativeDetector: NativeBarcodeDetector | null = null
  let nativeRafId: number | null = null
  let detecting = false

  const rememberMs = options.rememberMs ?? SCAN_REMEMBER_MS
  const now = () => options.now?.() ?? Date.now()

  const needsCameraPrompt = computed(() =>
    (scanStatus.value === 'idle' || scanStatus.value === 'error') && !cameraStarting.value,
  )

  const hudLabel = computed(() => {
    const labels: Record<ScanStatus, string> = {
      idle: 'Idle',
      ready: 'Ready',
      decoding: 'Decoding',
      submitting: 'Checking in',
      success: 'Success',
      error: 'Error',
    }
    return labels[scanStatus.value]
  })

  const hudClass = computed(() => {
    const classes: Record<ScanStatus, string> = {
      idle: 'bg-gray-600',
      ready: 'bg-emerald-600',
      decoding: 'bg-amber-500',
      submitting: 'bg-blue-600',
      success: 'bg-emerald-600',
      error: 'bg-red-600',
    }
    return classes[scanStatus.value]
  })

  const hudBannerClass = computed(() => {
    if (scanStatus.value === 'success') return 'bg-emerald-600'
    if (scanStatus.value === 'error') return 'bg-red-600'
    if (scanStatus.value === 'submitting') return 'bg-blue-600'
    return 'bg-gray-700'
  })

  function scheduleReset(ms: number) {
    if (resetTimer) clearTimeout(resetTimer)
    resetTimer = setTimeout(() => {
      scanCooldown = false
      scanStatus.value = 'decoding'
      scanMessage.value = ''
      resetTimer = null
    }, ms)
  }

  function sameTokenStillFresh(token: string): boolean {
    if (!remembered || remembered.token !== token) return false
    return now() - remembered.at < rememberMs
  }

  function onDecoded(raw: string | null) {
    if (!raw || scanCooldown) return
    const token = raw.trim()
    if (!isValidQrToken(token)) {
      scanCooldown = true
      scanStatus.value = 'error'
      scanMessage.value = 'Invalid token format'
      playResultFeedback('invalid')
      scheduleReset(SCAN_COOLDOWN_MS)
      return
    }
    if (sameTokenStillFresh(token)) return
    remembered = { token, at: now() }
    scanCooldown = true
    scanStatus.value = 'submitting'
    scanMessage.value = 'Submitting check-in…'
    void finishScan(token)
  }

  async function finishScan(token: string) {
    try {
      const result = await (options.submit ?? ((value: string) => submitCheckIn(options.slug, value)))(token)
      scanStatus.value = result.ok ? 'success' : 'error'
      scanMessage.value = result.message
      playResultFeedback(result.kind)
      if (result.ok) options.onCheckedIn?.()
    } catch {
      scanStatus.value = 'error'
      scanMessage.value = 'Network error'
      playResultFeedback('error')
    } finally {
      scheduleReset(SCAN_COOLDOWN_MS)
    }
  }

  function stopStream(stream: MediaStream | null) {
    stream?.getTracks().forEach((track) => track.stop())
  }

  function releaseActiveStream() {
    stopStream(activeStream)
    activeStream = null
    if (videoRef.value?.srcObject instanceof MediaStream) {
      stopStream(videoRef.value.srcObject)
      videoRef.value.srcObject = null
    }
  }

  function startNativeDetectionLoop(detector: NativeBarcodeDetector, video: HTMLVideoElement) {
    const tick = () => {
      if (!detecting && !scanCooldown && video.readyState >= video.HAVE_CURRENT_DATA) {
        detecting = true
        detector.detect(video)
          .then((codes) => { onDecoded(codes[0]?.rawValue ?? null) })
          .catch(() => { /* transient frame miss — next tick retries */ })
          .finally(() => { detecting = false })
      }
      nativeRafId = requestAnimationFrame(tick)
    }
    nativeRafId = requestAnimationFrame(tick)
  }

  function stopNativeDetectionLoop() {
    if (nativeRafId !== null) {
      cancelAnimationFrame(nativeRafId)
      nativeRafId = null
    }
    nativeDetector = null
    detecting = false
  }

  function destroyQrScanner() {
    stopNativeDetectionLoop()
    if (qrScanner) {
      qrScanner.stop()
      qrScanner.destroy()
      qrScanner = null
    }
    releaseActiveStream()
  }

  async function acquireCameraStreamFrom(fromIndex: number): Promise<MediaStream> {
    let lastError: unknown = null
    for (let index = fromIndex; index < CAMERA_CONSTRAINTS.length; index += 1) {
      try {
        return await navigator.mediaDevices.getUserMedia(CAMERA_CONSTRAINTS[index])
      } catch (err) {
        lastError = err
        if (!isRetriableCameraError(err)) throw err
      }
    }
    throw lastError ?? new DOMException('No camera could be acquired', 'NotFoundError')
  }

  function beginCameraStreamRequest(): Promise<MediaStream> {
    if (!navigator.mediaDevices?.getUserMedia) {
      return Promise.reject(new DOMException('Camera API unavailable', 'NotSupportedError'))
    }
    return navigator.mediaDevices.getUserMedia(CAMERA_CONSTRAINTS[0]).catch((err) => {
      if (!isRetriableCameraError(err)) throw err
      return acquireCameraStreamFrom(1)
    })
  }

  async function loadQrScannerModule(): Promise<QrScannerModule> {
    const { default: QrScanner } = await import('qr-scanner')
    return QrScanner
  }

  async function startQrScannerEngine(video: HTMLVideoElement, stream: MediaStream, token: number): Promise<boolean> {
    const QrScanner = await loadQrScannerModule()
    if (token !== startToken) return false
    destroyQrScanner()
    qrScanner = new QrScanner(video, (result) => onDecoded(result.data), QR_SCANNER_OPTIONS)
    activeStream = stream
    video.srcObject = stream
    await qrScanner.start()
    return token === startToken
  }

  async function startNativeScannerEngine(video: HTMLVideoElement, stream: MediaStream, token: number): Promise<boolean> {
    destroyQrScanner()
    activeStream = stream
    video.srcObject = stream
    await video.play()
    if (token !== startToken) return false
    // @ts-expect-error BarcodeDetector is not yet in all TS lib targets
    nativeDetector = new window.BarcodeDetector({ formats: ['qr_code'] }) as NativeBarcodeDetector
    startNativeDetectionLoop(nativeDetector, video)
    return token === startToken
  }

  function reportScannerError(err: unknown) {
    const base = formatScannerError(err)
    const hint = scannerPermissionHint(err)
    const message = hint ? `${base} — ${hint}` : base
    scannerError.value = message
    scanStatus.value = 'error'
    scanMessage.value = message
  }

  async function startScannerFromUserGesture() {
    const token = ++startToken
    scannerError.value = ''
    scanMessage.value = ''
    scanStatus.value = 'idle'
    cameraStarting.value = true

    if (!window.isSecureContext) {
      cameraStarting.value = false
      reportScannerError(new DOMException('Camera requires HTTPS', 'SecurityError'))
      return
    }

    const streamPromise = beginCameraStreamRequest()
    await nextTick()
    if (token !== startToken) return

    const video = videoRef.value
    if (!video?.isConnected) {
      cameraStarting.value = false
      reportScannerError(new DOMException('Video element not mounted', 'NotFoundError'))
      return
    }

    let stream: MediaStream
    try {
      stream = await streamPromise
    } catch (err) {
      cameraStarting.value = false
      if (token === startToken) reportScannerError(err)
      return
    }
    if (token !== startToken) {
      stopStream(stream)
      cameraStarting.value = false
      return
    }

    try {
      if (await canUseNativeBarcodeDetector()) {
        try {
          const started = await startNativeScannerEngine(video, stream, token)
          if (!started) {
            destroyQrScanner()
            cameraStarting.value = false
            return
          }
        } catch {
          const started = await startQrScannerEngine(video, stream, token)
          if (!started) {
            destroyQrScanner()
            cameraStarting.value = false
            return
          }
        }
      } else {
        const started = await startQrScannerEngine(video, stream, token)
        if (!started) {
          destroyQrScanner()
          cameraStarting.value = false
          return
        }
      }

      if (token !== startToken) {
        destroyQrScanner()
        cameraStarting.value = false
        return
      }
      cameraStarting.value = false
      scanStatus.value = 'decoding'
    } catch (err) {
      stopStream(stream)
      destroyQrScanner()
      cameraStarting.value = false
      if (token === startToken) reportScannerError(err)
    }
  }

  function onEnableCameraClick() {
    void startScannerFromUserGesture()
  }

  function stopScanner() {
    startToken += 1
    if (resetTimer) {
      clearTimeout(resetTimer)
      resetTimer = null
    }
    destroyQrScanner()
    scanCooldown = false
    cameraStarting.value = false
    scanStatus.value = 'idle'
    scanMessage.value = ''
    scannerError.value = ''
  }

  return {
    videoRef,
    scannerError,
    scanStatus,
    scanMessage,
    cameraStarting,
    needsCameraPrompt,
    hudLabel,
    hudClass,
    hudBannerClass,
    onDecoded,
    onEnableCameraClick,
    stopScanner,
  }
}
