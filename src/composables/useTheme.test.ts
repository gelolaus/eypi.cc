// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

type Listener = () => void

function installMatchMedia(initialDark = false) {
  const listeners = new Set<Listener>()
  const list = {
    matches: initialDark,
    addEventListener: vi.fn((_type: string, fn: Listener) => listeners.add(fn)),
    removeEventListener: vi.fn((_type: string, fn: Listener) => listeners.delete(fn)),
  }
  const matchMedia = vi.fn(() => list)
  vi.stubGlobal('matchMedia', matchMedia)
  return {
    list,
    matchMedia,
    setSystemDark(dark: boolean) {
      list.matches = dark
      listeners.forEach((fn) => fn())
    },
  }
}

async function load() {
  vi.resetModules()
  return import('./useTheme')
}

const root = () => document.documentElement
const color = () => document.querySelector('meta[name="theme-color"]')!.getAttribute('content')

beforeEach(() => {
  localStorage.clear()
  root().className = ''
  document.head.innerHTML = '<meta name="theme-color" content="#f5f5f5">'
  installMatchMedia(false)
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('useTheme', () => {
  it('defaults to system mode with black off when storage is empty', async () => {
    const { initTheme, useTheme } = await load()
    initTheme()
    const { preference } = useTheme()
    expect(preference.value).toEqual({ mode: 'system', black: false })
    expect(root().classList.contains('dark')).toBe(false)
  })

  it('setMode dark applies the class, saves the preference and sets the theme colour', async () => {
    const { initTheme, useTheme } = await load()
    initTheme()
    useTheme().setMode('dark')
    expect(root().classList.contains('dark')).toBe(true)
    expect(localStorage.getItem('eypi.theme')).toBe('{"mode":"dark","black":false}')
    expect(color()).toBe('#0a0a0a')
  })

  it('setBlack under dark adds black and uses the black colour', async () => {
    const { initTheme, useTheme } = await load()
    initTheme()
    const t = useTheme()
    t.setMode('dark')
    t.setBlack(true)
    expect(root().classList.contains('black')).toBe(true)
    expect(color()).toBe('#000000')
  })

  it('black needs dark: light removes both classes and dark restores black', async () => {
    const { initTheme, useTheme } = await load()
    initTheme()
    const t = useTheme()
    t.setMode('dark')
    t.setBlack(true)
    t.setMode('light')
    expect(root().classList.contains('dark')).toBe(false)
    expect(root().classList.contains('black')).toBe(false)
    expect(color()).toBe('#f5f5f5')
    t.setMode('dark')
    expect(root().classList.contains('dark')).toBe(true)
    expect(root().classList.contains('black')).toBe(true)
  })

  it('follows the system scheme live in system mode only', async () => {
    const mm = installMatchMedia(false)
    const { initTheme, useTheme } = await load()
    initTheme()
    const t = useTheme()
    mm.setSystemDark(true)
    expect(root().classList.contains('dark')).toBe(true)
    expect(t.isDark.value).toBe(true)
    mm.setSystemDark(false)
    expect(root().classList.contains('dark')).toBe(false)

    t.setMode('light')
    mm.setSystemDark(true)
    expect(root().classList.contains('dark')).toBe(false)

    t.setMode('dark')
    mm.setSystemDark(false)
    expect(root().classList.contains('dark')).toBe(true)
  })

  it('still applies the theme when storage is blocked', async () => {
    const { initTheme, useTheme } = await load()
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    expect(() => initTheme()).not.toThrow()
    expect(() => useTheme().setMode('dark')).not.toThrow()
    expect(root().classList.contains('dark')).toBe(true)
  })

  it('initTheme applies a saved preference', async () => {
    localStorage.setItem('eypi.theme', '{"mode":"dark","black":true}')
    const { initTheme } = await load()
    initTheme()
    expect(root().classList.contains('dark')).toBe(true)
    expect(root().classList.contains('black')).toBe(true)
    expect(color()).toBe('#000000')
  })

  it('initTheme applies the default for a corrupted value', async () => {
    localStorage.setItem('eypi.theme', '{nope')
    const { initTheme, useTheme } = await load()
    initTheme()
    expect(useTheme().preference.value).toEqual({ mode: 'system', black: false })
    expect(root().classList.contains('dark')).toBe(false)
  })

  it('initTheme subscribes to the system scheme only once', async () => {
    const mm = installMatchMedia(false)
    const { initTheme } = await load()
    initTheme()
    initTheme()
    expect(mm.list.addEventListener).toHaveBeenCalledTimes(1)
    expect(mm.list.addEventListener).toHaveBeenCalledWith('change', expect.any(Function))
  })

  it('works without matchMedia', async () => {
    vi.stubGlobal('matchMedia', undefined)
    const { initTheme, useTheme } = await load()
    expect(() => initTheme()).not.toThrow()
    useTheme().setMode('dark')
    expect(root().classList.contains('dark')).toBe(true)
  })
})
