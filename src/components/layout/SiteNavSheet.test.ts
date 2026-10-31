// @vitest-environment happy-dom
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createApp } from 'vue'
import { createMemoryHistory, createRouter } from 'vue-router'
import SiteNavSheet from './SiteNavSheet.vue'
import { useActiveOrg } from '@/composables/useActiveOrg'
import { useNavDrawer } from '@/composables/useNavDrawer'
import { useSession } from '@/stores/session'
import type { OrgListItem } from '@/types/orgs'

const stub = { template: '<div />' }
const router = createRouter({
  history: createMemoryHistory(),
  routes: [
    { path: '/', component: stub },
    { path: '/dashboard', component: stub },
    { path: '/links', component: stub },
    { path: '/tickets', component: stub },
    { path: '/wallpaper', component: stub },
    { path: '/invites', component: stub },
    { path: '/orgs', component: stub },
    { path: '/manage/tix', component: stub },
    { path: '/manage/frames', component: stub },
    { path: '/forms', component: stub },
    { path: '/orgs/modify/:slug?', component: stub },
    { path: '/account', component: stub },
    { path: '/admin/users', component: stub },
    { path: '/login', component: stub },
  ],
})

const ORG_HREFS = ['/manage/tix', '/manage/frames', '/forms', '/orgs/modify']

function memberOrg(): OrgListItem {
  return {
    org_id: 'ccs',
    org_name: 'CCS',
    owner_id: 'user-1',
    is_owner: 1,
    created_at: '2026-01-01T00:00:00.000Z',
  }
}

function orgState() {
  return createApp({}).use(router).runWithContext(() => useActiveOrg())
}

/** Flip loaded so hasOrg re-reads the hint. The computed ignores localStorage alone. */
function setMembership(loaded: boolean, orgs: OrgListItem[], hint: '0' | '1' | null) {
  if (hint === null) localStorage.removeItem('eypi.hasOrg')
  else localStorage.setItem('eypi.hasOrg', hint)
  const state = orgState()
  state.orgs.value = orgs
  state.activeOrg.value = orgs[0] ?? null
  state.orgsLoaded.value = !loaded
  state.orgsLoaded.value = loaded
}

function signIn(role: 'user' | 'admin' = 'user') {
  const session = useSession()
  session.user.value = { id: 'user-1', email: 'ada@apc.edu.ph', name: 'Ada', role, avatarIcon: null, avatarColor: null }
  session.status.value = 'ready'
}

function headings(): string[] {
  return Array.from(document.querySelectorAll('#site-nav-sidebar [data-nav-group-heading]')).map((heading) => heading.textContent?.trim() ?? '')
}

function link(href: string): HTMLAnchorElement | null {
  return document.querySelector(`#site-nav-sidebar a[href="${href}"]`)
}

beforeEach(async () => {
  localStorage.clear()
  useSession().reset()
  setMembership(false, [], null)
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ orgs: [] }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })))
  await router.push('/')
  await router.isReady()
})

let wrapper: VueWrapper | undefined

afterEach(async () => {
  useNavDrawer().close()
  wrapper?.unmount()
  wrapper = undefined
  await flushPromises()
  document.body.innerHTML = ''
})

async function openSheet() {
  wrapper = mount(SiteNavSheet, {
    attachTo: document.body,
    global: { plugins: [router] },
  })
  useNavDrawer().open()
  await flushPromises()
}

describe('SiteNavSheet groups', () => {
  it('lists the Rams group only for a non-member', async () => {
    signIn()
    setMembership(true, [], '0')
    await openSheet()

    expect(headings()).toEqual(['Rams'])
    expect(link('/wallpaper')).not.toBeNull()
    expect(link('/invites')).not.toBeNull()
    expect(link('/orgs')).not.toBeNull()
    expect(link('/account')?.textContent).toContain('Account')
    for (const href of ORG_HREFS) expect(link(href)).toBeNull()
  })

  it('lists the Rams and Orgs groups for a member', async () => {
    signIn()
    setMembership(true, [memberOrg()], '1')
    await openSheet()

    expect(headings()).toEqual(['Rams', 'Orgs'])
    expect(link('/wallpaper')).not.toBeNull()
    expect(link('/invites')).not.toBeNull()
    for (const href of ORG_HREFS) expect(link(href)).not.toBeNull()
    expect(document.querySelector('#site-nav-sidebar [data-nav-group="orgs"]')?.textContent).toContain('My org')
    expect(link('/account')?.textContent).toContain('Account')
  })

  it('lists the Orgs group from the stored hint before orgs load', async () => {
    signIn()
    setMembership(false, [], '1')
    await openSheet()

    expect(headings()).toEqual(['Rams', 'Orgs'])
    for (const href of ORG_HREFS) expect(link(href)).not.toBeNull()
  })
})
