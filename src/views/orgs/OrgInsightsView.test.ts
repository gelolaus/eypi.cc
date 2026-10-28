// @vitest-environment happy-dom
import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'
import OrgInsightsView from './OrgInsightsView.vue'

const payload = {
  profileViews: { total: 120, daily: [{ day: '2026-10-25', n: 50 }, { day: '2026-10-26', n: 70 }] },
  frames: { campaigns: 3, views: 900, downloads: 150 },
  tix: { events: 2, registrations: 64, checkIns: 40 },
  members: { daily: [{ day: '2026-10-25', count: 4 }, { day: '2026-10-26', count: 5 }] },
}

function respond(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

async function mountView() {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/orgs/:slug/insights', component: OrgInsightsView }, { path: '/orgs/:slug', component: { template: '<div />' } }],
  })
  await router.push('/orgs/jpcs/insights')
  await router.isReady()
  return mount(OrgInsightsView, { global: { plugins: [router] } })
}

describe('OrgInsightsView', () => {
  const fetchMock = vi.fn()
  beforeEach(() => {
    fetchMock.mockReset()
    vi.stubGlobal('fetch', fetchMock)
  })
  afterEach(() => vi.unstubAllGlobals())

  it('renders the tiles and a sparkline for views and members', async () => {
    fetchMock.mockResolvedValue(respond(payload))
    const wrapper = await mountView()
    await flushPromises()
    expect(String(fetchMock.mock.calls[0][0])).toContain('/api/orgs/jpcs/insights?days=30')
    const text = wrapper.text()
    for (const expected of ['Profile views', '120', 'Campaigns', '900', '150', 'Events', '64', 'Check-ins', '40', 'Members', '5']) {
      expect(text).toContain(expected)
    }
    expect(wrapper.findAll('svg[role="img"]')).toHaveLength(2)
    expect(wrapper.find('a[href="/orgs/jpcs"]').exists()).toBe(true)
  })

  it('refetches when the range changes', async () => {
    fetchMock.mockImplementation(async () => respond(payload))
    const wrapper = await mountView()
    await flushPromises()
    await wrapper.findAll('button').find((b) => b.text() === 'Last 7 days')!.trigger('click')
    await flushPromises()
    expect(String(fetchMock.mock.calls[fetchMock.mock.calls.length - 1][0])).toContain('days=7')
  })

  it('says access is limited to members on 403', async () => {
    fetchMock.mockResolvedValue(respond({ error: { code: 'forbidden', message: 'Forbidden.' } }, 403))
    const wrapper = await mountView()
    await flushPromises()
    expect(wrapper.find('[role="alert"]').text()).toContain('Only members of this organization')
    expect(wrapper.findAll('button').some((b) => b.text() === 'Try again')).toBe(false)
    expect(wrapper.find('a[href="/orgs/jpcs"]').exists()).toBe(true)
  })

  it('explains what Members and profile views count', async () => {
    fetchMock.mockResolvedValue(respond(payload))
    const wrapper = await mountView()
    await flushPromises()
    const text = wrapper.text()
    expect(text).toContain('Members is the running total of activated members')
    expect(text).toContain('Profile views are recorded only for organizations listed in the public catalog')
  })

  it('shows a retry on other failures', async () => {
    fetchMock.mockResolvedValue(respond({ error: { code: 'internal', message: 'x' } }, 500))
    const wrapper = await mountView()
    await flushPromises()
    expect(wrapper.find('[role="alert"]').text()).toContain('Could not load insights')
    expect(wrapper.findAll('button').some((b) => b.text() === 'Try again')).toBe(true)
  })
})
