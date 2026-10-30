import type { ThemeName } from './types'

export type Theme = { bg: string; text: string; muted: string; accent: string; blocks: string[] }

const LIGHT_BLOCKS = ['#35438c', '#deac4b', '#7783c4', '#a87a1c', '#9aa0b8']
const DARK_BLOCKS = ['#8b97d8', '#deac4b', '#5a68b8', '#f0d08a', '#9aa0b8']

const DARK: Theme = { bg: '#0a0a0a', text: '#ededed', muted: '#a3a3a3', accent: '#8b97d8', blocks: DARK_BLOCKS }

export const THEMES: Record<ThemeName, Theme> = {
  light: { bg: '#f5f5f5', text: '#0a0a0a', muted: '#5c5c5c', accent: '#35438c', blocks: LIGHT_BLOCKS },
  dark: DARK,
  black: { ...DARK, bg: '#000000' },
  apc: { bg: '#35438c', text: '#ffffff', muted: '#dfe3f5', accent: '#deac4b', blocks: LIGHT_BLOCKS },
}

function luminance(hex: string): number {
  const channel = (i: number) => {
    const c = parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16) / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * channel(0) + 0.7152 * channel(1) + 0.0722 * channel(2)
}

/** WCAG contrast ratio of two `#rrggbb` colours. */
export function contrastRatio(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

/** `#000000` or `#ffffff`, whichever reads better on the colour. */
export function readableOn(color: string): string {
  return contrastRatio('#000000', color) >= contrastRatio('#ffffff', color) ? '#000000' : '#ffffff'
}
