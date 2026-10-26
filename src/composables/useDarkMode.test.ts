// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest'

function media(matches: boolean) {
  return {
    matches,
    media: '',
    onchange: null,
    addEventListener() {},
    removeEventListener() {},
    addListener() {},
    removeListener() {},
    dispatchEvent() {
      return false
    },
  }
}

async function loadDarkMode() {
  return import('./useDarkMode')
}

describe('useDarkMode', () => {
  beforeEach(() => {
    vi.resetModules()
    localStorage.clear()
    document.documentElement.classList.remove('dark')
  })

  it('returns the same ref across calls', async () => {
    vi.stubGlobal('matchMedia', () => media(false))
    const { useDarkMode } = await loadDarkMode()
    const first = useDarkMode()
    const second = useDarkMode()
    expect(first.isDark).toBe(second.isDark)
    vi.unstubAllGlobals()
  })

  it('follows prefers-color-scheme dark when nothing is saved', async () => {
    vi.stubGlobal('matchMedia', (query: string) => media(query === '(prefers-color-scheme: dark)'))
    const { useDarkMode } = await loadDarkMode()
    const { isDark } = useDarkMode()
    expect(isDark.value).toBe(true)
    expect(document.documentElement.classList.contains('dark')).toBe(true)
    vi.unstubAllGlobals()
  })

  it('follows a light system preference when nothing is saved', async () => {
    vi.stubGlobal('matchMedia', () => media(false))
    const { useDarkMode } = await loadDarkMode()
    const { isDark } = useDarkMode()
    expect(isDark.value).toBe(false)
    expect(document.documentElement.classList.contains('dark')).toBe(false)
    vi.unstubAllGlobals()
  })

  it('keeps a saved choice over the system preference', async () => {
    localStorage.setItem('eypi_dark_mode', 'false')
    vi.stubGlobal('matchMedia', (query: string) => media(query === '(prefers-color-scheme: dark)'))
    const { useDarkMode } = await loadDarkMode()
    expect(useDarkMode().isDark.value).toBe(false)
    expect(document.documentElement.classList.contains('dark')).toBe(false)
    vi.unstubAllGlobals()
  })
})
