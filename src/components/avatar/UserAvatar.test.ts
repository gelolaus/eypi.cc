// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import UserAvatar from './UserAvatar.vue'

function render(props: Record<string, unknown>) {
  return mount(UserAvatar, { props: { name: 'Ada Lovelace', ...props } })
}

describe('UserAvatar', () => {
  it('renders the icon in the chosen colour with no initials', () => {
    const wrapper = render({ icon: 'cat', color: 'blue' })
    expect(wrapper.find('svg').exists()).toBe(true)
    expect(wrapper.html()).toContain('--avatar-blue')
    expect(wrapper.text()).toBe('')
    expect(wrapper.attributes('aria-label')).toBeUndefined()
    expect(wrapper.find('svg').attributes('aria-hidden')).toBe('true')
  })

  it('merges caller classes and defaults to size-8', () => {
    expect(render({ icon: 'cat', color: 'blue' }).classes()).toContain('size-8')
    expect(render({ icon: 'cat', color: 'blue', class: 'size-12' }).classes()).toContain('size-12')
  })

  it.each([
    ['no icon or colour', {}],
    ['null icon and colour', { icon: null, color: null }],
    ['null icon', { icon: null, color: 'blue' }],
    ['null colour', { icon: 'cat', color: null }],
    ['unknown icon', { icon: 'nope', color: 'blue' }],
    ['unknown colour', { icon: 'cat', color: 'nope' }],
  ])('falls back to initials with %s', (_label, props) => {
    const wrapper = render(props)
    expect(wrapper.text()).toBe('AD')
    expect(wrapper.find('svg').exists()).toBe(false)
  })

  it('uses one letter for a one-letter name and ? for an empty name', () => {
    expect(render({ name: 'x' }).text()).toBe('X')
    expect(render({ name: '' }).text()).toBe('?')
  })

  it('does not throw for a name that starts with an emoji', () => {
    expect(() => render({ name: '\u{1F600} Smile' })).not.toThrow()
  })

  it('keeps a whole emoji and never splits a surrogate pair', () => {
    const text = render({ name: 'A\u{1F600}' }).text()
    expect(text).toBe(Array.from('A\u{1F600}').join('').toUpperCase())
    for (let i = 0; i < text.length; i++) {
      const code = text.charCodeAt(i)
      if (code >= 0xd800 && code <= 0xdbff) {
        const next = text.charCodeAt(i + 1)
        expect(next >= 0xdc00 && next <= 0xdfff, 'lone high surrogate').toBe(true)
        i++
      } else {
        expect(code >= 0xdc00 && code <= 0xdfff, 'lone low surrogate').toBe(false)
      }
    }
  })

  it('shows ? for a whitespace-only name', () => {
    expect(render({ name: '   ' }).text()).toBe('?')
  })
})
