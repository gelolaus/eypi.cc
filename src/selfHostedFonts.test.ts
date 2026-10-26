import { readdirSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

function read(path: string): string {
  return readFileSync(new URL(path, import.meta.url), 'utf8')
}

interface HeaderRule {
  path: string
  headers: Record<string, string>
}

function parseHeaders(text: string): HeaderRule[] {
  const rules: HeaderRule[] = []
  let current: HeaderRule | null = null
  for (const line of text.split(/\r?\n/)) {
    if (!line.trim() || line.trim().startsWith('#')) continue
    if (/^\s/.test(line)) {
      if (!current) throw new Error(`header without a path: ${line}`)
      const separator = line.indexOf(':')
      const name = line.slice(0, separator).trim().toLowerCase()
      current.headers[name] = line.slice(separator + 1).trim()
      continue
    }
    current = { path: line.trim(), headers: {} }
    rules.push(current)
  }
  return rules
}

function matches(pattern: string, pathname: string): boolean {
  const expression = `^${pattern.split('*').map((part) => part.replace(/[.+?^${}()|[\]\\]/g, '\\$&')).join('.*')}$`
  return new RegExp(expression).test(pathname)
}

function headersFor(rules: HeaderRule[], pathname: string): Record<string, string> {
  const headers: Record<string, string> = {}
  for (const rule of rules) {
    if (matches(rule.path, pathname)) Object.assign(headers, rule.headers)
  }
  return headers
}

function directive(csp: string, name: string): string {
  const match = csp.split(';').map((part) => part.trim()).find((part) => part === name || part.startsWith(`${name} `))
  if (!match) return ''
  return match.slice(name.length).trim()
}

describe('asset caching and content security policy', () => {
  const rules = parseHeaders(read('../public/_headers'))

  it('caches hashed assets for a year and leaves html revalidated', () => {
    expect(headersFor(rules, '/assets/index-AbCd1234.js')['cache-control']).toBe(
      'public, max-age=31536000, immutable',
    )
    expect(headersFor(rules, '/assets/plus-jakarta-sans-latin-wght-normal-AbCd1234.woff2')['cache-control']).toBe(
      'public, max-age=31536000, immutable',
    )
    for (const path of ['/', '/index.html', '/links']) {
      expect(headersFor(rules, path)['cache-control']).toBe('no-cache')
    }
  })

  it('keeps the existing document policy and drops remote fonts and inline scripts', () => {
    const csp = headersFor(rules, '/')['content-security-policy']
    expect(directive(csp, 'script-src')).toBe("'self'")
    expect(directive(csp, 'base-uri')).toBe("'self'")
    expect(directive(csp, 'form-action')).toBe("'self'")
    expect(directive(csp, 'object-src')).toBe("'none'")
    expect(directive(csp, 'connect-src')).toBe("'self' https://api.eypi.cc")
    expect(directive(csp, 'img-src')).toBe("'self' data: blob:")
    expect(directive(csp, 'font-src')).toBe("'self'")
    expect(directive(csp, 'default-src')).toBe("'self'")
    expect(directive(csp, 'worker-src')).toBe("'self' blob:")
    expect(directive(csp, 'style-src')).toBe("'self' 'unsafe-inline'")
    expect(directive(csp, 'media-src')).toBe("'self' blob:")
    expect(directive(csp, 'frame-ancestors')).toBe("'none'")
    expect(csp).not.toContain('fonts.googleapis.com')
    expect(csp).not.toContain('fonts.gstatic.com')
    expect(headersFor(rules, '/')['x-frame-options']).toBe('DENY')
    expect(headersFor(rules, '/')['permissions-policy']).toBe('camera=(self), microphone=(), geolocation=()')
  })
})

describe('self-hosted wantap fonts', () => {
  const files = [
    'plus-jakarta-sans-latin-wght-normal.woff2',
    'jetbrains-mono-latin-wght-normal.woff2',
    'syne-latin-wght-normal.woff2',
  ]

  it('preloads the sans and display fonts and does not call Google', () => {
    const html = read('../index.html')
    expect(html).not.toContain('fonts.googleapis.com')
    expect(html).not.toContain('fonts.gstatic.com')
    expect(html).not.toContain('Geist')
    for (const file of [files[0], files[2]]) {
      expect(html).toMatch(new RegExp(
        `<link[^>]*rel="preload"[^>]*href="/src/assets/fonts/${file}"[^>]*as="font"[^>]*type="font/woff2"[^>]*crossorigin`,
      ))
    }
  })

  it('declares swap-displayed faces with local urls only', () => {
    const css = read('./styles/main.css')
    expect(css).not.toContain('Geist')
    const faces = css.match(/@font-face\s*\{[^}]*\}/g) ?? []
    expect(faces).toHaveLength(3)
    const ranges: Record<string, string> = {
      'Plus Jakarta Sans': '200 800',
      'JetBrains Mono': '100 800',
      Syne: '400 800',
    }
    for (const [family, range] of Object.entries(ranges)) {
      const face = faces.find((f) => f.includes(family)) ?? ''
      expect(face, family).toMatch(/font-display:\s*swap;/)
      expect(face, family).toContain(`font-weight: ${range}`)
    }
    for (const face of faces) expect(face).not.toMatch(/url\(['"]?https?:/)
    for (const file of files) expect(css).toContain(`../assets/fonts/${file}`)
  })

  it('ships real woff2 bytes, the attribution file and no Geist files', () => {
    for (const file of files) {
      const bytes = readFileSync(new URL(`./assets/fonts/${file}`, import.meta.url))
      expect(bytes.subarray(0, 4).toString('ascii')).toBe('wOF2')
      expect(bytes.length).toBeGreaterThan(10_000)
    }
    expect(read('./assets/fonts/ATTRIBUTION.txt')).toContain('SIL Open Font License')
    expect(readdirSync(new URL('./assets/fonts/', import.meta.url)).filter((f) => /geist/i.test(f))).toEqual([])
  })
})
