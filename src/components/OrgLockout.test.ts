// @vitest-environment happy-dom
import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'
import OrgLockout from './OrgLockout.vue'
import { useOrgMembership } from '@/composables/useOrgMembership'
import { useSession } from '@/stores/session'

const invitedAt = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString()

const invite = {
  orgId: 'jpcs',
  orgName: 'JPCS',
  logoUrl: null,
  invitedByName: 'Ada',
  invitedAt,
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

const router = createRouter({
  history: createMemoryHistory(),
  routes: [
    { path: '/', component: { template: '<div />' } },
    { path: '/orgs/:slug', component: { template: '<div />' } },
  ],
})

beforeEach(async () => {
  localStorage.clear()
  useSession().reset()
  useOrgMembership().clearOrgMembershipCache()
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input)
    if (url.includes('/api/orgs/invites')) return json([invite])
    return json({ orgs: [] })
  }))
  await router.push('/')
  await router.isReady()
})

afterEach(() => {
  vi.unstubAllGlobals()
  document.body.innerHTML = ''
})

describe('OrgLockout', () => {
  it('shows pending invites inline and does not link to org settings', async () => {
    const wrapper = mount(OrgLockout, {
      attachTo: document.body,
      global: { plugins: [router] },
    })
    await flushPromises()

    expect(wrapper.text()).toContain('JPCS')
    expect(wrapper.text()).toContain('Invited by Ada · 3 days ago')
    expect(wrapper.text()).toContain('Accept')
    expect(wrapper.text()).toContain('Decline')
    expect(wrapper.text()).not.toContain('accept it in the Orgs module')
    expect(wrapper.find('a[href="/orgs/modify"]').exists()).toBe(false)
    wrapper.unmount()
  })
})
