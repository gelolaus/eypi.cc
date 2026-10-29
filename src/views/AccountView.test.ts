// @vitest-environment happy-dom
import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import SiteNavSheet from '@/components/layout/SiteNavSheet.vue'
import { useNavDrawer } from '@/composables/useNavDrawer'
import router from '@/router'
import { useSession } from '@/stores/session'
import AccountView from './AccountView.vue'

const fetchMock = vi.fn()

const sessions = [
  {
    id: 'session-current',
    device: 'Chrome on Windows',
    lastSeenAt: '2026-01-15T16:05:00.000Z',
    expiresAt: '2099-01-01T00:00:00.000Z',
    current: true,
  },
  {
    id: 'session-other',
    device: 'Firefox on macOS',
    lastSeenAt: '2026-01-14T02:00:00.000Z',
    expiresAt: '2099-01-01T00:00:00.000Z',
    current: false,
  },
]

let sessionRows = sessions.map((session) => ({ ...session }))
let deleteStatus = 204
let deleteBody: unknown = null
let signedIn = true

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function installFetch() {
  fetchMock.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input)
    const method = (init?.method ?? 'GET').toUpperCase()
    if (url.includes('/api/me')) {
      if (!signedIn) {
        return jsonResponse(401, { error: { code: 'unauthorized', message: 'Sign in to continue.' } })
      }
      return jsonResponse(200, {
        user: {
          id: 'ada-id',
          email: 'ada@apc.edu.ph',
          name: 'Ada Lovelace',
          role: 'user',
        },
        pendingInviteCount: 0,
        needsConsent: [],
        orgs: [],
      })
    }
    if (url.includes('/api/account/export.json')) {
      return new Response('{}', {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Content-Disposition': 'attachment; filename="eypi-data-2026-10-26.json"',
        },
      })
    }
    if (url.includes('/api/links/export.csv')) {
      return new Response('slug\n', {
        status: 200,
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': 'attachment; filename="links.csv"',
        },
      })
    }
    if (url.includes('/api/account/sessions/revoke-all') && method === 'POST') {
      signedIn = false
      sessionRows = []
      return new Response(null, { status: 204 })
    }
    if (url.includes('/api/account/sessions/') && method === 'DELETE') {
      const id = url.split('/api/account/sessions/')[1]
      const row = sessionRows.find((session) => session.id === id)
      if (!row) {
        return jsonResponse(404, { error: { code: 'not_found', message: 'Not found' } })
      }
      sessionRows = sessionRows.filter((session) => session.id !== id)
      if (row.current) signedIn = false
      return new Response(null, { status: 204 })
    }
    if (url.includes('/api/account/sessions') && method === 'GET') {
      return jsonResponse(200, { sessions: sessionRows })
    }
    if (url.includes('/api/account') && method === 'DELETE') {
      if (deleteStatus === 204) signedIn = false
      if (deleteStatus === 204) return new Response(null, { status: 204 })
      return jsonResponse(deleteStatus, deleteBody)
    }
    return jsonResponse(401, { error: { code: 'unauthorized', message: 'Sign in to continue.' } })
  })
}

async function mountAccount() {
  if (router.currentRoute.value.fullPath !== '/contact') await router.push('/contact')
  await router.push('/account')
  await router.isReady()
  const wrapper = mount(AccountView, { global: { plugins: [router] } })
  await flushPromises()
  return wrapper
}

beforeEach(() => {
  sessionRows = sessions.map((session) => ({ ...session }))
  deleteStatus = 204
  deleteBody = null
  signedIn = true
  fetchMock.mockReset()
  installFetch()
  vi.stubGlobal('fetch', fetchMock)
  useSession().reset()
  URL.createObjectURL = vi.fn(() => 'blob:export')
  URL.revokeObjectURL = vi.fn()
})

describe('AccountView', () => {
  it('shows the read-only profile and Microsoft sign-in line', async () => {
    const wrapper = await mountAccount()

    expect(wrapper.text()).toContain('Ada Lovelace')
    expect(wrapper.text()).toContain('ada@apc.edu.ph')
    expect(wrapper.text()).toContain('User')
    expect(wrapper.text()).toContain('Signed in with Microsoft (APC)')
    expect(wrapper.findAll('input')).toHaveLength(1)
    expect(wrapper.text()).not.toMatch(/\p{Extended_Pictographic}/u)
  })

  it('lists sessions in Asia/Manila with a current marker, revoke, and sign out everywhere', async () => {
    const wrapper = await mountAccount()

    expect(wrapper.text()).toContain('Chrome on Windows')
    expect(wrapper.text()).toContain('Firefox on macOS')
    expect(wrapper.text()).toContain('2026-01-16 00:05')
    expect(wrapper.text()).toContain('Current')
    expect(wrapper.findAll('button').map((button) => button.text())).toContain('Revoke')
    expect(wrapper.findAll('button').map((button) => button.text())).toContain('Sign out everywhere')

    const other = wrapper.findAll('li').find((item) => item.text().includes('Firefox on macOS'))
    await other?.get('button').trigger('click')
    await flushPromises()

    expect(fetchMock.mock.calls.some((call) => {
      const init = call[1] as RequestInit | undefined
      return String(call[0]).includes('/api/account/sessions/session-other') && init?.method === 'DELETE'
    })).toBe(true)
    expect(wrapper.text()).not.toContain('Firefox on macOS')
    expect(wrapper.text()).toContain('Chrome on Windows')
  })

  it('signs out everywhere', async () => {
    const wrapper = await mountAccount()
    const button = wrapper.findAll('button').find((item) => item.text() === 'Sign out everywhere')
    await button?.trigger('click')
    await vi.waitFor(() => {
      expect(router.currentRoute.value.name).toBe('login')
    })
    expect(fetchMock.mock.calls.some((call) => {
      const init = call[1] as RequestInit | undefined
      return String(call[0]).includes('/api/account/sessions/revoke-all') && init?.method === 'POST'
    })).toBe(true)
  })

  it('downloads the JSON export and the existing links CSV', async () => {
    const downloads: string[] = []
    const original = document.createElement.bind(document)
    const create = vi.spyOn(document, 'createElement').mockImplementation((tagName: string, options?: ElementCreationOptions) => {
      const element = original(tagName, options)
      if (tagName.toLowerCase() === 'a') {
        element.click = () => {
          downloads.push((element as HTMLAnchorElement).download)
        }
      }
      return element
    })
    const wrapper = await mountAccount()

    const json = wrapper.findAll('button').find((item) => item.text() === 'Download my data (JSON)')
    const csv = wrapper.findAll('button').find((item) => item.text() === 'Download my links (CSV)')
    await json?.trigger('click')
    await csv?.trigger('click')
    await flushPromises()

    expect(downloads).toEqual(['eypi-data-2026-10-26.json', 'links.csv'])
    expect(fetchMock.mock.calls.some((call) => String(call[0]).includes('/api/account/export.json'))).toBe(true)
    expect(fetchMock.mock.calls.some((call) => String(call[0]).includes('/api/links/export.csv'))).toBe(true)
    create.mockRestore()
  })

  it('keeps delete disabled until the typed email matches, then lists owned orgs', async () => {
    deleteStatus = 409
    deleteBody = {
      error: {
        code: 'owns_org',
        message: 'Transfer ownership before deleting your account.',
      },
      orgs: [
        { id: 'org-1', name: 'Alpha' },
        { id: 'org-2', name: 'Beta' },
      ],
    }
    const wrapper = await mountAccount()
    const button = wrapper.findAll('button').find((item) => item.text() === 'Delete account')
    const input = wrapper.get('input')
    expect((button?.element as HTMLButtonElement).disabled).toBe(true)

    await input.setValue('other@apc.edu.ph')
    expect((button?.element as HTMLButtonElement).disabled).toBe(true)

    await input.setValue('  ADA@apc.edu.ph  ')
    expect((button?.element as HTMLButtonElement).disabled).toBe(false)

    await wrapper.get('form').trigger('submit')
    await flushPromises()

    expect(wrapper.get('[role="alert"]').text()).toContain('Transfer ownership before deleting your account.')
    expect(wrapper.get('a[href="/orgs/modify/org-1"]').text()).toBe('Alpha')
    expect(wrapper.get('a[href="/orgs/modify/org-2"]').text()).toBe('Beta')
  })

  it('shows other delete errors inline', async () => {
    deleteStatus = 500
    deleteBody = { error: { code: 'internal', message: 'Could not delete this account.' } }
    const wrapper = await mountAccount()
    await wrapper.get('input').setValue('ada@apc.edu.ph')
    await wrapper.get('form').trigger('submit')
    await flushPromises()

    expect(wrapper.get('[role="alert"]').text()).toBe('Could not delete this account.')
    expect(wrapper.find('a[href^="/orgs/modify/"]').exists()).toBe(false)
    expect(router.currentRoute.value.name).toBe('account')
  })
})

describe('account navigation', () => {
  it('points the sidebar at Account', async () => {
    useSession().user.value = { id: 'user-1', email: 'ada@apc.edu.ph', name: 'Ada', role: 'user', avatarIcon: null, avatarColor: null }
    const wrapper = mount(SiteNavSheet, {
      attachTo: document.body,
      global: { plugins: [router] },
    })
    useNavDrawer().open()
    await flushPromises()
    const link = document.querySelector('a[href="/account"]')
    expect(link?.textContent).toContain('Account')
    expect(document.querySelector('a[href="/settings"]')).toBeNull()
    useNavDrawer().close()
    wrapper.unmount()
  })
})
