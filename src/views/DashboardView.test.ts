// @vitest-environment happy-dom
import { flushPromises, mount } from '@vue/test-utils'
import { ref } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'
import DashboardView from './DashboardView.vue'
import { useSession } from '@/stores/session'
import type { OrgListItem } from '@/types/orgs'

const activeOrg = ref<OrgListItem | null>(null)
vi.mock('@/composables/useActiveOrg', () => ({
  useActiveOrg: () => ({ orgs: ref([]), activeOrg, fetchOrgs: vi.fn(), selectOrg: vi.fn() }),
}))

const summaries: Record<string, unknown> = {
  '/api/links/summary': { count: 2, clicks: 12, top: { slug: 'bb', clicks: 9 } },
  '/api/orgs/jpcs-apc/summary': { members: 4, events: 3, tickets: 20, frames: 2 },
  '/api/stats': { users: 1, orgs: 1, members: 1, links: 1, clicks: 1, events: 1, tickets: 1, checkIns: 1, frames: 1, frameDownloads: 1 },
}

function stubApi(overrides: Record<string, unknown> = {}, failing: string[] = []) {
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
    const path = new URL(String(input), 'https://eypi.cc').pathname
    if (failing.includes(path)) return new Response('{}', { status: 500 })
    const body = { ...summaries, ...overrides }[path]
    return new Response(JSON.stringify(body ?? {}), { headers: { 'Content-Type': 'application/json' } })
  }))
}

afterEach(() => vi.unstubAllGlobals())

const router = createRouter({
  history: createMemoryHistory(),
  routes: [
    { path: '/', component: DashboardView },
    { path: '/invites', component: { template: '<div />' } },
    { path: '/links', component: { template: '<div />' } },
    { path: '/forms', component: { template: '<div />' } },
    { path: '/manage/tix', component: { template: '<div />' } },
    { path: '/manage/frames', component: { template: '<div />' } },
    { path: '/orgs', component: { template: '<div />' } },
  ],
})

function mountDashboard(count: number) {
  const session = useSession()
  session.user.value = {
    id: 'user-1',
    email: 'ada@apc.edu.ph',
    name: 'Ada',
    role: 'user',
  }
  session.pendingInviteCount.value = count
  return mount(DashboardView, {
    global: { plugins: [router] },
  })
}

beforeEach(async () => {
  activeOrg.value = null
  stubApi()
  useSession().reset()
  await router.push('/')
  await router.isReady()
})

describe('DashboardView invite banner', () => {
  it('links to the inbox when one invite is pending', () => {
    const wrapper = mountDashboard(1)

    expect(wrapper.text()).toContain('You have 1 pending org invite.')
    const link = wrapper.get('a[href="/invites"]')
    expect(link.text()).toBe('Review invites')
  })

  it('pluralizes the banner when several invites are pending', () => {
    const wrapper = mountDashboard(2)

    expect(wrapper.text()).toContain('You have 2 pending org invites.')
    expect(wrapper.get('a[href="/invites"]').text()).toBe('Review invites')
  })

  it('hides the banner when nothing is pending', () => {
    const wrapper = mountDashboard(0)

    expect(wrapper.text()).not.toContain('pending org invite')
    expect(wrapper.find('a[href="/invites"]').exists()).toBe(false)
  })
})

describe('DashboardView module cards', () => {
  it('renders the modules as Card links with consistent tokens', () => {
    const wrapper = mountDashboard(0)
    const cards = wrapper.findAll('a > [data-slot="card"]')
    expect(cards).toHaveLength(5)
    for (const card of cards) {
      expect(card.classes()).toContain('min-h-11')
      expect(card.html()).not.toMatch(/(?<![a-z])g-(?:primary|muted|text|surface)|#DEAC4B|section-card/)
    }
  })
})

describe('DashboardView summaries', () => {
  it('greets the user with one description line', () => {
    const wrapper = mountDashboard(0)
    expect(wrapper.get('h1').text()).toBe('Hi, Ada.')
    expect(wrapper.get('header p').text().length).toBeGreaterThan(0)
  })

  it('shows link count, clicks and the top link', async () => {
    const wrapper = mountDashboard(0)
    await flushPromises()
    const card = wrapper.get('[data-card="links"]')
    expect(card.text()).toContain('2')
    expect(card.text()).toContain('12')
    expect(card.text()).toContain('eypi.cc/bb')
  })

  it('names the next action when the user has no links', async () => {
    stubApi({ '/api/links/summary': { count: 0, clicks: 0, top: null } })
    const wrapper = mountDashboard(0)
    await flushPromises()
    const card = wrapper.get('[data-card="links"]')
    expect(card.text()).toContain('No links yet. Create your first short link.')
    expect(card.text()).not.toContain('NaN')
    expect(card.find('a[href="/links"]').exists()).toBe(true)
  })

  it('shows the org card with CAPS slug and counts when an org is active', async () => {
    activeOrg.value = { org_id: 'jpcs-apc', org_name: 'JPCS APC', owner_id: 'u', is_owner: 0, created_at: '' }
    const wrapper = mountDashboard(0)
    await flushPromises()
    const card = wrapper.get('[data-card="org"]')
    expect(card.text()).toContain('JPCS APC')
    expect(card.text()).toContain('JPCS-APC')
    for (const n of ['4', '3', '20', '2']) expect(card.text()).toContain(n)
  })

  it('hides the org card without an active org', async () => {
    const wrapper = mountDashboard(0)
    await flushPromises()
    expect(wrapper.find('[data-card="org"]').exists()).toBe(false)
  })

  it('still renders the modules when a summary fails', async () => {
    stubApi({}, ['/api/links/summary'])
    const wrapper = mountDashboard(0)
    await flushPromises()
    expect(wrapper.get('[data-card="links"]').text()).toContain('Link totals are unavailable right now.')
    expect(wrapper.findAll('a > [data-slot="card"]')).toHaveLength(5)
  })
})
