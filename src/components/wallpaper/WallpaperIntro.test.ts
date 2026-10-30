// @vitest-environment happy-dom
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { WALLPAPER_INTRO_KEY } from '@/composables/useWallpaperIntro'
import WallpaperIntro from './WallpaperIntro.vue'

let wrapper: VueWrapper | undefined
const dialog = () => document.body.querySelector<HTMLElement>('[data-slot="dialog-content"]')
const video = () => document.body.querySelector<HTMLVideoElement>('video')
const checkbox = () => document.body.querySelector<HTMLInputElement>('input[type="checkbox"]')
const mountIntro = async () => {
  wrapper = mount(WallpaperIntro, { attachTo: document.body })
  await flushPromises()
}

describe('WallpaperIntro', () => {
  beforeEach(() => localStorage.clear())
  afterEach(() => {
    wrapper?.unmount()
    wrapper = undefined
    document.body.innerHTML = ''
  })

  it('opens a dialog that plays the intro video with controls', async () => {
    await mountIntro()
    expect(dialog()).not.toBeNull()
    expect(dialog()!.textContent).toContain('Eypi Wallpaper')
    const v = video()!
    expect(v.getAttribute('src')).toBe('/wallpaper-intro.mp4')
    expect(v.getAttribute('poster')).toBe('/wallpaper-intro-poster.jpg')
    expect(v.hasAttribute('controls')).toBe(true)
    expect(v.hasAttribute('playsinline')).toBe(true)
    expect(v.muted).toBe(true)
    expect(v.getAttribute('preload')).toBe('metadata')
  })

  it('has a close button that dismisses it for this visit only', async () => {
    await mountIntro()
    const close = dialog()!.querySelector<HTMLButtonElement>('[data-slot="dialog-close"]')!
    expect(close.textContent).toContain('Close')
    close.click()
    await flushPromises()
    expect(dialog()).toBeNull()
    expect(localStorage.getItem(WALLPAPER_INTRO_KEY)).toBeNull()
  })

  it('offers a plain-text checkbox that closes it and never shows it again', async () => {
    await mountIntro()
    expect(dialog()!.textContent).toContain('Close this and never show it again')
    checkbox()!.click()
    await flushPromises()
    expect(dialog()).toBeNull()
    expect(localStorage.getItem(WALLPAPER_INTRO_KEY)).toBe('true')
  })

  it('does not open for someone who chose never to see it again', async () => {
    localStorage.setItem(WALLPAPER_INTRO_KEY, 'true')
    await mountIntro()
    expect(dialog()).toBeNull()
    expect(video()).toBeNull()
  })
})
