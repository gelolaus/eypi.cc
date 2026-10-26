// @vitest-environment happy-dom
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import AppSection from './AppSection.vue'

describe('AppSection', () => {
  it('renders a Card-based section with the mobile-first padding', () => {
    const wrapper = mount(AppSection, { slots: { default: 'Inside' } })
    expect(wrapper.find('section').exists()).toBe(true)
    const card = wrapper.get('[data-slot="card"]')
    for (const cls of ['rounded-3xl', 'p-6', 'sm:p-7']) expect(card.classes()).toContain(cls)
    expect(wrapper.text()).toContain('Inside')
    expect(wrapper.find('h2').exists()).toBe(false)
  })

  it('renders an optional font-heading title at h2 by default and labels the section', () => {
    const wrapper = mount(AppSection, { props: { title: 'Details' } })
    const heading = wrapper.get('h2')
    expect(heading.text()).toBe('Details')
    expect(heading.classes()).toContain('font-heading')
    expect(wrapper.get('section').attributes('aria-labelledby')).toBe(heading.attributes('id'))
  })

  it('supports another heading level', () => {
    const wrapper = mount(AppSection, { props: { title: 'Details', level: 3 } })
    expect(wrapper.find('h3').exists()).toBe(true)
    expect(wrapper.find('h2').exists()).toBe(false)
  })
})
