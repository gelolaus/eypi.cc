// @vitest-environment happy-dom
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import Hero from './Hero.vue'

const mountHero = () =>
  mount(Hero, {
    global: { stubs: { RouterLink: { props: ['to'], template: '<a :href="to"><slot /></a>' } } },
  })

describe('Hero', () => {
  it('has exactly one h1 and no reveal hide on it', () => {
    const wrapper = mountHero()
    expect(wrapper.findAll('h1')).toHaveLength(1)
    expect(wrapper.get('h1').text()).toContain('The toolkit for')
    expect(wrapper.get('h1').classes()).not.toContain('reveal')
  })

  it('has a primary Get started link to the sign-in route', () => {
    const cta = mountHero().findAll('a').find((a) => a.text() === 'Get started')
    expect(cta).toBeTruthy()
    expect(cta!.attributes('href')).toBe('/login')
    expect(cta!.classes()).toContain('bg-primary')
  })

  it('shows the large brand', () => {
    const wrapper = mountHero()
    const brand = wrapper.get('.font-display')
    expect(brand.text()).toBe('eypi.cc')
    expect(brand.classes()).toContain('text-5xl')
  })

  it('hides the decorative float accents from assistive tech', () => {
    const accents = mountHero().findAll('.float-slow')
    expect(accents.length).toBeGreaterThan(0)
    for (const accent of accents) expect(accent.attributes('aria-hidden')).toBe('true')
  })

  it('drops the bouncing scroll cue', () => {
    expect(mountHero().html()).not.toContain('animate-bounce')
    })

  it('lays out two columns from lg with an aria-hidden preview panel', () => {
    const wrapper = mountHero()
    const grid = wrapper.get('.grid')
    for (const cls of ['max-w-5xl', 'lg:grid-cols-[1.05fr_0.95fr]', 'gap-16', 'lg:gap-12']) {
      expect(grid.classes()).toContain(cls)
    }
    const panel = wrapper.get('[data-hero-panel]')
    expect(panel.attributes('aria-hidden')).toBe('true')
    expect(wrapper.findAll('h1')).toHaveLength(1)
  })
})
