// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { MAX_CAPTURE_WIDTH, captureVideoFrame, decodePhoto, releaseShot, shotSize } from './capture'

function fakeVideo(width: number, height: number) {
  return { videoWidth: width, videoHeight: height } as unknown as HTMLVideoElement
}

function stubCanvas() {
  const drawImage = vi.fn()
  const scale = vi.fn()
  HTMLCanvasElement.prototype.getContext = vi.fn(function getContext() {
    return { drawImage, scale, setTransform: vi.fn() }
  }) as unknown as typeof HTMLCanvasElement.prototype.getContext
  return { drawImage, scale }
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('captureVideoFrame', () => {
  it('returns null until the video has a size', () => {
    stubCanvas()
    expect(captureVideoFrame(fakeVideo(0, 0))).toBeNull()
    expect(captureVideoFrame(fakeVideo(1280, 0))).toBeNull()
  })

  it('keeps captures at most 1080 px wide and never mirrors them', () => {
    const { drawImage, scale } = stubCanvas()
    const video = fakeVideo(1920, 1080)
    const canvas = captureVideoFrame(video)!
    expect(canvas.width).toBe(MAX_CAPTURE_WIDTH)
    expect(canvas.height).toBe(608)
    expect(drawImage).toHaveBeenCalledWith(video, 0, 0, 1080, 608)
    expect(scale).not.toHaveBeenCalled()
  })

  it('does not upscale a small camera', () => {
    stubCanvas()
    const canvas = captureVideoFrame(fakeVideo(640, 480))!
    expect([canvas.width, canvas.height]).toEqual([640, 480])
  })
})

describe('decodePhoto', () => {
  it('downscales a wide photo to 1080 px and closes the original', async () => {
    const original = { width: 4000, height: 3000, close: vi.fn() }
    const createImageBitmap = vi.fn(async (_src: unknown, options?: { resizeWidth?: number; resizeHeight?: number }) =>
      options ? { width: options.resizeWidth, height: options.resizeHeight, close: vi.fn() } : original)
    vi.stubGlobal('createImageBitmap', createImageBitmap)
    const bitmap = await decodePhoto(new File([new Uint8Array([1])], 'a.jpg'))
    expect(bitmap.width).toBe(1080)
    expect(bitmap.height).toBe(810)
    expect(original.close).toHaveBeenCalled()
  })
})

describe('releaseShot and shotSize', () => {
  it('closes bitmaps and empties canvases', () => {
    const bitmap = { width: 10, height: 20, close: vi.fn() } as unknown as ImageBitmap
    releaseShot(bitmap)
    expect((bitmap as unknown as { close: () => void }).close).toHaveBeenCalled()
    const canvas = document.createElement('canvas')
    canvas.width = 100
    canvas.height = 50
    expect(shotSize(canvas)).toEqual({ width: 100, height: 50 })
    releaseShot(canvas)
    expect([canvas.width, canvas.height]).toEqual([0, 0])
  })
})
