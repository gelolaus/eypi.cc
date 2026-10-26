import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

function lin(channel: number) {
  const c = channel / 255
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
}

function luminance(hex: string) {
  const r = Number.parseInt(hex.slice(1, 3), 16)
  const g = Number.parseInt(hex.slice(3, 5), 16)
  const b = Number.parseInt(hex.slice(5, 7), 16)
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b)
}

function contrast(foreground: string, background: string) {
  const a = luminance(foreground)
  const b = luminance(background)
  const [hi, lo] = a > b ? [a, b] : [b, a]
  return (hi + 0.05) / (lo + 0.05)
}

function walk(dir: string): string[] {
  const files: string[] = []
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry)
    if (statSync(path).isDirectory()) files.push(...walk(path))
    else if (/\.(vue|css)$/.test(entry)) files.push(path)
  }
  return files
}

function block(source: string, selector: string) {
  const pattern = new RegExp(`${selector}\\s*\\{([^}]*)\\}`)
  return source.match(pattern)?.[1] ?? ''
}

describe('contrast tokens', () => {
  it('uses dark text on gold, a navy focus ring in light mode, and a lighter blue in dark mode', () => {
    const css = readFileSync('src/styles/main.css', 'utf8')
    const root = block(css, ':root')
    const dark = block(css, 'html\\.dark')
    const gold = block(css, '\\.btn-gold')
    const focus = block(css, ':focus-visible')

    expect(root).toMatch(/--color-focus:\s*#34418F/)
    expect(dark).toMatch(/--color-focus:\s*#DEAC4B/)
    expect(dark).toMatch(/--color-primary:\s*#8FA0E8/)
    expect(focus).toMatch(/outline:\s*2px solid var\(--color-focus\)/)
    expect(gold).toMatch(/background-color:\s*#DEAC4B/)
    expect(gold).toMatch(/color:\s*#1a1a2e/)

    expect(contrast('#1a1a2e', '#DEAC4B')).toBeGreaterThanOrEqual(4.5)
    expect(contrast('#34418F', '#F5F5F5')).toBeGreaterThanOrEqual(3)
    expect(contrast('#DEAC4B', '#000000')).toBeGreaterThanOrEqual(3)
    expect(contrast('#8FA0E8', '#000000')).toBeGreaterThanOrEqual(4.5)
    expect(contrast('#8FA0E8', '#161616')).toBeGreaterThanOrEqual(4.5)

    const design = readFileSync('DESIGN_SYSTEM.md', 'utf8')
    expect(design).toContain('#1a1a2e')
    expect(design).toContain('#8FA0E8')
    expect(design).toContain('--color-focus')
  })

  it('does not put white text on a gold control', () => {
    const offenders: string[] = []
    const persistentGold = /(?<![\w-])(?<!hover:)bg-\[#DEAC4B\]|(?<![\w-])(?<!hover:)bg-apc-gold|(?<![\w-])(?<!hover:)bg-g-accent(?!\/)|dark:bg-eypi-gold-dark/
    const lightText = /(?<![:\w-])text-white\b|dark:text-slate-100|dark:hover:text-white/

    for (const file of walk('src')) {
      const text = readFileSync(file, 'utf8')
      const lines = text.split(/\r?\n/)
      lines.forEach((line, index) => {
        const goldHoverText = /dark:hover:bg-g-accent/.test(line) && /dark:hover:text-white/.test(line)
        if ((persistentGold.test(line) && lightText.test(line)) || goldHoverText) {
          offenders.push(`${file}:${index + 1}`)
        }
      })

      const rule = /([^{]+)\{([^{}]*)\}/g
      let match: RegExpExecArray | null
      while ((match = rule.exec(text))) {
        const body = match[2]
        const selector = match[1]
        const goldBg = /background(?:-color)?:\s*(?:var\(--color-accent\)|#DEAC4B)/i.test(body)
          || /@apply[^;{]*\bbg-(?:g-accent|apc-gold|\[#DEAC4B\])\b/.test(body)
        const white = /color:\s*(?:#fff\b|#ffffff\b|white\b)/i.test(body)
          || /@apply[^;{]*\btext-white\b/.test(body)
        const goldControlHover = /color:\s*#fff\b/i.test(body) && /cta|scroll-top-btn|features-carousel__nav/.test(selector)
        if ((goldBg && white) || goldControlHover) {
          offenders.push(`${file}: ${selector.trim().slice(0, 80)}`)
        }
      }
    }

    expect(offenders).toEqual([])
  })
})
