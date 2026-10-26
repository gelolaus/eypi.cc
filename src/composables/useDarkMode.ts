import { ref, watch, type Ref } from 'vue'

const STORAGE_KEY = 'eypi_dark_mode'

function systemPrefersDark(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false
  return window.matchMedia('(prefers-color-scheme: dark)').matches
}

function readDark(): boolean {
  if (typeof window === 'undefined') return false
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored === 'true') return true
    if (stored === 'false') return false
  } catch {
    // Private mode can throw. Fall through to the system preference.
  }
  return systemPrefersDark()
}

const THEME_COLOR_LIGHT = '#F5F5F5'
const THEME_COLOR_DARK = '#000000'

export function applyColorScheme(isDark: boolean) {
  if (typeof document === 'undefined') return
  const root = document.documentElement
  root.classList.toggle('dark', isDark)
  root.style.colorScheme = isDark ? 'dark' : 'light'
  let meta = document.querySelector('meta[name="theme-color"]')
  if (!meta) {
    meta = document.createElement('meta')
    meta.setAttribute('name', 'theme-color')
    document.head.appendChild(meta)
  }
  meta.setAttribute('content', isDark ? THEME_COLOR_DARK : THEME_COLOR_LIGHT)
}

let isDark: Ref<boolean> | null = null

function ensure(): Ref<boolean> {
  if (isDark) return isDark
  const state = ref(readDark())
  isDark = state
  applyColorScheme(state.value)
  watch(state, (val) => {
    applyColorScheme(val)
    try {
      localStorage.setItem(STORAGE_KEY, String(val))
    } catch {
      // Ignore storage failures. The class is already applied.
    }
  }, { flush: 'sync' })
  return state
}

export function initDarkMode() {
  ensure()
}

export function useDarkMode() {
  const state = ensure()

  function toggle() {
    state.value = !state.value
  }

  return { isDark: state, toggle }
}
