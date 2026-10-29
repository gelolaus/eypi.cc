import { describe, expect, it } from 'vitest'
import {
  AVATAR_COLORS,
  AVATAR_ICONS,
  isAvatarColor,
  isAvatarIcon,
  parseAvatar,
} from './avatars'

describe('avatar lists', () => {
  it('has no duplicates and the stated lengths', () => {
    expect(new Set(AVATAR_ICONS).size).toBe(AVATAR_ICONS.length)
    expect(new Set(AVATAR_COLORS).size).toBe(AVATAR_COLORS.length)
    expect(AVATAR_ICONS).toHaveLength(36)
    expect(AVATAR_COLORS).toHaveLength(12)
  })

  it('keeps every icon key kebab-case', () => {
    for (const icon of AVATAR_ICONS) expect(icon).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/)
  })
})

describe('guards', () => {
  it('accepts known icons only', () => {
    expect(isAvatarIcon('cat')).toBe(true)
    for (const bad of ['Cat', '', 5, null]) expect(isAvatarIcon(bad)).toBe(false)
  })

  it('accepts known colours only', () => {
    expect(isAvatarColor('blue')).toBe(true)
    for (const bad of ['Blue', '', 5, null]) expect(isAvatarColor(bad)).toBe(false)
  })
})

describe('parseAvatar', () => {
  it('returns a valid pair', () => {
    expect(parseAvatar({ icon: 'cat', color: 'blue' })).toEqual({ icon: 'cat', color: 'blue' })
  })

  it('returns the reset pair for nulls', () => {
    expect(parseAvatar({ icon: null, color: null })).toEqual({ icon: null, color: null })
  })

  it('returns null for anything invalid', () => {
    const bad: unknown[] = [
      { icon: 'cat' },
      { color: 'blue' },
      { icon: 'cat', color: null },
      { icon: 'nope', color: 'blue' },
      { icon: 5, color: 'blue' },
      { icon: 'cat', color: 'blue', extra: 1 },
      [],
      'x',
      undefined,
      null,
    ]
    for (const input of bad) expect(parseAvatar(input)).toBeNull()
  })
})
