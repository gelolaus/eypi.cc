import { computed, readonly, ref } from 'vue'
import {
  THEME_STORAGE_KEY,
  parsePreference,
  resolveTheme,
  pageBackground,
  type ThemeMode,
  type ThemePreference,
} from '@/theme/theme'

const SCHEME_QUERY = '(prefers-color-scheme: dark)'

// Module-level state: every caller of useTheme() shares it.
const preference = ref<ThemePreference>(parsePreference(null))
const systemDark = ref(false)
const resolved = computed(() => resolveTheme(preference.value, systemDark.value))
const isDark = computed(() => resolved.value.theme === 'dark')
let subscribed = false

function readStored(): string | null {
  try {
    return localStorage.getItem(THEME_STORAGE_KEY)
  } catch {
    return null
  }
}

function save() {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, JSON.stringify(preference.value))
  } catch {
    // The theme still applies for this visit when storage is unavailable.
  }
}

// Mirrors public/theme-init.js: classes on <html> and the theme-color meta.
function apply() {
  const { theme, black } = resolved.value
  const root = document.documentElement
  root.classList.toggle('dark', theme === 'dark')
  root.classList.toggle('black', black)
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute('content', pageBackground(resolved.value))
}

function mediaList(): MediaQueryList | null {
  try {
    return typeof matchMedia === 'function' ? matchMedia(SCHEME_QUERY) : null
  } catch {
    return null
  }
}

/** Loads the saved preference, applies it, and follows the system colour scheme. Safe to call twice. */
export function initTheme(): void {
  preference.value = parsePreference(readStored())
  const list = mediaList()
  systemDark.value = !!list?.matches
  apply()
  if (list && !subscribed) {
    subscribed = true
    list.addEventListener('change', () => {
      systemDark.value = list.matches
      apply()
    })
  }
}

function update(next: ThemePreference) {
  preference.value = next
  apply()
  save()
}

export function useTheme() {
  return {
    preference: readonly(preference),
    resolved,
    isDark,
    setMode(mode: ThemeMode) {
      update({ ...preference.value, mode })
    },
    setBlack(on: boolean) {
      update({ ...preference.value, black: on })
    },
  }
}
