import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const tokens = readFileSync('src/styles/tokens.css', 'utf8')
const mainCss = readFileSync('src/styles/main.css', 'utf8')

const expected: Record<string, string> = {
  background: '#f5f5f5',
  foreground: '#0a0a0a',
  card: '#ffffff',
  'card-foreground': '#0a0a0a',
  popover: '#ffffff',
  'popover-foreground': '#0a0a0a',
  primary: '#35438c',
  'primary-foreground': '#ffffff',
  secondary: '#ebebeb',
  'secondary-foreground': '#0a0a0a',
  muted: '#ebebeb',
  'muted-foreground': '#5c5c5c',
  accent: 'color-mix(in srgb, #deac4b 25%, transparent)',
  'accent-foreground': '#0a0a0a',
  destructive: '#c62828',
  border: '#e2e2e2',
  input: '#8c8c8c',
  ring: '#35438c',
  'chart-1': '#35438c',
  'chart-2': '#deac4b',
  'chart-3': '#7783c4',
  'chart-4': '#a87a1c',
  'chart-5': '#9aa0b8',
  sidebar: '#ffffff',
  'sidebar-foreground': '#0a0a0a',
  'sidebar-primary': '#35438c',
  'sidebar-primary-foreground': '#ffffff',
  'sidebar-accent': '#ebebf2',
  'sidebar-accent-foreground': '#0a0a0a',
  'sidebar-border': '#e2e2e2',
  'sidebar-ring': '#35438c',
  radius: '0.875rem',
}

function paletteBlock(): string {
  return tokens.match(/:root\s*\{([^}]*)\}/)?.[1] ?? ''
}

function token(name: string): string {
  const match = paletteBlock().match(new RegExp(`--${name}:\\s*([^;]+);`))
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
  it('defines every token in the :root palette', () => {
    for (const [name, value] of Object.entries(expected)) {
      expect(token(name), `--${name}`).toBe(value)
    }
  })

  it('meets WCAG AA for text pairs', () => {
    const bg = token('background')
    const bgLum = oklchToLuminance(bg)
    const lum = (name: string) => oklchToLuminance(token(name))
    expect(ratio(lum('foreground'), bgLum)).toBeGreaterThanOrEqual(4.5)
    expect(ratio(lum('muted-foreground'), bgLum)).toBeGreaterThanOrEqual(4.5)
    expect(ratio(lum('muted-foreground'), lum('muted'))).toBeGreaterThanOrEqual(4.5)
    expect(ratio(lum('primary-foreground'), lum('primary'))).toBeGreaterThanOrEqual(4.5)
    // Links and active nav use --primary as text on the page and on cards.
    expect(ratio(lum('primary'), bgLum)).toBeGreaterThanOrEqual(4.5)
    expect(ratio(lum('primary'), lum('card'))).toBeGreaterThanOrEqual(4.5)
    // Error text sits on the page and on cards.
    expect(ratio(lum('destructive'), bgLum)).toBeGreaterThanOrEqual(4.5)
    expect(ratio(lum('destructive'), lum('card'))).toBeGreaterThanOrEqual(4.5)
    expect(ratio(lum('card-foreground'), lum('card'))).toBeGreaterThanOrEqual(4.5)
    // Text on the gold wash (menu hover) and on the sidebar hover fill.
    const goldWash = luminanceOf(over('#deac4b', bg, 0.25))
    expect(ratio(lum('accent-foreground'), goldWash)).toBeGreaterThanOrEqual(4.5)
    expect(ratio(lum('sidebar-accent-foreground'), lum('sidebar-accent'))).toBeGreaterThanOrEqual(4.5)
  })

  it('meets 3:1 for control boundaries and the focus ring', () => {
    const bgLum = oklchToLuminance(token('background'))
    // Focused controls switch their border to the solid --ring (the halo is ring/50 on top of it).
    expect(ratio(oklchToLuminance(token('ring')), bgLum)).toBeGreaterThanOrEqual(3)
    expect(ratio(oklchToLuminance(token('ring')), oklchToLuminance(token('card')))).toBeGreaterThanOrEqual(3)
    // Input borders must be visible on a white card and on the page.
    expect(ratio(oklchToLuminance(token('input')), oklchToLuminance(token('card')))).toBeGreaterThanOrEqual(3)
    expect(ratio(oklchToLuminance(token('input')), bgLum)).toBeGreaterThanOrEqual(3)
  })

  it('is light only', () => {
    expect(mainCss).toMatch(/color-scheme:\s*light/)
    expect(mainCss).not.toContain('@custom-variant dark')
    expect(tokens).not.toMatch(/\.dark\s*\{/)
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

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) walk(full, out)
    else out.push(full.split(String.fromCharCode(92)).join('/'))
  }
  return out
}

// Test files assert the absence of legacy tokens, so they name them on purpose.
const GUARD_FILES = new Set(['src/styles/design.test.ts'])

function sources(exts: string[], root = 'src'): string[] {
  return walk(root).filter(
    (f) =>
      exts.some((e) => f.endsWith(e)) &&
      !GUARD_FILES.has(f) &&
      !f.endsWith('.test.ts') &&
      !f.startsWith('src/assets/'),
  )
}

const LEGACY: Array<[string, RegExp]> = [
  ['mica', /(?<![a-z0-9])mica(?![a-z0-9])/i],
  ['pill-nav', /pill-nav/],
  ['g-* colour utilities', /(?<![a-z0-9])g-(bg|surface|border|text|muted|accent|primary)(?![a-z0-9-])/],
  ['eypi-gold', /eypi-gold/],
  ['#34418F', /#34418F/i],
  ['Geist', /Geist/],
  ['useDarkMode', /useDarkMode/],
  ['dark: variant', /(?<![a-z0-9-])dark:[a-z\[]/],
  ['dark class', /class="dark"|classList\.add\('dark'\)|theme="dark"/],
  ['tap-scale', /tap-scale/],
  ['data-cursor', /data-cursor/],
  ['legacy-dot-grid', /legacy-dot-grid/],
]

describe('legacy design cleanup', () => {
  it('matches legacy colour utilities but not wantap tokens', () => {
    const g = LEGACY[2][1]
    for (const ok of ['bg-g-bg', 'text-g-muted', 'border-g-border', 'class="g-text"', ' g-accent ']) {
      expect(g.test(ok), ok).toBe(true)
    }
    for (const no of ['bg-primary', 'text-primary', 'bg-muted-foreground', 'ring-border', 'text-muted-foreground']) {
      expect(g.test(no), no).toBe(false)
    }
  })

  it('uses no legacy design tokens', () => {
    const files = [...sources(['.vue', '.ts', '.css']), 'index.html']
    const offenders: string[] = []
    for (const file of files) {
      const text = readFileSync(file, 'utf8')
      for (const [name, re] of LEGACY) if (re.test(text)) offenders.push(`${file}: ${name}`)
    }
    expect(offenders).toEqual([])
  })

  it('keeps the brand hex values inside tokens.css', () => {
    const files = [...sources(['.vue', '.ts', '.css']), 'index.html', 'public/manifest.webmanifest']
    const offenders = files.filter(
      (f) => f !== 'src/styles/tokens.css' && /#35438c|#deac4b/i.test(readFileSync(f, 'utf8')),
    )
    expect(offenders).toEqual([])
  })

  it('has no hard-coded hex colours in components except the QR designer defaults', () => {
    // Allowances (file -> why). Everything else must use wantap tokens.
    const allowed: Record<string, string> = {
      // Microsoft brand logo fills are fixed by the brand guidelines.
      'src/views/LoginView.vue': 'Microsoft logo SVG fills',
      // Scanner viewfinder mask is a black scrim over the camera feed, not a themed colour.
      'src/components/tix/ScannerPanel.vue': 'camera viewfinder scrim rgba(0,0,0,.45)',
    }
    const colour = /#[0-9a-f]{3,8}\b|rgba?\(/gi
    const files = [...sources(['.vue'], 'src/components'), ...sources(['.vue'], 'src/views')]
    const offenders: string[] = []
    for (const file of files) {
      if (allowed[file]) continue
      const hits = readFileSync(file, 'utf8').match(colour)
      if (hits) offenders.push(`${file}: ${[...new Set(hits)].join(' ')}`)
    }
    expect(offenders).toEqual([])
  })
})

describe('DESIGN_SYSTEM.md', () => {
  const doc = readFileSync('DESIGN_SYSTEM.md', 'utf8')

  it('names only tokens that exist in tokens.css, and names every one', () => {
    const named = new Set([...doc.matchAll(/`--([a-z0-9-]+)`/g)].map((m) => m[1]))
    const defined = new Set([...paletteBlock().matchAll(/--([a-z0-9-]+):/g)].map((m) => m[1]))
    expect([...named].filter((n) => !defined.has(n))).toEqual([])
    expect([...defined].filter((n) => !named.has(n))).toEqual([])
  })

  it('carries no legacy design vocabulary or em dashes', () => {
    expect(doc).not.toContain(String.fromCharCode(0x2014))
    for (const re of [/mica/i, /Geist/, /#34418F/i]) expect(re.test(doc), String(re)).toBe(false)
  })
})
