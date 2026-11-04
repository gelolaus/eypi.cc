export type CameraFailure = 'denied' | 'none' | 'insecure' | 'unsupported' | 'other'

const IN_APP = /Instagram|FBAN|FBAV|FB_IAB|FB4A|Messenger|musical_ly|BytedanceWebview|TikTok|\bLine\/|Snapchat/i

export function isInAppBrowser(userAgent: string): boolean {
  return IN_APP.test(userAgent)
}

class CameraUnsupportedError extends Error {
  constructor() {
    super('Camera is not available in this browser')
    this.name = 'CameraUnsupportedError'
  }
}

export function classifyCameraError(err: unknown): CameraFailure {
  const name = typeof err === 'object' && err !== null ? (err as { name?: unknown }).name : undefined
  switch (name) {
    case 'NotAllowedError':
    case 'PermissionDeniedError':
      return 'denied'
    case 'NotFoundError':
    case 'DevicesNotFoundError':
    case 'OverconstrainedError':
      return 'none'
    case 'SecurityError':
      return 'insecure'
    case 'CameraUnsupportedError':
      return 'unsupported'
    default:
      return 'other'
  }
}

export async function openCamera(
  facing: 'user' | 'environment',
  deps: { mediaDevices?: Pick<MediaDevices, 'getUserMedia'> } = {},
): Promise<MediaStream> {
  const md =
    deps.mediaDevices ?? (typeof navigator !== 'undefined' ? navigator.mediaDevices : undefined)
  if (!md || typeof md.getUserMedia !== 'function') throw new CameraUnsupportedError()
  return md.getUserMedia({
    video: { facingMode: facing, width: { ideal: 1080 } },
    audio: false,
  })
}

export function stopStream(stream: MediaStream | null): void {
  if (!stream) return
  for (const track of stream.getTracks()) track.stop()
}
