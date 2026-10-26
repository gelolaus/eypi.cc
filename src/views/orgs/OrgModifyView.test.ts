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
import OrgModifyView from './OrgModifyView.vue'

const memberOrg = {
  org_id: 'jpcs',
  org_name: 'JPCS',
  logo_url: null,
  owner_id: 'owner-1',
  is_owner: 0,
  created_at: '2026-01-01T00:00:00.000Z',
}

const profile = {
  slug: 'jpcs',
  name: 'JPCS',
  tagline: null,
  orgType: null,
  aboutMarkdown: null,
  bannerUrl: null,
  logoUrl: null,
  socialLinks: {},
  isPublicCatalog: false,
}

const router = createRouter({
  history: createMemoryHistory(),
  routes: [
    { path: '/orgs/modify', name: 'orgs-modify-index', component: { template: '<div>Org list</div>' } },
    { path: '/orgs/modify/:slug', name: 'orgs-modify', component: OrgModifyView },
  ],
})

const Harness = defineComponent({
  components: { OrgModifyView, DialogHost },
  template: '<div><OrgModifyView /><DialogHost /></div>',
})

let formsFetches = 0
let leavePosted = false
let recordedRefetch = false
let activeClearedBeforeRefetch = false
let cacheClearedBeforeRefetch = false
let routeAtRefetch = ''

function pathname(input: RequestInfo | URL): string {
  return new URL(String(input), 'http://localhost').pathname
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

type FetchOptions = {
  asOwner?: boolean
  members?: unknown[]
}

function installFetch(options: FetchOptions = {}) {
  formsFetches = 0
  leavePosted = false
  recordedRefetch = false
  activeClearedBeforeRefetch = false
  cacheClearedBeforeRefetch = false
  routeAtRefetch = ''
  const org = options.asOwner ? { ...memberOrg, is_owner: 1 } : memberOrg
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const path = pathname(input)
    const method = init?.method ?? 'GET'
    if (path === '/api/forms') {
      formsFetches += 1
      return json({ error: { code: 'no_org', message: 'No org.' } }, 403)
    }
    if (path === '/api/orgs/jpcs/leave' && method === 'POST') {
      leavePosted = true
      return json({ success: true, message: 'You have left the organization.' })
    }
    if (path === '/api/orgs/jpcs/profile' && method === 'GET') {
      return json({ profile })
    }
    if (path === '/api/orgs/jpcs/members' && method === 'GET') {
      return json({ members: options.members ?? [] })
    }
    if (path === '/api/orgs' && method === 'GET') {
      if (leavePosted && !recordedRefetch) {
        recordedRefetch = true
        activeClearedBeforeRefetch = localStorage.getItem('active_org_id') == null
        routeAtRefetch = router.currentRoute.value.path
        const before = formsFetches
        await useOrgMembership().checkOrgMembership()
        cacheClearedBeforeRefetch = formsFetches > before
      }
      return json({ orgs: leavePosted ? [] : [org] })
    }
    return json({ error: { code: 'not_found', message: 'Missing.' } }, 404)
  }))
}

async function confirmDialog(label: string, typed: string) {
  await nextTick()
  await flushPromises()
  const dialog = document.querySelector('[role="dialog"]')
  expect(dialog).toBeTruthy()
  const input = dialog?.querySelector('input')
  expect(input).toBeTruthy()
  input!.value = typed
  input!.dispatchEvent(new Event('input', { bubbles: true }))
  await nextTick()
  const confirm = [...(dialog?.querySelectorAll('button') ?? [])].find((button) => button.textContent?.trim() === label)
  expect(confirm).toBeTruthy()
  expect((confirm as HTMLButtonElement).disabled).toBe(false)
  confirm!.dispatchEvent(new MouseEvent('click', { bubbles: true }))
}

beforeEach(async () => {
  localStorage.clear()
  localStorage.setItem('active_org_id', 'jpcs')
  useSession().reset()
  useOrgMembership().clearOrgMembershipCache()
  const dialog = useDialog()
  if (dialog.current.value) dialog.abort()
  const toast = useToast()
  while (toast.toasts.value.length > 0) toast.dismiss(toast.toasts.value[0].id)
  installFetch()
  await useOrgMembership().checkOrgMembership()
  formsFetches = 0
  await router.push('/orgs/modify/jpcs')
  await router.isReady()
})

afterEach(() => {
  const dialog = useDialog()
  if (dialog.current.value) dialog.abort()
  const toast = useToast()
  while (toast.toasts.value.length > 0) toast.dismiss(toast.toasts.value[0].id)
  vi.unstubAllGlobals()
  document.body.innerHTML = ''
})

describe('OrgModifyView leave', () => {
  it('clears the active org, clears the membership cache, refetches, then navigates', async () => {
    const wrapper = mount(Harness, {
      attachTo: document.body,
      global: { plugins: [router] },
    })
    await flushPromises()

    const leave = wrapper.findAll('button').find((button) => button.text() === 'Leave org')
    expect(leave).toBeTruthy()
    const pending = leave!.trigger('click')
    await confirmDialog('Leave org', 'JPCS')
    await pending
    await flushPromises()

    expect(leavePosted).toBe(true)
    expect(recordedRefetch).toBe(true)
    expect(activeClearedBeforeRefetch).toBe(true)
    expect(cacheClearedBeforeRefetch).toBe(true)
    expect(routeAtRefetch).toBe('/orgs/modify/jpcs')
    expect(localStorage.getItem('active_org_id')).toBeNull()
    expect(router.currentRoute.value.path).toBe('/orgs/modify')
    wrapper.unmount()
  })
})

describe('OrgModifyView members', () => {
  it('does not label a declined row as pending or offer resend', async () => {
    installFetch({
      asOwner: true,
      members: [{
        email: 'bea@student.apc.edu.ph',
        user_id: null,
        name: null,
        activated_at: null,
        declined_at: '2026-10-20T00:00:00.000Z',
      }],
    })
    const wrapper = mount(Harness, {
      attachTo: document.body,
      global: { plugins: [router] },
    })
    await flushPromises()

    const row = wrapper.findAll('tr').find((tr) => tr.text().includes('bea@student.apc.edu.ph'))
    expect(row).toBeTruthy()
    expect(row!.text()).toContain('Declined')
    expect(row!.text()).not.toContain('Pending')
    expect(row!.text()).not.toContain('Resend')
    expect(row!.text()).not.toContain('Cancel invite')
    wrapper.unmount()
  })
})
