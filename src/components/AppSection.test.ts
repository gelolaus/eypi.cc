// @vitest-environment happy-dom
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import AppSection from './AppSection.vue'

describe('AppSection', () => {
  it('renders a rounded bordered card with the mobile-first padding', () => {
    const wrapper = mount(AppSection, { slots: { default: 'Inside' } })
    const root = wrapper.get('section')
    for (const cls of ['rounded-3xl', 'border', 'p-6', 'sm:p-7']) {
      expect(root.classes()).toContain(cls)
    }
    expect(wrapper.text()).toContain('Inside')
    expect(wrapper.find('h2').exists()).toBe(false)
  })

  it('renders an optional heading at h2 by default and labels the section', () => {
    const wrapper = mount(AppSection, { props: { title: 'Details' } })
    const heading = wrapper.get('h2')
    expect(heading.text()).toBe('Details')
    expect(wrapper.get('section').attributes('aria-labelledby')).toBe(heading.attributes('id'))
  })

  it('supports another heading level', () => {
    const wrapper = mount(AppSection, { props: { title: 'Details', level: 3 } })
    expect(wrapper.find('h3').exists()).toBe(true)
    expect(wrapper.find('h2').exists()).toBe(false)
  })
})
