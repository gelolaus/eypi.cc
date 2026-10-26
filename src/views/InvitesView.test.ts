// @vitest-environment happy-dom
import { flushPromises, mount } from '@vue/test-utils'
import { defineComponent, nextTick } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'
import DialogHost from '@/components/DialogHost.vue'
import { useDialog } from '@/composables/useDialog'
import { useOrgMembership } from '@/composables/useOrgMembership'
import { useToast } from '@/composables/useToast'
import { useSession } from '@/stores/session'
import InvitesView from './InvitesView.vue'

const invitedAt = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString()

const invite = {
  orgId: 'jpcs',
  orgName: 'JPCS',
  logoUrl: 'https://cdn.example/jpcs.png',
  invitedByName: 'Ada',
  invitedAt,
}

const orgRow = {
  org_id: 'jpcs',
  org_name: 'JPCS',
  logo_url: null,
  owner_id: 'owner-1',
  is_owner: 0,
  created_at: '2026-01-01T00:00:00.000Z',
}

const otherOrg = {
  ...orgRow,
  org_id: 'other-org',
  org_name: 'Other',
}

type FetchCall = [RequestInfo | URL, RequestInit | undefined]

function pathname(input: RequestInfo | URL): string {
  return new URL(String(input), 'http://localhost').pathname
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
    { path: '/invites', component: InvitesView },
    { path: '/orgs/:slug', component: { template: '<div />' } },
  ],
})

const Harness = defineComponent({
  components: { InvitesView, DialogHost },
  template: '<div><InvitesView /><DialogHost /></div>',
})

let formsFetches = 0
let cacheClearedBeforeOrgsFetch = false

function installFetch(list: unknown, acceptStatus = 200) {
  formsFetches = 0
  cacheClearedBeforeOrgsFetch = false
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const path = pathname(input)
    const method = init?.method ?? 'GET'
    if (path === '/api/forms') {
      formsFetches += 1
      return json({ error: { code: 'no_org', message: 'No org.' } }, 403)
    }
    if (path === '/api/orgs/invites' && method === 'GET') return json(list)
    if (path === '/api/orgs/invites/jpcs/accept' && method === 'POST') {
      return json(
        acceptStatus === 200
          ? { orgId: 'jpcs' }
          : { error: { code: 'not_found', message: 'Invitation not found.' } },
        acceptStatus,
      )
    }
    if (path === '/api/orgs/invites/jpcs/decline' && method === 'POST') return json({ orgId: 'jpcs' })
    if (path === '/api/orgs' && method === 'GET') {
      const before = formsFetches
      await useOrgMembership().checkOrgMembership()
      cacheClearedBeforeOrgsFetch = formsFetches > before
      return json({ orgs: [otherOrg, orgRow] })
    }
    if (path === '/api/me') {
      return json({
        user: { id: 'user-1', email: 'ada@apc.edu.ph', name: 'Ada', role: 'user' },
        pendingInviteCount: 0,
        needsConsent: [],
        orgs: [],
      })
    }
    return json({ error: { code: 'not_found', message: 'Missing.' } }, 404)
  }))
}

async function mountInbox() {
  await router.push('/invites')
  await router.isReady()
  const wrapper = mount(Harness, {
    attachTo: document.body,
    global: { plugins: [router] },
  })
  await flushPromises()
  return wrapper
}

function calls(): FetchCall[] {
  return vi.mocked(fetch).mock.calls as FetchCall[]
}

beforeEach(async () => {
  localStorage.clear()
  localStorage.setItem('active_org_id', 'other-org')
  useSession().reset()
  useOrgMembership().clearOrgMembershipCache()
  const dialog = useDialog()
  if (dialog.current.value) dialog.abort()
  const toast = useToast()
  while (toast.toasts.value.length > 0) toast.dismiss(toast.toasts.value[0].id)
  installFetch([invite])
  await useOrgMembership().checkOrgMembership()
})

afterEach(() => {
  const dialog = useDialog()
  if (dialog.current.value) dialog.abort()
  const toast = useToast()
  while (toast.toasts.value.length > 0) toast.dismiss(toast.toasts.value[0].id)
  vi.unstubAllGlobals()
  document.body.innerHTML = ''
})

describe('InvitesView', () => {
  it('renders a card for each pending invite', async () => {
    const wrapper = await mountInbox()

    expect(wrapper.text()).toContain('JPCS')
    expect(wrapper.text()).toContain('Invited by Ada · 3 days ago')
    expect(wrapper.get('img').attributes('alt')).toBe('JPCS logo')
    expect(wrapper.findAll('button').map((button) => button.text())).toEqual(expect.arrayContaining(['Accept', 'Decline']))
    wrapper.unmount()
  })

  it('shows an empty state when nothing is pending', async () => {
    installFetch([])
    const wrapper = await mountInbox()

    expect(wrapper.text()).toContain('No pending invites.')
    expect(wrapper.find('button').exists()).toBe(false)
    wrapper.unmount()
  })

  it('accepts an invite, clears the membership cache, fetches orgs, activates it, and opens the org', async () => {
    const wrapper = await mountInbox()
    const accept = wrapper.findAll('button').find((button) => button.text() === 'Accept')
    expect(accept).toBeTruthy()

    await accept!.trigger('click')
    await flushPromises()

    const paths = calls().map((call) => `${pathname(call[0])} ${call[1]?.method ?? 'GET'}`)
    const acceptAt = paths.indexOf('/api/orgs/invites/jpcs/accept POST')
    const orgsAt = paths.indexOf('/api/orgs GET')
    expect(acceptAt).toBeGreaterThanOrEqual(0)
    expect(orgsAt).toBeGreaterThan(acceptAt)
    expect(cacheClearedBeforeOrgsFetch).toBe(true)
    expect(localStorage.getItem('active_org_id')).toBe('jpcs')
    expect(router.currentRoute.value.path).toBe('/orgs/jpcs')
    wrapper.unmount()
  })

  it('shows an accept failure inline and stays on the inbox', async () => {
    installFetch([invite], 404)
    await useOrgMembership().checkOrgMembership()
    const wrapper = await mountInbox()
    const accept = wrapper.findAll('button').find((button) => button.text() === 'Accept')

    await accept!.trigger('click')
    await flushPromises()

    expect(wrapper.get('[role="alert"]').text()).toBe('Invitation not found.')
    expect(localStorage.getItem('active_org_id')).toBe('other-org')
    expect(router.currentRoute.value.path).toBe('/invites')
    wrapper.unmount()
  })

  it('asks before declining an invite', async () => {
    const wrapper = await mountInbox()
    const decline = wrapper.findAll('button').find((button) => button.text() === 'Decline')
    expect(decline).toBeTruthy()

    const pending = decline!.trigger('click')
    await nextTick()
    await flushPromises()

    const dialog = document.querySelector('[role="dialog"]')
    expect(dialog?.textContent).toContain('Decline invite to JPCS?')
    expect(calls().some((call) => pathname(call[0]).endsWith('/decline'))).toBe(false)

    const abort = [...(dialog?.querySelectorAll('button') ?? [])].find((button) => button.textContent?.trim() === 'Abort')
    abort?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await pending
    await flushPromises()

    expect(wrapper.text()).toContain('JPCS')
    expect(calls().some((call) => pathname(call[0]).endsWith('/decline'))).toBe(false)
    wrapper.unmount()
  })

  it('declines an invite after confirmation', async () => {
    const wrapper = await mountInbox()
    const decline = wrapper.findAll('button').find((button) => button.text() === 'Decline')
    const pending = decline!.trigger('click')
    await nextTick()
    await flushPromises()

    const dialog = document.querySelector('[role="dialog"]')
    const confirm = [...(dialog?.querySelectorAll('button') ?? [])].find((button) => button.textContent?.trim() === 'Decline')
    confirm?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await pending
    await flushPromises()

    expect(calls().some((call) => pathname(call[0]) === '/api/orgs/invites/jpcs/decline' && (call[1]?.method ?? 'GET') === 'POST')).toBe(true)
    expect(wrapper.text()).toContain('No pending invites.')
    expect(wrapper.text()).not.toContain('JPCS')
    wrapper.unmount()
  })
})
