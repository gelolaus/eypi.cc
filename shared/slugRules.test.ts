import { describe, expect, it } from 'vitest'
import { SLUG_RE, generateSlug, normalizeSlugInput, validateSlug } from './slugRules'

describe('slug rules', () => {
  it('lowercases and trims typed slugs', () => {
    expect(normalizeSlugInput('  Ab-C ')).toBe('ab-c')
  })

  it('accepts a single character or 3 to 32 lowercase characters', () => {
    expect(SLUG_RE.test('a')).toBe(true)
    expect(SLUG_RE.test('ab')).toBe(false)
    expect(SLUG_RE.test('abc')).toBe(true)
    expect(SLUG_RE.test('a-b')).toBe(true)
    expect(SLUG_RE.test('a--b')).toBe(true)
    expect(SLUG_RE.test('a'.repeat(32))).toBe(true)
    expect(SLUG_RE.test('a'.repeat(33))).toBe(false)
    expect(SLUG_RE.test('a/b')).toBe(false)
    expect(SLUG_RE.test('-ab')).toBe(false)
    expect(SLUG_RE.test('ab-')).toBe(false)
    expect(SLUG_RE.test('Ab')).toBe(false)
  })

  it('classifies empty, reserved, and usable slugs', () => {
    expect(validateSlug('')).toBe('invalid')
    expect(validateSlug('a/b')).toBe('invalid')
    expect(validateSlug('ab')).toBe('invalid')
    expect(validateSlug('  Links ')).toBe('reserved')
    expect(validateSlug('API')).toBe('reserved')
    expect(validateSlug('Hello')).toBe('ok')
    expect(validateSlug('a')).toBe('ok')
  })

  it('generates 7 character lowercase slugs', () => {
    const slugs = new Set<string>()
    for (let i = 0; i < 20; i++) {
      const slug = generateSlug()
      expect(slug).toMatch(/^[a-z0-9]{7}$/)
      expect(validateSlug(slug)).toBe('ok')
      slugs.add(slug)
    }
    expect(slugs.size).toBeGreaterThan(1)
  })
})
