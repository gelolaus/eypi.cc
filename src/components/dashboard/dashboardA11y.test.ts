// @vitest-environment happy-dom
import { flushPromises, mount } from '@vue/test-utils'
import { createApp, nextTick } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import AppShell from '@/components/layout/AppShell.vue'
import DashboardView from '@/views/DashboardView.vue'
import { useActiveOrg } from '@/composables/useActiveOrg'
import { useDashboardRange } from '@/composables/useDashboardRange'
import { clearQueryCache } from '@/lib/queryCache'
import { useSession } from '@/stores/session'
import type { OrgListItem } from '@/types/orgs'
import { sampleTrends } from '@/components/dashboard/trendsFixture'

const stub = { template: '<div />' }
const router = createRouter({
  history: createMemoryHistory(),
  routes: [
    { path: '/', component: stub },
    { path: '/dashboard', component: stub, meta: { requiresAuth: true } },
    { path: '/links', component: stub, meta: { requiresAuth: true } },
    { path: '/tickets', component: stub, meta: { requiresAuth: true } },
    { path: '/wallpaper', component: stub, meta: { requiresAuth: true } },
    { path: '/invites', component: stub, meta: { requiresAuth: true } },
    { path: '/orgs', component: stub },
    { path: '/orgs/modify', component: stub, meta: { requiresAuth: true } },
    { path: '/orgs/:slug/insights', component: stub },
    { path: '/manage/tix', component: stub, meta: { requiresAuth: true } },
    { path: '/manage/frames', component: stub, meta: { requiresAuth: true } },
    { path: '/forms', component: stub, meta: { requiresAuth: true } },
    { path: '/account', component: stub, meta: { requiresAuth: true } },
  ],
})

const memberOrg: OrgListItem = {
  org_id: 'jpcs-apc',
  org_name: 'JPCS APC',
  owner_id: 'user-1',
  is_owner: 1,
  created_at: '2026-01-01',
}

const platformStats = {
  users: 10, orgs: 2, members: 5, links: 20, clicks: 100,
  events: 3, tickets: 8, checkIns: 4, frames: 1, frameDownloads: 2,
}

const orgInsights = {
  profileViews: { total: 4, daily: [{ day: '2026-10-01', n: 4 }] },
  frames: { campaigns: 0, views: 0, downloads: 0 },
  tix: { events: 0, registrations: 0, checkIns: 0 },
  members: { daily: [{ day: '2026-10-01', count: 2 }] },
}

function media(matches: boolean) {
  return {
    matches,
    media: '',
    onchange: null,
    addEventListener() {},
    removeEventListener() {},
    addListener() {},
    removeListener() {},
    dispatchEvent() {
      return false
    },
  }
}

function stubMatchMedia(phone: boolean) {
  vi.stubGlobal('matchMedia', (query: string) =>
    media(phone && String(query).includes('max-width')),
  )
}

function nameOf(el: Element) {
  return (
    el.getAttribute('aria-label') ||
    el.getAttribute('aria-labelledby') ||
    el.getAttribute('title') ||
    el.textContent ||
    ''
  ).trim()
}

function signIn() {
  const session = useSession()
  session.user.value = {
    id: 'user-1',
    email: 'ada@apc.edu.ph',
    name: 'Ada',
    role: 'user',
    avatarIcon: null,
    avatarColor: null,
  }
  session.status.value = 'ready'
  session.pendingInviteCount.value = 0
}

function orgState() {
  return createApp({}).use(router).runWithContext(() => useActiveOrg())
}

function resetOrgState() {
  const state = orgState()
  state.orgs.value = []
  state.activeOrg.value = null
  state.orgsLoaded.value = false
  return state
}

function stubFetch(orgList: OrgListItem[] = []) {
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
    const url = new URL(String(input), 'https://eypi.cc')
    if (url.pathname === '/api/orgs') {
      return new Response(JSON.stringify({ orgs: orgList }), {
        headers: { 'Content-Type': 'application/json' },
      })
    }
    if (url.pathname === '/api/links/summary/trends') {
      return new Response(JSON.stringify(sampleTrends), {
        headers: { 'Content-Type': 'application/json' },
      })
    }
    if (url.pathname === '/api/tickets/upcoming') {
      return new Response(JSON.stringify({ tickets: [] }), {
        headers: { 'Content-Type': 'application/json' },
      })
    }
    if (url.pathname === '/api/stats') {
      return new Response(JSON.stringify(platformStats), {
        headers: { 'Content-Type': 'application/json' },
      })
    }
    if (url.pathname.includes('/insights')) {
      return new Response(JSON.stringify(orgInsights), {
        headers: { 'Content-Type': 'application/json' },
      })
    }
    return new Response(JSON.stringify({ orgs: orgList }), {
      headers: { 'Content-Type': 'application/json' },
    })
  }))
}

const mounted: Array<{ unmount: () => void }> = []

async function mountShell() {
  await router.push('/dashboard')
  await router.isReady()
  const wrapper = mount(AppShell, {
    attachTo: document.body,
    slots: { default: '<p>content</p>' },
    global: {
      plugins: [router],
      stubs: { MarketingFooter: { template: '<footer />' }, CommandPalette: true },
    },
  })
  await flushPromises()
  mounted.push(wrapper)
  return wrapper
}

function assertNamedControls(scope: Element) {
  const controls = [...scope.querySelectorAll('a, button')]
  expect(controls.length).toBeGreaterThan(0)
  const unnamed = controls.filter((el) => !nameOf(el)).map((el) => el.outerHTML.slice(0, 100))
  expect(unnamed).toEqual([])
}

beforeEach(() => {
  stubMatchMedia(false)
  stubFetch([])
  localStorage.clear()
  sessionStorage.clear()
  clearQueryCache()
  useSession().reset()
  resetOrgState()
  useDashboardRange().setRange(30)
  clearQueryCache()
})

afterEach(() => {
  for (const wrapper of mounted.splice(0)) {
    try { wrapper.unmount() } catch { /* already gone */ }
  }
  document.body.innerHTML = ''
  vi.unstubAllGlobals()
})

describe('dashboardA11y shell names and targets', () => {
  it('names every rail, tab and profile-sheet control for a non-member', async () => {
    signIn()
    stubFetch([])
    stubMatchMedia(true)
    const wrapper = await mountShell()
    const rail = wrapper.get('aside nav[aria-label="App modules"]').element
    const tabs = wrapper.get('nav[aria-label="Primary"]').element
    assertNamedControls(rail)
    assertNamedControls(tabs)
    const grid = tabs.querySelector('[data-tab-grid]')
    expect(grid?.classList.contains('h-[4.5rem]')).toBe(true)
    for (const link of tabs.querySelectorAll('a')) {
      expect(
        /\bmin-h-11\b/.test(link.className) || grid?.classList.contains('h-[4.5rem]'),
        `tab ${link.getAttribute('href')} needs a 44px target class`,
      ).toBe(true)
    }
    await wrapper.get('[data-account-menu="header"]').trigger('click')
    await flushPromises()
    await nextTick()
    const sheet = document.body.querySelector('[role="dialog"][aria-label="Account"]')
    expect(sheet).not.toBeNull()
    assertNamedControls(sheet!)
  })

  it('names every rail, tab and profile-sheet control for a member', async () => {
    signIn()
    stubFetch([memberOrg])
    localStorage.setItem('eypi.hasOrg', '1')
    const state = resetOrgState()
    state.orgs.value = [memberOrg]
    state.activeOrg.value = memberOrg
    state.orgsLoaded.value = true
    stubMatchMedia(true)
    const wrapper = await mountShell()
    const rail = wrapper.get('aside nav[aria-label="App modules"]').element
    expect(rail.textContent).toMatch(/Tix/)
    assertNamedControls(rail)
    assertNamedControls(wrapper.get('nav[aria-label="Primary"]').element)
    await wrapper.get('[data-account-menu="header"]').trigger('click')
    await flushPromises()
    await nextTick()
    const sheet = document.body.querySelector('[role="dialog"][aria-label="Account"]')
    expect(sheet).not.toBeNull()
    assertNamedControls(sheet!)
  })
})

describe('dashboardA11y dashboard landmarks and charts', () => {
  it('has one h1, labelled section landmarks, labelled charts and no dark: classes', async () => {
    signIn()
    stubFetch([memberOrg])
    const state = resetOrgState()
    state.orgs.value = [memberOrg]
    state.activeOrg.value = memberOrg
    state.orgsLoaded.value = true
    clearQueryCache()
    await router.push('/dashboard')
    await router.isReady()
    const wrapper = mount(DashboardView, {
      attachTo: document.body,
      global: { plugins: [router] },
    })
    mounted.push(wrapper)
    await flushPromises()

    expect(wrapper.findAll('h1')).toHaveLength(1)
    const sections = wrapper.findAll('section[aria-labelledby]')
    expect(sections.length).toBeGreaterThanOrEqual(2)
    for (const section of sections) {
      const id = section.attributes('aria-labelledby')!
      expect(wrapper.find(`#${CSS.escape(id)}`).exists()).toBe(true)
    }
    const charts = wrapper.findAll('[role="img"]')
    expect(charts.length).toBeGreaterThan(0)
    for (const chart of charts) {
      const label = chart.attributes('aria-label')
      const table = chart.find('table')
      expect(Boolean(label) || table.exists()).toBe(true)
    }
    expect(wrapper.html()).not.toMatch(/(?<![a-z0-9-])dark:[a-z[]/)
    const designGuard = readFileSync(resolve('src/styles/design.test.ts'), 'utf8')
    expect(designGuard).toMatch(/dark:/)
  })
})

describe('dashboardA11y org gating live update', () => {
  it('drops Orgs from the rail and dashboard when the last org is removed', async () => {
    signIn()
    stubFetch([memberOrg])
    const state = resetOrgState()
    state.orgs.value = [memberOrg]
    state.activeOrg.value = memberOrg
    state.orgsLoaded.value = true

    const shell = await mountShell()
    expect(shell.get('aside nav[aria-label="App modules"]').text()).toMatch(/Tix/)

    clearQueryCache()
    const dash = mount(DashboardView, {
      attachTo: document.body,
      global: { plugins: [router] },
    })
    mounted.push(dash)
    await flushPromises()
    expect(dash.find('#orgs-heading').exists()).toBe(true)

    state.orgs.value = []
    state.activeOrg.value = null
    state.orgsLoaded.value = true
    await flushPromises()
    await nextTick()

    expect(shell.find('aside nav[aria-label="App modules"]').text()).not.toMatch(/\bTix\b/)
    expect(dash.find('#orgs-heading').exists()).toBe(false)
  })
})