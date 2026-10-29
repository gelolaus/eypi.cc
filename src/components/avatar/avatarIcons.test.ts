import { describe, expect, it } from 'vitest'
import { AVATAR_ICONS } from '@shared/avatars'
import { AVATAR_ICON_COMPONENTS } from './avatarIcons'

describe('AVATAR_ICON_COMPONENTS', () => {
  it('has exactly one entry per avatar icon', () => {
    const keys = Object.keys(AVATAR_ICON_COMPONENTS)
    for (const icon of AVATAR_ICONS) expect(keys).toContain(icon)
    for (const key of keys) expect(AVATAR_ICONS as readonly string[]).toContain(key)
    expect(keys).toHaveLength(AVATAR_ICONS.length)
  })

  it('maps every icon to a defined component', () => {
    for (const icon of AVATAR_ICONS) expect(AVATAR_ICON_COMPONENTS[icon], icon).toBeDefined()
  })
})
