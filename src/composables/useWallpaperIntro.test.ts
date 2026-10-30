// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { WALLPAPER_INTRO_KEY, useWallpaperIntro } from './useWallpaperIntro'

describe('useWallpaperIntro', () => {
  beforeEach(() => localStorage.clear())
  afterEach(() => vi.restoreAllMocks())

  it('opens for a visitor who has not dismissed it', () => {
    expect(useWallpaperIntro().open.value).toBe(true)
  })

  it('stays closed once it was dismissed for good', () => {
    localStorage.setItem(WALLPAPER_INTRO_KEY, 'true')
    expect(useWallpaperIntro().open.value).toBe(false)
  })

  it('closes for this visit only when not told to remember', () => {
    const intro = useWallpaperIntro()
    intro.close(false)
    expect(intro.open.value).toBe(false)
    expect(localStorage.getItem(WALLPAPER_INTRO_KEY)).toBeNull()
    expect(useWallpaperIntro().open.value).toBe(true)
  })

  it('remembers the choice across visits', () => {
    const intro = useWallpaperIntro()
    intro.close(true)
    expect(intro.open.value).toBe(false)
    expect(localStorage.getItem(WALLPAPER_INTRO_KEY)).toBe('true')
    expect(useWallpaperIntro().open.value).toBe(false)
  })

  it('still opens and closes when storage is blocked', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked') })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked') })
    const intro = useWallpaperIntro()
    expect(intro.open.value).toBe(true)
    expect(() => intro.close(true)).not.toThrow()
    expect(intro.open.value).toBe(false)
  })
})
