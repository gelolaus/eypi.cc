// @vitest-environment happy-dom
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import BrandLogo from '@/components/brand/BrandLogo.vue'
import Hero from './Hero.vue'
import LiveStats from './LiveStats.vue'

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

  it('does not repeat the brand logo', () => {
    const wrapper = mountHero()
    expect(wrapper.findComponent(BrandLogo).exists()).toBe(false)
    expect(wrapper.findAll('.font-display').filter((el) => el.text() === 'Eypi')).toHaveLength(0)
    expect(wrapper.get('h1').classes()).toContain('mt-0')
  })

  it('hides the decorative float accents from assistive tech', () => {
    const accents = mountHero().findAll('.float-slow')
    expect(accents.length).toBeGreaterThan(0)
    for (const accent of accents) expect(accent.attributes('aria-hidden')).toBe('true')
  })

  it('drops the bouncing scroll cue', () => {
    expect(mountHero().html()).not.toContain('animate-bounce')
    })

  it('lays out two columns from lg with the live stats panel', () => {
    const wrapper = mountHero()
    const grid = wrapper.get('.grid')
    for (const cls of ['max-w-5xl', 'lg:grid-cols-[1.05fr_0.95fr]', 'gap-16', 'lg:gap-12']) {
      expect(grid.classes()).toContain(cls)
    }
    expect(wrapper.get('[data-hero-panel]').findComponent(LiveStats).exists()).toBe(true)
    expect(wrapper.findAll('h1')).toHaveLength(1)
  })

  it('shows no placeholder example hosts', () => {
    expect(mountHero().html()).not.toContain('example.com')
  })
})
