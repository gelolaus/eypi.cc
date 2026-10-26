// @vitest-environment happy-dom
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import HeroSection from './HeroSection.vue'

const mountHero = () =>
  mount(HeroSection, {
    global: {
      stubs: {
        RouterLink: { template: '<a><slot /></a>' },
      },
    },
  })

describe('HeroSection', () => {
  it('shows the heading without the reveal hide', () => {
    const wrapper = mountHero()

    const heading = wrapper.get('h1')
    expect(heading.text()).toContain('The toolkit for')
    expect(heading.classes()).not.toContain('reveal')
  })

  it('is one headline, one support line and one primary CTA', () => {
    const wrapper = mountHero()

    expect(wrapper.findAll('h1')).toHaveLength(1)
    const cta = wrapper.findAll('a').find((a) => a.text() === 'Get started')
    expect(cta).toBeTruthy()
    expect(cta!.classes().some((c) => c === 'h-12' || c === 'h-14')).toBe(true)
  })

  it('drops the bouncing scroll cue and per-badge blur', () => {
    const wrapper = mountHero()

    expect(wrapper.html()).not.toContain('animate-bounce')
    expect(wrapper.html()).not.toContain('Scroll to features')
    expect(wrapper.find('.mica-card').exists()).toBe(false)
  })
})
