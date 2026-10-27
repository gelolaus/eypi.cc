// @vitest-environment happy-dom
import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it } from 'vitest'
import MarketingHeader from './MarketingHeader.vue'
import { useSession } from '@/stores/session'

const mountHeader = () =>
  mount(MarketingHeader, {
    global: { stubs: { RouterLink: { props: ['to'], template: '<a :href="to"><slot /></a>' } } },
  })

beforeEach(() => useSession().reset())

describe('MarketingHeader', () => {
  it('shows one text link and a Get started call to action when signed out', () => {
    const nav = mountHeader().get('nav[aria-label="Main navigation"]')
    const links = nav.findAll('a')
    expect(links.map((a) => a.text())).toEqual(['Orgs', 'Get started'])
    expect(links[1].attributes('href')).toBe('/login')
  })

  it('shows only Dashboard when signed in', () => {
    useSession().user.value = { id: 'u1', email: 'a@apc.edu.ph', name: 'A', role: 'user' } as never
    const nav = mountHeader().get('nav[aria-label="Main navigation"]')
    expect(nav.findAll('a').map((a) => a.text())).toEqual(['Dashboard'])
  })
})
