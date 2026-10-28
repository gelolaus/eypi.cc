// @vitest-environment happy-dom
import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'
import OrgCatalogView from './OrgCatalogView.vue'
import { clearQueryCache } from '@/lib/queryCache'

const stub = { template: '<div />' }
const router = createRouter({
  history: createMemoryHistory(),
  routes: [
    { path: '/', component: stub },
    { path: '/orgs/:slug', component: stub },
  ],
})

function stubOrgs(orgs: { slug: string; name: string; orgType: string | null }[]) {
  vi.stubGlobal('fetch', vi.fn(async () =>
    new Response(JSON.stringify({ orgs: orgs.map(o => ({ ...o, tagline: null, logoUrl: null })) }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }),
  ))
}

beforeEach(() => {
  localStorage.clear()
  clearQueryCache()
})
afterEach(() => vi.unstubAllGlobals())

describe('OrgCatalogView filters', () => {
  it('shows chips only for categories that have an org', async () => {
    stubOrgs([
      { slug: 'jpcs', name: 'JPCS', orgType: 'socit_academic' },
      { slug: 'band', name: 'Band', orgType: 'performing_arts' },
    ])
    const wrapper = mount(OrgCatalogView, { global: { plugins: [router] } })
    await flushPromises()
    const chips = wrapper.findAll('button[aria-pressed]').map(b => b.text())
    expect(chips).toEqual(['All', 'SoCIT Academic Org', 'Performing Arts Group'])
  })

  it('hides the chip row when no org has a category', async () => {
    stubOrgs([{ slug: 'jpcs', name: 'JPCS', orgType: null }])
    const wrapper = mount(OrgCatalogView, { global: { plugins: [router] } })
    await flushPromises()
    expect(wrapper.findAll('button[aria-pressed]')).toHaveLength(0)
    expect(wrapper.text()).toContain('JPCS')
  })
})
