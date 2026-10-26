// @vitest-environment happy-dom
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import CtaSection from './CtaSection.vue'

describe('CtaSection', () => {
  it('has one h2 and a sign-in link', () => {
    const wrapper = mount(CtaSection, {
      global: { stubs: { RouterLink: { props: ['to'], template: '<a :href="to"><slot /></a>' } } },
    })
    expect(wrapper.findAll('h2')).toHaveLength(1)
    expect(wrapper.get('a').attributes('href')).toBe('/login')
  })
})
