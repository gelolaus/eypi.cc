// @vitest-environment happy-dom
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import HeroSection from './HeroSection.vue'

describe('HeroSection', () => {
  it('shows the heading without the reveal hide', () => {
    const wrapper = mount(HeroSection, {
      global: {
        stubs: {
          RouterLink: { template: '<a><slot /></a>' },
        },
      },
    })

    const heading = wrapper.get('h1')
    expect(heading.text()).toContain('The toolkit for')
    expect(heading.classes()).not.toContain('reveal')
  })
})
