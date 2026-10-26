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

function apply(isDark: boolean) {
  if (typeof document === 'undefined') return
  document.documentElement.classList.toggle('dark', isDark)
}

let isDark: Ref<boolean> | null = null

function ensure(): Ref<boolean> {
  if (isDark) return isDark
  const state = ref(readDark())
  isDark = state
  apply(state.value)
  watch(state, (val) => {
    apply(val)
    try {
      localStorage.setItem(STORAGE_KEY, String(val))
    } catch {
      // Ignore storage failures. The class is already applied.
    }
  })
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
