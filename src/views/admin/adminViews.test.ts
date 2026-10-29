// @vitest-environment happy-dom
import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import AdminAuditView from './AdminAuditView.vue'
import AdminLinksView from './AdminLinksView.vue'
import AdminReportsView from './AdminReportsView.vue'
import AdminUsersView from './AdminUsersView.vue'
import { useToast } from '@/composables/useToast'
import { useSession } from '@/stores/session'

const confirm = vi.fn(async () => true)

vi.mock('@/composables/useDialog', () => ({
  useDialog: () => ({
    confirm,
    info: vi.fn(),
  }),
}))

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function stubFetch(
  handler: (url: string, init?: RequestInit) => Response | undefined,
): ReturnType<typeof vi.fn> {
  const mock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input)
    return handler(url, init) ?? json(404, { error: { code: 'not_found', message: 'Not found' } })
  })
  vi.stubGlobal('fetch', mock)
  return mock
}

const manilaCrossingTimestamp = '2026-06-30 17:30:00'

beforeEach(() => {
  confirm.mockReset()
  confirm.mockResolvedValue(true)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('admin views timezone', () => {
  it('renders the users joined date in Asia/Manila', async () => {
    stubFetch((url, init) => {
      if (url.includes('/api/admin/users') && (init?.method ?? 'GET') === 'GET') {
        return json(200, {
          items: [{
            id: 'user-1',
            email: 'user@example.com',
            name: 'User',
            role: 'user',
            disabled: false,
            createdAt: manilaCrossingTimestamp,
          }],
          nextCursor: null,
        })
      }
    })

    const wrapper = mount(AdminUsersView)
    await flushPromises()

    expect(wrapper.text()).toContain('Jul 1, 2026')
    expect(wrapper.text()).not.toContain('Jun 30, 2026')
  })

  it('renders the report date in Asia/Manila', async () => {
    stubFetch((url) => {
      if (url.includes('/api/admin/reports')) {
        return json(200, {
          items: [{
            id: 'report-1',
            linkId: 'link-1',
            slug: 'one',
            reason: 'spam',
            details: null,
            status: 'open',
            resolution: null,
            createdAt: manilaCrossingTimestamp,
            resolvedAt: null,
            resolvedBy: null,
            ownerEmail: null,
            linkSlug: 'one',
            linkDisabled: false,
          }],
        })
      }
    })

    const wrapper = mount(AdminReportsView)
    await flushPromises()

    expect(wrapper.text()).toContain('Reported Jul 1, 2026')
    expect(wrapper.text()).not.toContain('Jun 30, 2026')
  })

  it('renders the audit timestamp in Asia/Manila', async () => {
    stubFetch((url) => {
      if (url.includes('/api/admin/audit')) {
        return json(200, {
          items: [{
            id: 'audit-1',
            actorUserId: 'admin-1',
            actorEmail: 'admin@example.com',
            action: 'user.role',
            targetType: 'user',
            targetId: 'user-1',
            meta: null,
            createdAt: manilaCrossingTimestamp,
          }],
          nextCursor: null,
        })
      }
    })

    const wrapper = mount(AdminAuditView)
    await flushPromises()

    expect(wrapper.text()).toContain('2026-07-01 01:30')
    expect(wrapper.text()).not.toContain('2026-06-30')
  })
})

describe('admin audit action filter', () => {
  it('exposes the organization actions', async () => {
    stubFetch((url) => {
      if (url.includes('/api/admin/audit')) {
        return json(200, { items: [], nextCursor: null })
      }
    })

    const wrapper = mount(AdminAuditView)
    await flushPromises()

    const values = wrapper.findAll('#admin-audit-action option').map((option) => option.attributes('value'))
    expect(values).toEqual(expect.arrayContaining([
      'org.create',
      'org.update',
      'org.transfer',
      'org.delete',
    ]))
  })
})

describe('admin links disable undo', () => {
  type Call = { url: string; method: string; body: string; keepalive?: boolean; org: string | null }
  let calls: Call[]
  let postResponse: Response | null

  const link = {
    id: 'link-1', slug: 'one', originalUrl: 'https://example.com/one', ownerEmail: 'owner@example.com',
    createdAt: '2026-01-01 00:00:00', disabled: false, disabledReason: null,
  }

  async function mountLinks(disabled = false) {
    localStorage.setItem('active_org_id', 'org-1')
    calls = []
    postResponse = null
    const fetchMock = stubFetch((url, init) => {
      const method = (init?.method ?? 'GET').toUpperCase()
      if (method === 'GET') return json(200, { items: [{ ...link, disabled }], nextCursor: null })
      calls.push({ url, method, body: String(init?.body ?? ''), keepalive: init?.keepalive, org: new Headers(init?.headers).get('X-Active-Org-Id') })
      return postResponse ?? json(200, { ok: true })
    })
    const wrapper = mount(AdminLinksView)
    await flushPromises()
    return { wrapper, fetchMock }
  }

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] })
  })

  afterEach(() => {
    window.dispatchEvent(new Event('pagehide'))
    useToast().toasts.value = []
    vi.useRealTimers()
  })

  it('disabling a link applies immediately and shows an Undo toast without a confirm dialog', async () => {
    const { wrapper } = await mountLinks()
    await wrapper.get('button[aria-label="Disable /one"]').trigger('click')
    await flushPromises()
    expect(confirm).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain('Disabled')
    expect(wrapper.find('button[aria-label="Disable /one"]').exists()).toBe(false)
    expect(useToast().toasts.value.find((t) => t.message === '/one disabled.')?.action?.label).toBe('Undo')
    expect(calls).toEqual([])
  })

  it('undo restores the link and sends no request', async () => {
    const { wrapper } = await mountLinks()
    await wrapper.get('button[aria-label="Disable /one"]').trigger('click')
    useToast().toasts.value.find((t) => t.message === '/one disabled.')!.action!.onClick()
    await vi.advanceTimersByTimeAsync(10_000)
    await flushPromises()
    expect(wrapper.find('button[aria-label="Disable /one"]').exists()).toBe(true)
    expect(calls).toEqual([])
  })

  it('request fires after the window with the reason and org captured when the action started', async () => {
    const { wrapper } = await mountLinks()
    await wrapper.get('select').setValue('admin')
    await wrapper.get('button[aria-label="Disable /one"]').trigger('click')
    await vi.advanceTimersByTimeAsync(4_900)
    expect(calls).toEqual([])
    localStorage.setItem('active_org_id', 'org-2')
    await vi.advanceTimersByTimeAsync(200)
    await flushPromises()
    expect(calls).toEqual([{
      url: expect.stringContaining('/api/admin/links/link-1/disable'),
      method: 'POST',
      body: JSON.stringify({ reason: 'admin' }),
      keepalive: true,
      org: 'org-1',
    }])
    expect(wrapper.text()).toContain('Disabled by admin')
  })

  it('a failed commit reverts the row and keeps the disable control', async () => {
    const { wrapper } = await mountLinks()
    postResponse = json(500, { error: { code: 'boom', message: 'Could not disable the link.' } })
    await wrapper.get('button[aria-label="Disable /one"]').trigger('click')
    await vi.advanceTimersByTimeAsync(5_000)
    await flushPromises()
    expect(calls).toHaveLength(1)
    expect(wrapper.find('button[aria-label="Disable /one"]').exists()).toBe(true)
    expect(wrapper.text()).not.toContain('Disabled')
    expect(useToast().toasts.value.find((t) => t.type === 'error')?.detail).toBe('Could not disable the link.')
  })

  it('keeps the link disabled when only its edge cache clear fails', async () => {
    const { wrapper } = await mountLinks()
    postResponse = json(502, {
      error: {
        code: 'edge_delete_failed',
        message: 'The link is disabled but the edge cache could not be cleared. Try again.',
      },
    })
    await wrapper.get('button[aria-label="Disable /one"]').trigger('click')
    await vi.advanceTimersByTimeAsync(5_000)
    await flushPromises()
    expect(calls).toHaveLength(1)
    expect(wrapper.text()).toContain('Disabled')
    const err = useToast().toasts.value.find((t) => t.type === 'error')
    expect(err?.message).toContain('edge cache could not be cleared')
    expect(`${err?.message} ${err?.detail ?? ''}`).not.toContain('restored')
  })

  it('does not start another undo for an already-disabled link', async () => {
    const { wrapper } = await mountLinks(true)
    const vm = wrapper.vm as unknown as { disable: (row: unknown) => void; links: unknown[] }
    vm.disable(vm.links[0])
    await vi.advanceTimersByTimeAsync(10_000)
    await flushPromises()
    expect(useToast().toasts.value.some((t) => t.message === '/one disabled.')).toBe(false)
    expect(calls).toEqual([])
  })
})

describe('admin users icon actions', () => {
  it('renders icon-only actions with accessible names on one line', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({
      items: [{ id: 'u2', email: 'bo@apc.edu.ph', name: 'Bo', role: 'user', disabled: false, createdAt: '2026-06-30 17:30:00' }],
      nextCursor: null,
    }), { headers: { 'Content-Type': 'application/json' } })))
    const wrapper = mount(AdminUsersView)
    await flushPromises()
    const labels = wrapper.findAll('[data-admin-row] button').map((b) => b.attributes('aria-label'))
    expect(labels).toEqual([
      'Make bo@apc.edu.ph an admin',
      'Disable bo@apc.edu.ph',
      'Force logout for bo@apc.edu.ph',
      'Delete bo@apc.edu.ph',
    ])
    for (const b of wrapper.findAll('[data-admin-row] button')) expect(b.text()).toBe('')
    expect(wrapper.get('[data-admin-row] button').element.parentElement?.className).toContain('md:flex-nowrap')
    vi.unstubAllGlobals()
  })
})

describe('admin users avatar', () => {
  it('shows an avatar before the name: icon when set, initials otherwise', async () => {
    stubFetch((url) => {
      if (url.includes('/api/admin/users')) {
        return json(200, {
          items: [
            { id: 'u1', email: 'ana@apc.edu.ph', name: 'Ana', role: 'user', disabled: false, createdAt: '2026-06-30 17:30:00', avatarIcon: 'cat', avatarColor: 'blue' },
            { id: 'u2', email: 'ben@apc.edu.ph', name: 'Ben', role: 'user', disabled: false, createdAt: '2026-06-30 17:30:00', avatarIcon: null, avatarColor: null },
          ],
          nextCursor: null,
        })
      }
    })
    const wrapper = mount(AdminUsersView)
    await flushPromises()
    const rows = wrapper.findAll('[data-admin-row]')
    expect(rows[0].findAll('svg').some((svg) => svg.classes().includes('size-[55%]'))).toBe(true)
    expect(rows[0].text()).toContain('Ana')
    expect(rows[1].find('[data-slot="avatar"]').text()).toBe('BE')
    vi.unstubAllGlobals()
  })
})

describe('admin users self actions', () => {
  it('does not offer Disable on the signed-in admin own row, only on others', async () => {
    useSession().user.value = { id: 'me', email: 'me@apc.edu.ph', name: 'Me', role: 'admin', avatarIcon: null, avatarColor: null }
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({
      items: [
        { id: 'me', email: 'me@apc.edu.ph', name: 'Me', role: 'admin', disabled: false, createdAt: '2026-06-30 17:30:00' },
        { id: 'u2', email: 'bo@apc.edu.ph', name: 'Bo', role: 'user', disabled: false, createdAt: '2026-06-30 17:30:00' },
      ],
      nextCursor: null,
    }), { headers: { 'Content-Type': 'application/json' } })))
    const wrapper = mount(AdminUsersView)
    await flushPromises()
    try {
      expect(wrapper.find('button[aria-label="Disable me@apc.edu.ph"]').exists()).toBe(false)
      expect(wrapper.find('button[aria-label="Disable bo@apc.edu.ph"]').exists()).toBe(true)
    } finally {
      useSession().user.value = null
    }
  })
})

describe('admin users disable undo', () => {
  type Call = { url: string; method: string; body: string; keepalive?: boolean; org: string | null }
  let calls: Call[]
  let patchStatus: number

  const user = (disabled: boolean) => ({
    id: 'u2', email: 'bo@apc.edu.ph', name: 'Bo', role: 'user', disabled, createdAt: '2026-06-30 17:30:00',
  })

  async function mountUsers(disabled = false) {
    localStorage.setItem('active_org_id', 'org-1')
    calls = []
    patchStatus = 200
    stubFetch((url, init) => {
      const method = (init?.method ?? 'GET').toUpperCase()
      if (method === 'GET') return json(200, { items: [user(disabled)], nextCursor: null })
      calls.push({ url, method, body: String(init?.body ?? ''), keepalive: init?.keepalive, org: new Headers(init?.headers).get('X-Active-Org-Id') })
      if (patchStatus !== 200) return json(patchStatus, { error: { code: 'boom', message: 'Cannot disable the last admin.' } })
      const sent = JSON.parse(String(init?.body ?? '{}')) as { disabled?: boolean }
      return json(200, { item: { ...user(Boolean(sent.disabled)) } })
    })
    const wrapper = mount(AdminUsersView)
    await flushPromises()
    return wrapper
  }

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] })
  })

  afterEach(() => {
    window.dispatchEvent(new Event('pagehide'))
    useToast().toasts.value = []
    vi.useRealTimers()
  })

  it('disabling an account applies immediately and shows an Undo toast without a confirm dialog', async () => {
    const wrapper = await mountUsers()
    await wrapper.get('button[aria-label="Disable bo@apc.edu.ph"]').trigger('click')
    await flushPromises()
    expect(confirm).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain('Disabled')
    expect(wrapper.find('button[aria-label="Enable bo@apc.edu.ph"]').exists()).toBe(true)
    const toast = useToast().toasts.value.find((t) => t.message === 'bo@apc.edu.ph disabled.')
    expect(toast?.action?.label).toBe('Undo')
    expect(calls).toEqual([])
  })

  it('undo restores the account and sends no request', async () => {
    const wrapper = await mountUsers()
    await wrapper.get('button[aria-label="Disable bo@apc.edu.ph"]').trigger('click')
    useToast().toasts.value.find((t) => t.message === 'bo@apc.edu.ph disabled.')!.action!.onClick()
    await vi.advanceTimersByTimeAsync(10_000)
    await flushPromises()
    expect(wrapper.text()).toContain('Active')
    expect(wrapper.find('button[aria-label="Disable bo@apc.edu.ph"]').exists()).toBe(true)
    expect(calls).toEqual([])
  })

  it('request fires after the window', async () => {
    const wrapper = await mountUsers()
    await wrapper.get('button[aria-label="Disable bo@apc.edu.ph"]').trigger('click')
    await vi.advanceTimersByTimeAsync(4_900)
    expect(calls).toEqual([])
    localStorage.setItem('active_org_id', 'org-2')
    await vi.advanceTimersByTimeAsync(200)
    await flushPromises()
    expect(calls).toEqual([{
      url: expect.stringContaining('/api/admin/users/u2'),
      method: 'PATCH',
      body: JSON.stringify({ disabled: true }),
      keepalive: true,
      org: 'org-1',
    }])
    expect(wrapper.text()).toContain('Disabled')
  })

  it('a failed commit reverts the row', async () => {
    const wrapper = await mountUsers()
    patchStatus = 409
    await wrapper.get('button[aria-label="Disable bo@apc.edu.ph"]').trigger('click')
    await vi.advanceTimersByTimeAsync(5_000)
    await flushPromises()
    expect(wrapper.text()).toContain('Active')
    expect(wrapper.find('button[aria-label="Disable bo@apc.edu.ph"]').exists()).toBe(true)
    const err = useToast().toasts.value.find((t) => t.type === 'error')
    expect(err?.detail).toBe('Cannot disable the last admin.')
  })

  it('locks the row controls while the disable waits out its window', async () => {
    const wrapper = await mountUsers()
    await wrapper.get('button[aria-label="Disable bo@apc.edu.ph"]').trigger('click')
    const buttons = wrapper.findAll('[data-admin-row] button')
    expect(buttons.length).toBeGreaterThan(0)
    for (const b of buttons) expect(b.attributes('disabled')).toBeDefined()
    await vi.advanceTimersByTimeAsync(5_000)
    await flushPromises()
    for (const b of wrapper.findAll('[data-admin-row] button')) expect(b.attributes('disabled')).toBeUndefined()
  })

  it('enabling still happens at once', async () => {
    const wrapper = await mountUsers(true)
    await wrapper.get('button[aria-label="Enable bo@apc.edu.ph"]').trigger('click')
    await flushPromises()
    expect(confirm).not.toHaveBeenCalled()
    expect(calls).toHaveLength(1)
    expect(calls[0]).toMatchObject({ method: 'PATCH', body: JSON.stringify({ disabled: false }) })
    expect(wrapper.text()).toContain('Active')
    expect(useToast().toasts.value.some((t) => t.message === 'bo@apc.edu.ph is enabled.')).toBe(true)
  })

  it('delete account keeps its confirm', async () => {
    const wrapper = await mountUsers()
    confirm.mockResolvedValue(false)
    await wrapper.get('button[aria-label="Delete bo@apc.edu.ph"]').trigger('click')
    await flushPromises()
    expect(confirm).toHaveBeenCalledTimes(1)
    expect(calls).toEqual([])
  })
})
