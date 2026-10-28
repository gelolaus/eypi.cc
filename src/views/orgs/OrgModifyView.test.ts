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
import { makeVariants } from '@/lib/images/variants'
import OrgModifyView from './OrgModifyView.vue'

vi.mock('@/lib/images/variants', () => ({
  makeVariants: vi.fn(async () => {
    throw new Error('no canvas')
  }),
}))

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

  class VariantReader {
    result: string | null = null
    onload: null | (() => void) = null
    onerror: null | (() => void) = null
    readAsDataURL() {
      this.result = 'data:image/png;base64,AAAA'
      this.onload?.()
    }
  }

  async function uploadLogo(variantsResponse: () => Response) {
    vi.stubGlobal('FileReader', VariantReader)
    const calls: Array<{ path: string; body: Record<string, unknown> }> = []
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const path = pathname(input)
      const method = init?.method ?? 'GET'
      if (path === '/api/orgs' && method === 'GET') return json({ orgs: [memberOrg] })
      if (path === '/api/orgs/jpcs/profile' && method === 'GET') return json({ profile })
      if (path === '/api/orgs/jpcs/profile' && method === 'PATCH') {
        return json({ profile: { ...profile, logoUrl: '/media/orgs/jpcs/logo-abcd1234.png' } })
      }
      if (path === '/api/media/variants' && method === 'PUT') {
        calls.push({ path, body: JSON.parse(String(init?.body)) as Record<string, unknown> })
        return variantsResponse()
      }
      return json({ error: { code: 'not_found', message: 'Missing.' } }, 404)
    }))
    const wrapper = mount(Harness, { attachTo: document.body, global: { plugins: [router] } })
    await flushPromises()
    const input = wrapper.findAll('input[type="file"]')[1]
    const file = new File([new Uint8Array([1, 2, 3])], 'logo.png', { type: 'image/png' })
    Object.defineProperty(input.element, 'files', { value: [file] })
    await input.trigger('change')
    await flushPromises()
    await flushPromises()
    return { wrapper, calls }
  }

  it('puts orgLogo variants after the logo is saved and uses them for the preview', async () => {
    const meta = { w: 1000, h: 1000, fmt: 'webp', widths: [96, 192, 384], ph: 'data:image/webp;base64,AAAA' }
    vi.mocked(makeVariants).mockResolvedValueOnce({
      meta: meta as never,
      variants: [96, 192, 384].map((width) => ({ width, dataUrl: `data:image/webp;base64,V${width}` })),
    })
    const { wrapper, calls } = await uploadLogo(() => json({ meta }))

    expect(makeVariants).toHaveBeenCalledWith(expect.any(File), 'orgLogo')
    expect(calls).toHaveLength(1)
    expect(calls[0].body).toMatchObject({
      key: '/media/orgs/jpcs/logo-abcd1234.png',
      placeholder: meta.ph,
      meta: { w: 1000, h: 1000, fmt: 'webp', widths: [96, 192, 384] },
    })
    expect((calls[0].body.variants as Array<{ width: number }>).map((v) => v.width)).toEqual([96, 192, 384])
    expect(wrapper.get('img[alt="Logo preview"]').attributes('srcset')).toContain(
      '/media/orgs/jpcs/logo-abcd1234-96.webp 96w',
    )
    wrapper.unmount()
  })

  it('skips the variants call for a small image and keeps the saved logo', async () => {
    vi.mocked(makeVariants).mockResolvedValueOnce({
      meta: { w: 50, h: 50, fmt: 'webp', widths: [], ph: '' },
      variants: [],
    })
    const { wrapper, calls } = await uploadLogo(() => json({}))
    expect(calls).toEqual([])
    expect(wrapper.get('img[alt="Logo preview"]').attributes('src')).toBe('/media/orgs/jpcs/logo-abcd1234.png')
    wrapper.unmount()
  })

  it('still saves the logo when variants cannot be made or stored', async () => {
    vi.mocked(makeVariants).mockRejectedValueOnce(new Error('no canvas'))
    const failed = await uploadLogo(() => json({}))
    expect(failed.wrapper.get('img[alt="Logo preview"]').attributes('src')).toBe('/media/orgs/jpcs/logo-abcd1234.png')
    expect(failed.wrapper.text()).not.toContain('Upload failed')
    failed.wrapper.unmount()

    vi.mocked(makeVariants).mockResolvedValueOnce({
      meta: { w: 1000, h: 1000, fmt: 'webp', widths: [96], ph: '' },
      variants: [{ width: 96, dataUrl: 'data:image/webp;base64,V96' }],
    })
    const rejected = await uploadLogo(() => json({ error: { code: 'rate_limited', message: 'Slow down.' } }, 429))
    expect(rejected.calls).toHaveLength(1)
    expect(rejected.wrapper.get('img[alt="Logo preview"]').attributes('src')).toBe('/media/orgs/jpcs/logo-abcd1234.png')
    rejected.wrapper.unmount()
  })
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
    expect(wrapper.get('table').attributes('role')).toBe('table')
    expect(wrapper.findAll('[role="rowgroup"]')).toHaveLength(2)
    expect(wrapper.findAll('[role="columnheader"]').map((h) => h.text())).toEqual(['Name', 'Email', 'Status', 'Actions'])
    expect(wrapper.get('thead').classes()).not.toContain('hidden')
    expect(wrapper.findAll('tbody [role="row"]')).toHaveLength(1)
    expect(wrapper.findAll('tbody [role="cell"]')).toHaveLength(4)
    wrapper.unmount()
  })
})

describe('OrgModifyView undo', () => {
  const pending = (email: string) => ({ email, user_id: null, name: null, activated_at: null, declined_at: null })
  const active = (email: string) => ({ email, user_id: `u-${email}`, name: email, activated_at: '2026-10-01T00:00:00.000Z', declined_at: null })
  let deletes: Array<{ path: string; body: string; org: string | null }>

  function installWithDelete(members: unknown[]) {
    installFetch({ asOwner: true, members })
    const base = globalThis.fetch as unknown as (i: RequestInfo | URL, init?: RequestInit) => Promise<Response>
    deletes = []
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      if (init?.method === 'DELETE') {
        deletes.push({ path: pathname(input), body: String(init.body), org: new Headers(init.headers).get('X-Active-Org-Id') })
        return json({ success: true })
      }
      return base(input, init)
    }))
  }

  async function mountMembers(members: unknown[]) {
    installWithDelete(members)
    const wrapper = mount(Harness, { attachTo: document.body, global: { plugins: [router] } })
    await flushPromises()
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] })
    return wrapper
  }

  const button = (wrapper: ReturnType<typeof mount>, label: string, n = 0) =>
    wrapper.findAll('button').filter((b) => b.text() === label)[n]

  afterEach(() => {
    window.dispatchEvent(new Event('pagehide'))
    vi.useRealTimers()
  })

  it('cancels an invite without a dialog and sends the DELETE after 5 s', async () => {
    const wrapper = await mountMembers([pending('bea@student.apc.edu.ph')])
    await button(wrapper, 'Cancel invite').trigger('click')

    expect(document.querySelector('[role="dialog"]')).toBeNull()
    expect(wrapper.text()).not.toContain('bea@student.apc.edu.ph')
    expect(deletes).toEqual([])
    await vi.advanceTimersByTimeAsync(5_000)
    expect(deletes).toHaveLength(1)
    expect(deletes[0]).toMatchObject({ path: '/api/orgs/jpcs/members', org: 'jpcs' })
    wrapper.unmount()
  })

  it('still deletes from the original org when the route changes inside the window', async () => {
    const wrapper = await mountMembers([pending('bea@student.apc.edu.ph')])
    await button(wrapper, 'Cancel invite').trigger('click')
    await router.push('/orgs/modify/other')
    localStorage.setItem('active_org_id', 'other')
    await vi.advanceTimersByTimeAsync(5_000)

    expect(deletes).toHaveLength(1)
    expect(deletes[0]).toMatchObject({ path: '/api/orgs/jpcs/members', org: 'jpcs' })
    expect(deletes[0].body).toContain('bea@student.apc.edu.ph')
    wrapper.unmount()
  })

  it('keeps overlapping removals independent', async () => {
    const wrapper = await mountMembers([active('ana@student.apc.edu.ph'), active('ben@student.apc.edu.ph')])
    await button(wrapper, 'Remove').trigger('click')
    await button(wrapper, 'Remove').trigger('click')
    expect(wrapper.text()).not.toContain('ana@student.apc.edu.ph')
    expect(wrapper.text()).not.toContain('ben@student.apc.edu.ph')

    const toasts = useToast().toasts.value.filter((t) => t.message === 'Member removed.')
    toasts[0].action!.onClick()
    await flushPromises()
    expect(wrapper.text()).toContain('ana@student.apc.edu.ph')
    expect(wrapper.text()).not.toContain('ben@student.apc.edu.ph')
    toasts[1].action!.onClick()
    await flushPromises()
    expect(wrapper.text()).toContain('ben@student.apc.edu.ph')
    expect(deletes).toEqual([])
    wrapper.unmount()
  })
})
