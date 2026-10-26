import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
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
  ['apc-blue', /apc-blue/],
  ['apc-gold', /apc-gold/],
  ['#34418F', /#34418F/i],
  ['#DEAC4B', /#DEAC4B/i],
  ['Geist', /Geist/],
  ['useDarkMode', /useDarkMode/],
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
    const defined = new Set([...darkBlock().matchAll(/--([a-z0-9-]+):/g)].map((m) => m[1]))
    expect([...named].filter((n) => !defined.has(n))).toEqual([])
    expect([...defined].filter((n) => !named.has(n))).toEqual([])
  })

  it('carries no legacy design vocabulary or em dashes', () => {
    expect(doc).not.toContain(String.fromCharCode(0x2014))
    for (const re of [/mica/i, /Geist/, /#34418F/i, /#DEAC4B/i]) expect(re.test(doc), String(re)).toBe(false)
  })
})
