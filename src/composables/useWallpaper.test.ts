// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { SAMPLE_TERM2 } from '@shared/schedule/fixtures'

const loadPhoto = vi.hoisted(() => vi.fn())
vi.mock('@/lib/wallpaper/background', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/wallpaper/background')>()),
  loadPhoto,
}))

import { useWallpaper } from './useWallpaper'

const bitmap = (width: number, height: number) => ({ width, height, close: vi.fn() }) as unknown as ImageBitmap
const file = () => new File(['x'], 'p.jpg', { type: 'image/jpeg' })

describe('useWallpaper', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    loadPhoto.mockReset()
  })
  afterEach(() => vi.useRealTimers())

  it('parses the pasted text after 150 ms', () => {
    const w = useWallpaper()
    expect(w.hasSchedule.value).toBe(false)
    w.text.value = SAMPLE_TERM2
    vi.advanceTimersByTime(149)
    expect(w.hasSchedule.value).toBe(false)
    vi.advanceTimersByTime(1)
    expect(w.hasSchedule.value).toBe(true)
    expect(w.parsed.value.subjects).toHaveLength(5)
    w.text.value = ''
    vi.advanceTimersByTime(150)
    expect(w.hasSchedule.value).toBe(false)
  })

  it('starts with the agenda layout, the dark theme and a 0.45 dim', () => {
    const w = useWallpaper()
    expect(w.layout.value).toBe('agenda')
    expect(w.theme.value).toBe('dark')
    expect(w.dim.value).toBe(0.45)
    expect(w.photo.value).toBeNull()
  })

  describe('size', () => {
    const screen = (width: number, height: number, ratio: number, coarse: boolean) => {
      vi.spyOn(window.screen, 'width', 'get').mockReturnValue(width)
      vi.spyOn(window.screen, 'height', 'get').mockReturnValue(height)
      vi.stubGlobal('devicePixelRatio', ratio)
      vi.stubGlobal('matchMedia', () => ({ matches: coarse }))
    }
    afterEach(() => {
      vi.restoreAllMocks()
      vi.unstubAllGlobals()
    })

    it('starts at the pixel size of a desktop or laptop screen', () => {
      screen(1536, 864, 1.25, false)
      expect(useWallpaper().size.value).toEqual({ width: 1920, height: 1080 })
    })

    it('starts at the pixel size of a phone in portrait', () => {
      screen(390, 844, 3, true)
      expect(useWallpaper().size.value).toEqual({ width: 1170, height: 2532 })
    })

    it('falls back to the default phone size when the screen size is not reported', () => {
      screen(0, 0, 1, false)
      expect(useWallpaper().size.value).toEqual({ width: 1170, height: 2532 })
    })
  })

  it('clamps the size when it is set', () => {
    const w = useWallpaper()
    w.size.value = { width: 99999, height: 99999 }
    expect(w.size.value.width).toBeLessThanOrEqual(4000)
    expect(w.size.value.width * w.size.value.height).toBeLessThanOrEqual(16_000_000)
  })

  it('keeps the chosen photo', async () => {
    const photo = bitmap(3000, 4000)
    loadPhoto.mockResolvedValue(photo)
    const w = useWallpaper()
    await w.setPhoto(file())
    expect(w.photo.value).toBe(photo)
    expect(w.photoError.value).toBeNull()
    expect(w.photoNotice.value).toBeNull()
  })

  it('keeps the previous photo and shows the message when a load fails', async () => {
    const first = bitmap(3000, 4000)
    loadPhoto.mockResolvedValueOnce(first).mockRejectedValueOnce(new Error('Choose an image file.'))
    const w = useWallpaper()
    await w.setPhoto(file())
    await w.setPhoto(file())
    expect(w.photo.value).toBe(first)
    expect(w.photoError.value).toBe('Choose an image file.')
  })

  it('warns when the photo is smaller than the wallpaper', async () => {
    loadPhoto.mockResolvedValue(bitmap(800, 600))
    const w = useWallpaper()
    await w.setPhoto(file())
    expect(w.photoNotice.value).toBe('This photo is smaller than the wallpaper, so it may look soft.')
  })

  it('clears the photo', async () => {
    const photo = bitmap(3000, 4000)
    loadPhoto.mockResolvedValue(photo)
    const w = useWallpaper()
    await w.setPhoto(file())
    w.clearPhoto()
    expect(w.photo.value).toBeNull()
  })

  it('leaves the old bitmap open so an export that already started can still draw it', async () => {
    const first = bitmap(3000, 4000)
    loadPhoto.mockResolvedValueOnce(first).mockResolvedValueOnce(bitmap(3000, 4000))
    const w = useWallpaper()
    await w.setPhoto(file())
    await w.setPhoto(file())
    w.clearPhoto()
    expect(first.close).not.toHaveBeenCalled()
  })
})

describe('useWallpaper pending', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('is true from the change until the debounce has parsed it', () => {
    const w = useWallpaper()
    expect(w.pending.value).toBe(false)
    w.text.value = 'hello'
    expect(w.pending.value).toBe(true)
    vi.advanceTimersByTime(150)
    expect(w.pending.value).toBe(false)
  })
})
