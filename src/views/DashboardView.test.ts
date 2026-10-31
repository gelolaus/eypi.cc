// @vitest-environment happy-dom
import { flushPromises, mount } from '@vue/test-utils'
import { ref } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'
import DashboardView from './DashboardView.vue'
import { clearQueryCache } from '@/lib/queryCache'
import { useDashboardRange } from '@/composables/useDashboardRange'
import { resetGetStartedState } from '@/composables/useGetStarted'
import { useSession } from '@/stores/session'
import type { OrgListItem } from '@/types/orgs'
import { sampleTrends } from '@/components/dashboard/trendsFixture'

const activeOrg = ref<OrgListItem | null>(null)
const orgs = ref<OrgListItem[]>([])

vi.mock('@/composables/useActiveOrg', () => ({
  useActiveOrg: () => ({
    orgs,
    activeOrg,
    orgsLoaded: ref(true),
    hasOrg: ref(false),
    fetchOrgs: vi.fn(),
    selectOrg: vi.fn(),
  }),
}))

const emptyTrends = {
  ...sampleTrends,
  totals: { clicks: 0, uniques: 0, qr: 0, activeLinks: 0, links: 0 },
  timeline: sampleTrends.timeline.map((d) => ({ ...d, clicks: 0, uniques: 0 })),
  top: { links: [], device: [], country: [], referrer: [], app: [] },
  heat: Array.from({ length: 168 }, () => 0),
  previous: undefined,
}

const platformStats = {
  users: 10,
  orgs: 2,
  members: 5,
  links: 20,
  clicks: 100,
  events: 3,
  tickets: 8,
  checkIns: 4,
  frames: 1,
  frameDownloads: 2,
}

const upcoming = {
  tickets: [
    {
      id: 't1',
      status: 'confirmed',
      qrToken: null,
      waitlistPosition: null,
      answers: {},
      event: {
        slug: 'alpha',
        name: 'Alpha Night',
        eventDate: '2026-11-01',
        eventTime: '18:00',
        endTime: null,
        location: 'APC',
        coverUrl: null,
        coverMeta: null,
      },
    },
  ],
}

const orgInsights = {
  profileViews: { total: 4, daily: [{ day: '2026-10-01', n: 4 }] },
  frames: { campaigns: 0, views: 0, downloads: 0 },
  tix: { events: 0, registrations: 0, checkIns: 0 },
  members: { daily: [{ day: '2026-10-01', count: 2 }] },
}

function trendsForRange(range: number) {
  return {
    ...sampleTrends,
    totals: { ...sampleTrends.totals, clicks: range === 7 ? 7 : 30 },
  }
}

function stubApi(opts: {
  failing?: string[]
  trends30?: unknown
  trends7?: unknown
  slow30?: boolean
} = {}) {
  const failing = opts.failing ?? []
  const pending30: { resolve: (v: Response) => void }[] = []
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
    const url = new URL(String(input), 'https://eypi.cc')
    const path = url.pathname
    if (failing.includes(path) || failing.some((f) => String(input).includes(f))) {
      return new Response('{}', { status: 500 })
    }
    if (path === '/api/links/summary/trends') {
      const range = url.searchParams.get('range')
      if (range === '7') {
        return new Response(JSON.stringify(opts.trends7 ?? trendsForRange(7)), {
          headers: { 'Content-Type': 'application/json' },
        })
      }
      if (opts.slow30) {
        return new Promise<Response>((resolve) => {
          pending30.push({
            resolve: (r) => resolve(r),
          })
          // expose for test
          ;(stubApi as unknown as { flush30?: () => void }).flush30 = () => {
            const body = opts.trends30 ?? trendsForRange(30)
            for (const p of pending30.splice(0)) {
              p.resolve(new Response(JSON.stringify(body), {
                headers: { 'Content-Type': 'application/json' },
              }))
            }
          }
        })
      }
      return new Response(JSON.stringify(opts.trends30 ?? trendsForRange(30)), {
        headers: { 'Content-Type': 'application/json' },
      })
    }
    if (path === '/api/tickets/upcoming') {
      return new Response(JSON.stringify(upcoming), { headers: { 'Content-Type': 'application/json' } })
    }
    if (path === '/api/stats') {
      return new Response(JSON.stringify(platformStats), { headers: { 'Content-Type': 'application/json' } })
    }
    if (path.includes('/insights')) {
      return new Response(JSON.stringify(orgInsights), { headers: { 'Content-Type': 'application/json' } })
    }
    return new Response('{}', { headers: { 'Content-Type': 'application/json' } })
  }))
  return stubApi as unknown as { flush30?: () => void }
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  sessionStorage.clear()
})

const router = createRouter({
  history: createMemoryHistory(),
  routes: [
    { path: '/', component: DashboardView },
    { path: '/invites', component: { template: '<div />' } },
    { path: '/links', component: { template: '<div />' } },
    { path: '/tickets', component: { template: '<div />' } },
    { path: '/wallpaper', component: { template: '<div />' } },
    { path: '/orgs', component: { template: '<div />' } },
    { path: '/forms', component: { template: '<div />' } },
    { path: '/manage/tix', component: { template: '<div />' } },
    { path: '/manage/frames', component: { template: '<div />' } },
    { path: '/orgs/modify', component: { template: '<div />' } },
    { path: '/orgs/:slug/insights', component: { template: '<div />' } },
  ],
})

function mountDashboard(count: number) {
  const session = useSession()
  session.user.value = {
    id: 'user-1',
    email: 'ada@apc.edu.ph',
    name: 'Ada',
    role: 'user',
    avatarIcon: null,
    avatarColor: null,
  }
  session.pendingInviteCount.value = count
  return mount(DashboardView, { global: { plugins: [router] } })
}

beforeEach(async () => {
  clearQueryCache()
  activeOrg.value = null
  orgs.value = []
  sessionStorage.clear()
  localStorage.clear()
  resetGetStartedState()
  useDashboardRange().setRange(30)
  // Drop any refetch that lingering mounts triggered when the shared range changed.
  clearQueryCache()
  stubApi()
  useSession().reset()
  await router.push('/')
  await router.isReady()
})

describe('DashboardView invite banner', () => {
  it('links to the inbox when one invite is pending', () => {
    const wrapper = mountDashboard(1)
    expect(wrapper.text()).toContain('You have 1 pending org invite.')
    expect(wrapper.get('a[href="/invites"]').text()).toBe('Review invites')
  })

  it('pluralizes the banner when several invites are pending', () => {
    const wrapper = mountDashboard(2)
    expect(wrapper.text()).toContain('You have 2 pending org invites.')
  })

  it('hides the banner when nothing is pending', () => {
    const wrapper = mountDashboard(0)
    expect(wrapper.text()).not.toContain('pending org invite')
  })
})

describe('DashboardView rams and orgs', () => {
  it('greets the user and shows the Rams section without Orgs for a non-member', async () => {
    const wrapper = mountDashboard(0)
    await flushPromises()
    expect(wrapper.get('h1').text()).toBe('Hi, Ada.')
    expect(wrapper.get('#rams-heading').text()).toBe('Rams')
    expect(wrapper.find('#orgs-heading').exists()).toBe(false)
    expect(wrapper.text()).not.toContain('Your org')
    expect(wrapper.html()).not.toMatch(/LiveClicks|live-clicks/i)
    const calls = vi.mocked(fetch).mock.calls.map((c) => String(c[0]))
    expect(calls.some((u) => u.includes('/insights'))).toBe(false)
  })

  it('shows Orgs for a member and loads org insights', async () => {
    activeOrg.value = {
      org_id: 'jpcs-apc',
      org_name: 'JPCS APC',
      owner_id: 'u',
      is_owner: 0,
      created_at: '',
    }
    const wrapper = mountDashboard(0)
    await flushPromises()
    expect(wrapper.get('#orgs-heading').text()).toBe('Orgs')
    expect(wrapper.text()).toContain('JPCS APC')
    expect(vi.mocked(fetch).mock.calls.some((c) => String(c[0]).includes('/api/orgs/jpcs-apc/insights'))).toBe(true)
  })

  it('keeps the invite banner for pending invites', async () => {
    const wrapper = mountDashboard(2)
    await flushPromises()
    expect(wrapper.text()).toContain('You have 2 pending org invites.')
  })

  it('keeps other panels when one endpoint fails', async () => {
    stubApi({ failing: ['/api/tickets/upcoming'] })
    const wrapper = mountDashboard(0)
    await flushPromises()
    expect(wrapper.get('#rams-heading').text()).toBe('Rams')
    expect(wrapper.text()).toMatch(/Upcoming tickets.*couldn.t load|couldn.t load/i)
    expect(wrapper.text()).toContain('Clicks')
  })

  it('shows welcome empty states and five Rams cards for an empty non-member', async () => {
    stubApi({ trends30: emptyTrends })
    // override upcoming to empty
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(String(input), 'https://eypi.cc')
      if (url.pathname === '/api/links/summary/trends') {
        return new Response(JSON.stringify(emptyTrends), { headers: { 'Content-Type': 'application/json' } })
      }
      if (url.pathname === '/api/tickets/upcoming') {
        return new Response(JSON.stringify({ tickets: [] }), { headers: { 'Content-Type': 'application/json' } })
      }
      if (url.pathname === '/api/stats') {
        return new Response(JSON.stringify(platformStats), { headers: { 'Content-Type': 'application/json' } })
      }
      return new Response('{}', { headers: { 'Content-Type': 'application/json' } })
    }))
    const wrapper = mountDashboard(0)
    await flushPromises()
    expect(wrapper.find('#orgs-heading').exists()).toBe(false)
    expect(wrapper.text()).toMatch(/No links yet|No clicks|No audience|No best hours|No upcoming tickets/)
    const ramsCards = wrapper.find('[aria-labelledby="rams-heading"]').findAll('a > [data-slot="card"]')
    expect(ramsCards.length).toBeGreaterThanOrEqual(5)
  })

  it('switches period to 7 and ignores a late 30-day response', async () => {
    const api = stubApi({ slow30: true, trends7: trendsForRange(7), trends30: trendsForRange(30) })
    const wrapper = mountDashboard(0)
    // still loading 30
    const buttons = wrapper.findAll('[aria-label="Period"] button')
    await buttons[0].trigger('click') // 7 days
    await flushPromises()
    expect(wrapper.get('[aria-label="Period"] button[aria-pressed="true"]').text()).toBe('7 days')
    expect(wrapper.text()).toContain('Clicks7')
    // late 30 lands
    api.flush30?.()
    await flushPromises()
    expect(wrapper.get('[aria-label="Period"] button[aria-pressed="true"]').text()).toBe('7 days')
    expect(wrapper.text()).toContain('Clicks7')
    expect(wrapper.text()).not.toContain('Clicks30')
  })
})

describe('DashboardView get started', () => {
  it('shows the checklist for a new user with no links', async () => {
    stubApi({ trends30: emptyTrends })
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(String(input), 'https://eypi.cc')
      if (url.pathname === '/api/links/summary/trends') {
        return new Response(JSON.stringify(emptyTrends), { headers: { 'Content-Type': 'application/json' } })
      }
      if (url.pathname === '/api/tickets/upcoming') {
        return new Response(JSON.stringify({ tickets: [] }), { headers: { 'Content-Type': 'application/json' } })
      }
      if (url.pathname === '/api/stats') {
        return new Response(JSON.stringify(platformStats), { headers: { 'Content-Type': 'application/json' } })
      }
      return new Response('{}', { headers: { 'Content-Type': 'application/json' } })
    }))
    clearQueryCache()
    const wrapper = mountDashboard(1)
    await flushPromises()
    expect(wrapper.find('[data-get-started]').exists()).toBe(true)
    expect(wrapper.text()).toContain('Get started')
    expect(wrapper.text()).toContain('0 of 3 done')
  })

  it('hides the checklist once dismissed', async () => {
    stubApi({ trends30: emptyTrends })
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(String(input), 'https://eypi.cc')
      if (url.pathname === '/api/links/summary/trends') {
        return new Response(JSON.stringify(emptyTrends), { headers: { 'Content-Type': 'application/json' } })
      }
      if (url.pathname === '/api/tickets/upcoming') {
        return new Response(JSON.stringify({ tickets: [] }), { headers: { 'Content-Type': 'application/json' } })
      }
      if (url.pathname === '/api/stats') {
        return new Response(JSON.stringify(platformStats), { headers: { 'Content-Type': 'application/json' } })
      }
      return new Response('{}', { headers: { 'Content-Type': 'application/json' } })
    }))
    clearQueryCache()
    const wrapper = mountDashboard(1)
    await flushPromises()
    await wrapper.get('[data-get-started] button').trigger('click')
    expect(wrapper.find('[data-get-started]').exists()).toBe(false)
    expect(localStorage.getItem('eypi.getStartedDismissed')).toBe('1')
  })
})
