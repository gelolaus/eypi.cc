// @vitest-environment happy-dom
import { flushPromises, mount } from '@vue/test-utils'
import { ref } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'
import { clearQueryCache } from '@/lib/queryCache'
import type { OrgInsights } from '@/lib/queries'
import type { OrgListItem } from '@/types/orgs'

const activeOrg = ref<OrgListItem | null>(null)
const range = ref<7 | 30 | 90>(30)

vi.mock('@/composables/useActiveOrg', () => ({
  useActiveOrg: () => ({ activeOrg, orgs: ref([]), orgsLoaded: ref(true), hasOrg: ref(false) }),
}))

vi.mock('@/composables/useDashboardRange', () => ({
  useDashboardRange: () => ({ range, setRange: vi.fn() }),
}))

const zeroInsights: OrgInsights = {
  profileViews: { total: 0, daily: [{ day: '2026-10-01', n: 0 }, { day: '2026-10-02', n: 0 }] },
  frames: { campaigns: 0, views: 0, downloads: 0 },
  tix: { events: 0, registrations: 0, checkIns: 0 },
  members: { daily: [{ day: '2026-10-01', count: 0 }, { day: '2026-10-02', count: 0 }] },
}

const sample: OrgInsights = {
  profileViews: {
    total: 40,
    daily: [
      { day: '2026-10-01', n: 10 },
      { day: '2026-10-02', n: 30 },
    ],
  },
  frames: { campaigns: 2, views: 8, downloads: 3 },
  tix: { events: 1, registrations: 60, checkIns: 30 },
  members: { daily: [{ day: '2026-10-01', count: 4 }, { day: '2026-10-02', count: 5 }] },
}

function stubInsights(body: OrgInsights | null, status = 200) {
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input)
    if (url.includes('/api/orgs/') && url.includes('/insights')) {
      return new Response(body ? JSON.stringify(body) : '{}', {
        status,
        headers: { 'Content-Type': 'application/json' },
      })
    }
    return new Response('{}', { status: 404 })
  }))
}

const router = createRouter({
  history: createMemoryHistory(),
  routes: [
    { path: '/', component: { template: '<div />' } },
    { path: '/orgs/:slug/insights', component: { template: '<div />' } },
  ],
})

beforeEach(async () => {
  clearQueryCache()
  activeOrg.value = null
  range.value = 30
  stubInsights(sample)
  await router.push('/')
  await router.isReady()
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

async function mountSection() {
  const { default: OrgInsightsSection } = await import('./OrgInsightsSection.vue')
  return mount(OrgInsightsSection, { global: { plugins: [router] } })
}

describe('OrgInsightsSection', () => {
  it('renders nothing when there is no active org', async () => {
    const wrapper = await mountSection()
    await flushPromises()
    expect(wrapper.html()).toBe('<!--v-if-->')
    expect(vi.mocked(fetch).mock.calls.length).toBe(0)
  })

  it('shows org header, tiles, charts and a full-insights link', async () => {
    activeOrg.value = {
      org_id: 'jpcs-apc',
      org_name: 'JPCS APC',
      owner_id: 'u',
      is_owner: 0,
      created_at: '',
    }
    const wrapper = await mountSection()
    await flushPromises()
    expect(wrapper.text()).toContain('JPCS APC')
    expect(wrapper.text()).toContain('JPCS-APC')
    expect(wrapper.text()).toContain('Profile views')
    expect(wrapper.text()).toContain('Registrations')
    expect(wrapper.text()).toContain('Check-ins')
    expect(wrapper.text()).toContain('50% checked in')
    expect(wrapper.text()).toContain('Frames views')
    expect(wrapper.text()).toContain('Frames downloads')
    expect(wrapper.text()).toContain('Members')
    expect(wrapper.text()).toContain('5')
    expect(wrapper.find('[role="img"]').exists()).toBe(true)
    const link = wrapper.get('a[href="/orgs/jpcs-apc/insights"]')
    expect(link.text()).toBe('Full insights')
  })

  it('shows zero tiles with no divide-by-zero when the org is empty', async () => {
    stubInsights(zeroInsights)
    activeOrg.value = {
      org_id: 'jpcs-apc',
      org_name: 'JPCS APC',
      owner_id: 'u',
      is_owner: 0,
      created_at: '',
    }
    const wrapper = await mountSection()
    await flushPromises()
    expect(wrapper.text()).toContain('Profile views')
    expect(wrapper.text()).toContain('0')
    expect(wrapper.text()).not.toContain('checked in')
    expect(wrapper.text()).not.toMatch(/NaN|Infinity/)
  })

  it('shows the panel error with retry on a 403', async () => {
    stubInsights(null, 403)
    activeOrg.value = {
      org_id: 'jpcs-apc',
      org_name: 'JPCS APC',
      owner_id: 'u',
      is_owner: 0,
      created_at: '',
    }
    const wrapper = await mountSection()
    await flushPromises()
    expect(wrapper.get('button').text()).toBe('Retry')
    expect(wrapper.text()).toMatch(/couldn.t load/i)
  })
})