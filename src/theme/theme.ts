export type ThemeMode = 'system' | 'light' | 'dark'
export type ThemePreference = { mode: ThemeMode; black: boolean }
export type ResolvedTheme = { theme: 'light' | 'dark'; black: boolean }

export const THEME_STORAGE_KEY = 'eypi.theme'

export const DEFAULT_PREFERENCE: ThemePreference = { mode: 'system', black: false }

export const PAGE_BACKGROUND = {
  light: '#f5f5f5',
  dark: '#0a0a0a',
  black: '#000000',
} as const

const MODES: readonly ThemeMode[] = ['system', 'light', 'dark']

export function parsePreference(raw: string | null): ThemePreference {
  if (!raw) return { ...DEFAULT_PREFERENCE }
  try {
    const value: unknown = JSON.parse(raw)
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      const { mode, black } = value as Record<string, unknown>
      if (MODES.includes(mode as ThemeMode) && typeof black === 'boolean') {
        return { mode: mode as ThemeMode, black }
      }
    }
  } catch {
    // fall through to the default
  }
  return { ...DEFAULT_PREFERENCE }
}

export function resolveTheme(pref: ThemePreference, systemDark: boolean): ResolvedTheme {
  const theme = pref.mode === 'system' ? (systemDark ? 'dark' : 'light') : pref.mode
  return { theme, black: theme === 'dark' && pref.black }
}

export function pageBackground(resolved: ResolvedTheme): string {
  if (resolved.theme === 'light') return PAGE_BACKGROUND.light
  return resolved.black ? PAGE_BACKGROUND.black : PAGE_BACKGROUND.dark
}
