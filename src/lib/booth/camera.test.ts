import { describe, expect, it, vi } from 'vitest'
import { classifyCameraError, isInAppBrowser, openCamera, stopStream } from './camera'

function named(name: string) {
  const e = new Error(name)
  e.name = name
  return e
}

describe('camera helpers', () => {
  it('detects Instagram, Facebook and TikTok user agents and not Safari or Chrome', () => {
    const insta = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Instagram 300.0.0.0'
    const fb = 'Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 Chrome/120 Mobile Safari/537.36 [FB_IAB/FB4A;FBAV/440.0.0.0]'
    const fban = 'Mozilla/5.0 (iPhone) Mobile/15E148 [FBAN/FBIOS;FBAV/440.0]'
    const messenger = 'Mozilla/5.0 (iPhone) Mobile/15E148 [FBAN/MessengerForiOS;FBAV/440.0]'
    const tiktok = 'Mozilla/5.0 (Linux; Android 13) Chrome/120 Mobile Safari/537.36 musical_ly_30.0.0 BytedanceWebview/d8a21c6'
    const tiktok2 = 'Mozilla/5.0 (iPhone) Mobile/15E148 TikTok 30.0.0'
    const line = 'Mozilla/5.0 (iPhone) Mobile/15E148 Line/13.0.0'
    const snap = 'Mozilla/5.0 (iPhone) Mobile/15E148 Snapchat/12.0.0'
    for (const ua of [insta, fb, fban, messenger, tiktok, tiktok2, line, snap]) {
      expect(isInAppBrowser(ua)).toBe(true)
    }
    const safari = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
    const chrome = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    const firefox = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0'
    for (const ua of [safari, chrome, firefox, '']) {
      expect(isInAppBrowser(ua)).toBe(false)
    }
  })

  it('maps NotAllowedError to denied, NotFoundError and OverconstrainedError to none, SecurityError to insecure, a missing mediaDevices to unsupported', async () => {
    expect(classifyCameraError(named('NotAllowedError'))).toBe('denied')
    expect(classifyCameraError(named('PermissionDeniedError'))).toBe('denied')
    expect(classifyCameraError(named('NotFoundError'))).toBe('none')
    expect(classifyCameraError(named('OverconstrainedError'))).toBe('none')
    expect(classifyCameraError(named('SecurityError'))).toBe('insecure')
    expect(classifyCameraError(named('AbortError'))).toBe('other')
    expect(classifyCameraError('boom')).toBe('other')
    expect(classifyCameraError(null)).toBe('other')

    const err = await openCamera('user', { mediaDevices: undefined, }).catch((e) => e)
    expect(classifyCameraError(err)).toBe('unsupported')
  })

  it('openCamera requests video with the facing mode and ideal 1080 width, no audio', async () => {
    const stream = {} as MediaStream
    const getUserMedia = vi.fn().mockResolvedValue(stream)
    const out = await openCamera('environment', { mediaDevices: { getUserMedia } })
    expect(out).toBe(stream)
    expect(getUserMedia).toHaveBeenCalledWith({
      video: { facingMode: 'environment', width: { ideal: 1080 } },
      audio: false,
    })
  })

  it('openCamera rethrows the original error', async () => {
    const boom = named('NotAllowedError')
    const getUserMedia = vi.fn().mockRejectedValue(boom)
    await expect(openCamera('user', { mediaDevices: { getUserMedia } })).rejects.toBe(boom)
  })

  it('stopStream stops every track and accepts null', () => {
    const a = { stop: vi.fn() }
    const b = { stop: vi.fn() }
    stopStream({ getTracks: () => [a, b] } as unknown as MediaStream)
    expect(a.stop).toHaveBeenCalledOnce()
    expect(b.stop).toHaveBeenCalledOnce()
    expect(() => stopStream(null)).not.toThrow()
  })
})
