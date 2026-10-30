import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, it, expect } from 'vitest'
import { isReservedSlug } from './reservedSlugs'

/** One-segment `path: '/<seg>'` literals. Params and nested paths stay out. */
function topLevelRouteSegments(routerSource: string): string[] {
  return [...routerSource.matchAll(/path:\s*'\/([^/'`:]+)'/g)].map((match) => match[1])
}

const PLANNED_RESERVED_SLUGS = [
  'admin',
  'account',
  'api',
  'assets',
  'auth',
  'logout',
  'signup',
  'help',
  'about',
  'qr',
  'static',
  'invites',
  'report',
  'unlock',
  'expired',
  'media',
  'p',
  't',
  'tickets',
] as const

describe('isReservedSlug', () => {
  it('blocks known reserved slugs', () => {
    expect(isReservedSlug('links')).toBe(true)
    expect(isReservedSlug('orgs')).toBe(true)
    expect(isReservedSlug('dp')).toBe(true)
    expect(isReservedSlug('wallpaper')).toBe(true)
  })

  it('reserves the ticket paths /tickets and /t/:token', () => {
    expect(isReservedSlug('tickets')).toBe(true)
    expect(isReservedSlug('t')).toBe(true)
    expect(isReservedSlug('T')).toBe(true)
  })

  it('is case-insensitive', () => {
    expect(isReservedSlug('LINKS')).toBe(true)
    expect(isReservedSlug('Orgs')).toBe(true)
  })

  it('allows slugs that are not reserved', () => {
    expect(isReservedSlug('my-cool-link')).toBe(false)
    expect(isReservedSlug('abc123')).toBe(false)
  })

  it('every top-level route in src/router/index.ts is reserved', () => {
    const source = readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), '../src/router/index.ts'),
      'utf8',
    )
    const segments = topLevelRouteSegments(source)

    expect(segments).toEqual(expect.arrayContaining([
      'login',
      'dashboard',
      'links',
      'forms',
      'orgs',
      'settings',
      'privacy',
      'terms',
      'contact',
    ]))
    expect(isReservedSlug('verify')).toBe(true)
    expect(isReservedSlug('reset-password')).toBe(true)

    for (const segment of segments) {
      expect(isReservedSlug(segment), segment).toBe(true)
    }
    for (const slug of PLANNED_RESERVED_SLUGS) {
      expect(isReservedSlug(slug), slug).toBe(true)
    }
  })
})
