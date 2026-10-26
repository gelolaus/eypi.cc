import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const tokens = readFileSync('src/styles/tokens.css', 'utf8')
const mainCss = readFileSync('src/styles/main.css', 'utf8')

const expected: Record<string, string> = {
  background: 'oklch(0.14 0.01 55)',
  foreground: 'oklch(0.96 0.01 75)',
  card: 'oklch(0.18 0.012 55 / 75%)',
  'card-foreground': 'oklch(0.96 0.01 75)',
  popover: 'oklch(0.17 0.012 55)',
  'popover-foreground': 'oklch(0.96 0.01 75)',
  primary: '#e8a87c',
  'primary-foreground': 'oklch(0.18 0.02 55)',
  secondary: 'oklch(0.22 0.012 55)',
  'secondary-foreground': 'oklch(0.96 0.01 75)',
  muted: 'oklch(0.2 0.01 55)',
  'muted-foreground': 'oklch(0.72 0.02 65)',
  accent: 'color-mix(in oklch, #e8a87c 18%, transparent)',
  'accent-foreground': 'oklch(0.9 0.04 65)',
  destructive: 'oklch(0.704 0.191 22.216)',
  border: 'oklch(1 0 0 / 10%)',
  input: 'oklch(1 0 0 / 12%)',
  ring: 'color-mix(in oklch, #e8a87c 55%, transparent)',
  'chart-1': '#e8a87c',
  'chart-2': 'oklch(0.556 0 0)',
  'chart-3': 'oklch(0.439 0 0)',
  'chart-4': 'oklch(0.371 0 0)',
  'chart-5': 'oklch(0.269 0 0)',
  sidebar: 'oklch(0.15 0.01 55)',
  'sidebar-foreground': 'oklch(0.96 0.01 75)',
  'sidebar-primary': '#e8a87c',
  'sidebar-primary-foreground': 'oklch(0.18 0.02 55)',
  'sidebar-accent': 'oklch(0.22 0.012 55)',
  'sidebar-accent-foreground': 'oklch(0.96 0.01 75)',
  'sidebar-border': 'oklch(1 0 0 / 10%)',
  'sidebar-ring': 'color-mix(in oklch, #e8a87c 55%, transparent)',
  radius: '0.875rem',
}

function darkBlock(): string {
  return tokens.match(/\.dark\s*\{([^}]*)\}/)?.[1] ?? ''
}

function token(name: string): string {
  const match = darkBlock().match(new RegExp(`--${name}:\\s*([^;]+);`))
  return match ? match[1].trim() : ''
}

type Rgb = [number, number, number]

function srgbToLinear(c: number): number {
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
}

function oklchToLinearRgb(l: number, c: number, hDeg: number): Rgb {
  const h = (hDeg * Math.PI) / 180
  const a = c * Math.cos(h)
  const b = c * Math.sin(h)
  const l_ = (l + 0.3963377774 * a + 0.2158037573 * b) ** 3
  const m_ = (l - 0.1055613458 * a - 0.0638541728 * b) ** 3
  const s_ = (l - 0.0894841775 * a - 1.291485548 * b) ** 3
  return [
    4.0767416621 * l_ - 3.3077115913 * m_ + 0.2309699292 * s_,
    -1.2684380046 * l_ + 2.6097574011 * m_ - 0.3413193965 * s_,
    -0.0041960863 * l_ - 0.7034186147 * m_ + 1.707614701 * s_,
  ]
}

const clamp = (n: number) => Math.min(1, Math.max(0, n))

function parseColor(value: string): { rgb: Rgb; alpha: number } {
  const hex = value.match(/^#([0-9a-f]{6})$/i)
  if (hex) {
    const n = Number.parseInt(hex[1], 16)
    return {
      rgb: [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => srgbToLinear(v / 255)) as Rgb,
      alpha: 1,
    }
  }
  const ok = value.match(/^oklch\(\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)(?:\s*\/\s*([\d.]+)%)?\s*\)$/)
  if (!ok) throw new Error(`unsupported colour: ${value}`)
  const rgb = oklchToLinearRgb(Number(ok[1]), Number(ok[2]), Number(ok[3])).map(clamp) as Rgb
  return { rgb, alpha: ok[4] === undefined ? 1 : Number(ok[4]) / 100 }
}

function luminanceOf(rgb: Rgb): number {
  return 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2]
}

function oklchToLuminance(value: string): number {
  return luminanceOf(parseColor(value).rgb)
}

/** Linear-light blend of `foreground` (with its alpha, scaled by `extra`) over an opaque `background`. */
function over(foreground: string, background: string, extra = 1): Rgb {
  const f = parseColor(foreground)
  const b = parseColor(background)
  const alpha = f.alpha * extra
  return f.rgb.map((c, i) => c * alpha + b.rgb[i] * (1 - alpha)) as Rgb
}

function ratio(a: number, b: number): number {
  const [hi, lo] = a > b ? [a, b] : [b, a]
  return (hi + 0.05) / (lo + 0.05)
}

describe('wantap design tokens', () => {
  it('defines every wantap token in the dark block', () => {
    for (const [name, value] of Object.entries(expected)) {
      expect(token(name), `--${name}`).toBe(value)
    }
  })

  it('meets WCAG AA for text pairs', () => {
    const bg = token('background')
    const bgLum = oklchToLuminance(bg)
    expect(ratio(oklchToLuminance(token('foreground')), bgLum)).toBeGreaterThanOrEqual(4.5)
    expect(ratio(oklchToLuminance(token('muted-foreground')), bgLum)).toBeGreaterThanOrEqual(4.5)
    expect(
      ratio(oklchToLuminance(token('primary-foreground')), oklchToLuminance(token('primary'))),
    ).toBeGreaterThanOrEqual(4.5)
    const cardOverBg = luminanceOf(over(token('card'), bg))
    expect(ratio(oklchToLuminance(token('card-foreground')), cardOverBg)).toBeGreaterThanOrEqual(4.5)
    // --ring is the primary at 55% over the background.
    const ring = luminanceOf(over(token('primary'), bg, 0.55))
    expect(ratio(ring, bgLum)).toBeGreaterThanOrEqual(3)
  })

  it('disables decorative animation under reduced motion', () => {
    const start = mainCss.indexOf('@media (prefers-reduced-motion: reduce)')
    expect(start).toBeGreaterThan(-1)
    const block = mainCss.slice(start)
    for (const name of ['.float-slow', '.float-slow-2', '.animate-sparkle', '.animate-blink-caret']) {
      expect(block, name).toContain(name)
    }
  })
})
