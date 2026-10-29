import { describe, expect, it } from 'vitest'
import { DEFAULT_PREFERENCE, pageBackground, parsePreference, resolveTheme } from './theme'

describe('parsePreference', () => {
  it('returns the default for null and empty', () => {
    expect(parsePreference(null)).toEqual(DEFAULT_PREFERENCE)
    expect(parsePreference('')).toEqual(DEFAULT_PREFERENCE)
  })

  it('parses a valid preference', () => {
    expect(parsePreference('{"mode":"dark","black":true}')).toEqual({ mode: 'dark', black: true })
  })

  it.each(['null', '[]', '42', '{not json', '{"mode":"neon","black":true}', '{"mode":"dark","black":"yes"}'])(
    'returns the default for corrupted value %s',
    (raw) => {
      expect(parsePreference(raw)).toEqual(DEFAULT_PREFERENCE)
    },
  )

  it('returns a fresh copy of the default', () => {
    expect(parsePreference(null)).not.toBe(DEFAULT_PREFERENCE)
  })
})

describe('resolveTheme', () => {
  it('ignores black unless the theme is dark', () => {
    expect(resolveTheme({ mode: 'light', black: true }, true)).toEqual({ theme: 'light', black: false })
  })

  it('resolves explicit and system modes', () => {
    expect(resolveTheme({ mode: 'dark', black: false }, false)).toEqual({ theme: 'dark', black: false })
    expect(resolveTheme({ mode: 'system', black: true }, true)).toEqual({ theme: 'dark', black: true })
    expect(resolveTheme({ mode: 'system', black: false }, false)).toEqual({ theme: 'light', black: false })
  })
})

describe('pageBackground', () => {
  it('maps resolved themes to colors', () => {
    expect(pageBackground({ theme: 'light', black: false })).toBe('#f5f5f5')
    expect(pageBackground({ theme: 'dark', black: false })).toBe('#0a0a0a')
    expect(pageBackground({ theme: 'dark', black: true })).toBe('#000000')
  })
})
