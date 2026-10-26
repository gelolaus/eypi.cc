// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest'
import { h } from 'vue'
import { mount } from '@vue/test-utils'
import { Avatar, AvatarFallback, AvatarBadge, AvatarGroup, AvatarGroupCount } from './index'

describe('Avatar', () => {
  it('renders size and fallback', () => {
    const w = mount(Avatar, { props: { size: 'lg' } })
    expect(w.attributes('data-slot')).toBe('avatar')
    expect(w.attributes('data-size')).toBe('lg')
    expect(w.classes()).toContain('size-8')
    const w2 = mount(Avatar, {
      slots: { default: () => h(AvatarFallback, null, () => 'AB') },
    })
    expect(w2.text()).toBe('AB')
    expect(w2.find('[data-slot="avatar-fallback"]').exists()).toBe(true)
  })
  it('badge and group parts', () => {
    expect(mount(AvatarBadge).attributes('data-slot')).toBe('avatar-badge')
    expect(mount(AvatarGroup).attributes('data-slot')).toBe('avatar-group')
    expect(mount(AvatarGroupCount).attributes('data-slot')).toBe('avatar-group-count')
  })
})
