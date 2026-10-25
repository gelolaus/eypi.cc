import { readFileSync } from 'node:fs'
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
    expect(headersFor(rules, '/assets/Geist-Variable-AbCd1234.woff2')['cache-control']).toBe(
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

describe('self-hosted Geist fonts', () => {
  it('preloads the two variable fonts and does not call Google', () => {
    const html = read('../index.html')
    expect(html).not.toContain('fonts.googleapis.com')
    expect(html).not.toContain('fonts.gstatic.com')
    for (const file of ['Geist-Variable.woff2', 'GeistMono-Variable.woff2']) {
      expect(html).toContain(`href="/src/assets/fonts/${file}"`)
      expect(html).toMatch(new RegExp(
        `<link[^>]*rel="preload"[^>]*href="/src/assets/fonts/${file}"[^>]*as="font"[^>]*type="font/woff2"[^>]*crossorigin`,
      ))
    }
  })

  it('declares swap-displayed faces for Geist and Geist Mono', () => {
    const css = read('./styles/main.css')
    expect(css).toMatch(
      /@font-face\s*\{[^}]*font-family:\s*'Geist';[^}]*url\('\.\.\/assets\/fonts\/Geist-Variable\.woff2'\)\s*format\('woff2'\);[^}]*font-weight:\s*100 900;[^}]*font-display:\s*swap;/,
    )
    expect(css).toMatch(
      /@font-face\s*\{[^}]*font-family:\s*'Geist Mono';[^}]*url\('\.\.\/assets\/fonts\/GeistMono-Variable\.woff2'\)\s*format\('woff2'\);[^}]*font-weight:\s*100 900;[^}]*font-display:\s*swap;/,
    )
  })

  it('ships the real variable font bytes and the OFL text', () => {
    for (const file of ['Geist-Variable.woff2', 'GeistMono-Variable.woff2']) {
      const bytes = readFileSync(new URL(`./assets/fonts/${file}`, import.meta.url))
      expect(bytes.subarray(0, 4).toString('ascii')).toBe('wOF2')
      expect(bytes.length).toBeGreaterThan(10_000)
    }
    const license = read('./assets/fonts/OFL.txt')
    expect(license).toContain('Copyright (c) 2023 Vercel, in collaboration with basement.studio')
    expect(license).toContain('SIL Open Font License, Version 1.1')
  })
})
