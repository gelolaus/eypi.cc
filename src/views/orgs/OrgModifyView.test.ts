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
  membersStatus?: number
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
      if (options.membersStatus && options.membersStatus !== 200) {
        return json({ error: { code: 'server' } }, options.membersStatus)
      }
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

  it('does not treat a failed member load as an empty transfer list', async () => {
    installFetch({ asOwner: true, membersStatus: 500 })
    const wrapper = mount(Harness, {
      attachTo: document.body,
      global: { plugins: [router] },
    })
    await flushPromises()

    expect(wrapper.text()).toContain('Could not load members. Try again.')
    expect(wrapper.text()).not.toContain('Invite an active member before transferring ownership.')
    wrapper.unmount()
  })
})

describe('OrgModifyView images', () => {
  it('previews a logo from the uploaded media URL', async () => {
    class ImmediateReader {
      result: string | null = null
      onload: null | (() => void) = null
      onerror: null | (() => void) = null
      readAsDataURL() {
        this.result = 'data:image/png;base64,AAAA'
        this.onload?.()
      }
    }
    vi.stubGlobal('FileReader', ImmediateReader)
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const path = pathname(input)
      const method = init?.method ?? 'GET'
      if (path === '/api/orgs' && method === 'GET') return json({ orgs: [memberOrg] })
      if (path === '/api/orgs/jpcs/profile' && method === 'GET') return json({ profile })
      if (path === '/api/orgs/jpcs/profile' && method === 'PATCH') {
        return json({
          profile: { ...profile, logoUrl: '/media/orgs/jpcs/logo-abcd1234.png' },
        })
      }
      return json({ error: { code: 'not_found', message: 'Missing.' } }, 404)
    }))

    const wrapper = mount(Harness, {
      attachTo: document.body,
      global: { plugins: [router] },
    })
    await flushPromises()

    const input = wrapper.findAll('input[type="file"]')[1]
    const file = new File([new Uint8Array([1, 2, 3])], 'logo.png', { type: 'image/png' })
    Object.defineProperty(input.element, 'files', { value: [file] })
    await input.trigger('change')
    await flushPromises()

    expect(wrapper.get('img[alt="Logo preview"]').attributes('src')).toBe('/media/orgs/jpcs/logo-abcd1234.png')
    expect(wrapper.html()).not.toContain('data:')
    wrapper.unmount()
  })

  it.each([
    ['logo', 1, 'logoUrl', '/media/orgs/jpcs/logo-aaaaaaaa.png', '/media/orgs/jpcs/logo-bbbbbbbb.png', 'Logo preview'],
    ['banner', 0, 'bannerUrl', '/media/orgs/jpcs/banner-aaaaaaaa.jpg', '/media/orgs/jpcs/banner-bbbbbbbb.jpg', 'Banner preview'],
  ] as const)(
    'does not commit a stale %s while that upload is in flight',
    async (_label, inputIndex, field, staleUrl, nextUrl, alt) => {
      class ImmediateReader {
        result: string | null = null
        onload: null | (() => void) = null
        onerror: null | (() => void) = null
        readAsDataURL() {
          this.result = 'data:image/png;base64,AAAA'
          this.onload?.()
        }
      }
      vi.stubGlobal('FileReader', ImmediateReader)
      const loaded = { ...profile, logoUrl: staleUrl, bannerUrl: staleUrl, [field]: staleUrl }
      const saves: Array<Record<string, unknown>> = []
      const pending: { release: ((response: Response) => void) | null } = { release: null }
      vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const path = pathname(input)
        const method = init?.method ?? 'GET'
        if (path === '/api/orgs' && method === 'GET') return json({ orgs: [memberOrg] })
        if (path === '/api/orgs/jpcs/profile' && method === 'GET') return json({ profile: loaded })
        if (path === '/api/orgs/jpcs/profile' && method === 'PATCH') {
          const body = JSON.parse(String(init?.body)) as Record<string, unknown>
          const image = body[field]
          if (Object.keys(body).length === 1 && typeof image === 'string' && image.startsWith('data:')) {
            return new Promise<Response>((resolve) => {
              pending.release = resolve
            })
          }
          saves.push(body)
          return json({ profile: loaded })
        }
        return json({ error: { code: 'not_found', message: 'Missing.' } }, 404)
      }))

      const wrapper = mount(Harness, {
        attachTo: document.body,
        global: { plugins: [router] },
      })
      await flushPromises()

      const input = wrapper.findAll('input[type="file"]')[inputIndex]
      const file = new File([new Uint8Array([1, 2, 3])], `${field}.png`, { type: 'image/png' })
      Object.defineProperty(input.element, 'files', { value: [file] })
      await input.trigger('change')
      await flushPromises()
      const releaseUpload = pending.release
      if (!releaseUpload) throw new Error('upload did not start')

      const save = wrapper.findAll('button').find((button) => button.text() === 'Save profile')
      expect(save).toBeTruthy()
      await save!.element.closest('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
      await flushPromises()

      expect(saves).toEqual([])
      expect((save!.element as HTMLButtonElement).disabled).toBe(true)

      releaseUpload(json({ profile: { ...loaded, [field]: nextUrl } }))
      await flushPromises()
      expect(saves).toEqual([])
      expect(wrapper.get(`img[alt="${alt}"]`).attributes('src')).toBe(nextUrl)
      wrapper.unmount()
    },
  )
})

describe('OrgModifyView mobile layout', () => {
  it('uses AppPage, no nested main, no in-page OrgSwitcher, no min-width table wrapper, 44px toggle', async () => {
    installFetch({
      asOwner: true,
      members: [{ email: 'bea@student.apc.edu.ph', user_id: 'u1', name: 'Bea', activated_at: '2026-01-01T00:00:00.000Z', declined_at: null }],
    })
    const wrapper = mount(Harness, { attachTo: document.body, global: { plugins: [router] } })
    await flushPromises()

    expect(wrapper.find('[data-app-page]').exists()).toBe(true)
    expect(wrapper.find('main').exists()).toBe(false)
    expect(wrapper.findComponent({ name: 'OrgSwitcher' }).exists()).toBe(false)
    expect(wrapper.html()).not.toMatch(/min-w-\[\d+px\]/)
    expect(wrapper.get('[role="switch"]').classes()).toContain('h-11')
    expect(wrapper.get('table').classes()).toContain('block')
    wrapper.unmount()
  })
})
