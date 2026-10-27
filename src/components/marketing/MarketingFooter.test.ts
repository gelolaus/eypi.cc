// @vitest-environment happy-dom
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import MarketingFooter from './MarketingFooter.vue'

const mountFooter = () =>
  mount(MarketingFooter, {
    global: { stubs: { RouterLink: { props: ['to'], template: '<a :href="to"><slot /></a>' } } },
  })

describe('MarketingFooter', () => {
  it('is not a keyboard-nav section target', () => {
    expect(mountFooter().attributes()).not.toHaveProperty('data-section')
  })

  it('keeps every footer link', () => {
    const links = mountFooter().findAll('nav[aria-label="Footer navigation"] a')
    const byText = Object.fromEntries(links.map((a) => [a.text().trim(), a.attributes('href')]))
    expect(byText).toMatchObject({
      Contact: '/contact',
      Privacy: '/privacy',
      Terms: '/terms',
      'Acceptable use': '/acceptable-use',
      'Creator: gelolaus.com': 'https://gelolaus.com',
    })
  })

  it('is a slim bar with the copyright beside the links', () => {
    const footer = mountFooter()
    expect(footer.find('h2').exists()).toBe(false)
    expect(footer.text()).toContain('Eypi')
    expect(footer.find('[data-footer-arrow]').exists()).toBe(false)
  })

  it('keeps every link at least 44px tall', () => {
    const rows = mountFooter().findAll('nav a')
    expect(rows.length).toBeGreaterThan(0)
    for (const row of rows) expect(row.classes()).toContain('min-h-11')
  })

  it('opens the creator link safely', () => {
    const creator = mountFooter().findAll('a').find((a) => a.text().includes('gelolaus.com'))!
    expect(creator.attributes('target')).toBe('_blank')
    expect(creator.attributes('rel')).toBe('noopener noreferrer')
  })
})
