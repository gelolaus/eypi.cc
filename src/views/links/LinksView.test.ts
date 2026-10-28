// @vitest-environment happy-dom
import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useToast } from '@/composables/useToast'
import LinksView from './LinksView.vue'

const { push, replace, route, confirm, analytics } = vi.hoisted(() => {
  const push = vi.fn()
  const replace = vi.fn()
  const confirm = vi.fn(async () => false)
  const route = {
    fullPath: '/links',
    name: 'links',
    query: {} as Record<string, unknown>,
    params: {},
  }
  const analytics = { loaded: false }
  return { push, replace, route, confirm, analytics }
})

vi.mock('@/router', () => ({
  default: {
    push,
    replace,
    currentRoute: { value: route },
  },
}))

vi.mock('vue-router', () => ({
  useRouter: () => ({
    push,
    replace,
  }),
  useRoute: () => route,
}))

vi.mock('@/composables/useDialog', () => ({
  useDialog: () => ({
    confirm,
    info: vi.fn(),
  }),
}))

vi.mock('@/components/AnalyticsPanel.vue', () => {
  analytics.loaded = true
  return {
    default: {
      name: 'AnalyticsPanel',
      props: ['linkId', 'isOpen', 'shortUrl'],
      template: '<div data-testid="analytics-panel" />',
    },
  }
})

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function requestUrl(input: RequestInfo | URL): string {
  if (typeof input === 'string') return input
  if (input instanceof URL) return input.toString()
  return input.url
}

const sampleLink = {
  id: 'link-1',
  slug: 'alpha',
  url: 'https://example.com/a',
  clicks: 3,
  createdAt: '2026-10-01T00:00:00.000Z',
  expiresAt: null,
  disabledAt: null,
  disabledReason: null,
  protected: false,
  hasLogo: false,
}

beforeEach(() => {
  localStorage.clear()
  push.mockReset()
  replace.mockReset()
  confirm.mockReset()
  confirm.mockResolvedValue(false)
  route.query = {}
  route.fullPath = '/links'
  vi.stubGlobal('fetch', vi.fn(async () => json(401, {
    error: { code: 'unauthorized', message: 'Sign in to continue.' },
  })))
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('LinksView session expiry', () => {
  it('does not replace the login route that already carries returnTo', async () => {
    mount(LinksView)
    await flushPromises()

    expect(push).toHaveBeenCalledWith({
      name: 'login',
      query: { returnTo: '/links' },
    })
    expect(push.mock.calls.some((call) => call[0] === '/login')).toBe(false)
  })
})

describe('LinksView empty state', () => {
  it('shows one create action and opens the editor', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => json(200, { items: [], nextCursor: null })))

    const wrapper = mount(LinksView)
    await flushPromises()

    const empty = wrapper.get('[data-empty-state]')
    expect(empty.text()).toContain('No links yet')
    const actions = empty.findAll('a, button')
    expect(actions).toHaveLength(1)
    expect(actions[0].text()).toBe('Create a link')
    expect(wrapper.find('[aria-busy="true"]').exists()).toBe(false)

    await actions[0].trigger('click')
    expect(document.querySelector('#link-editor')).toBeTruthy()
    wrapper.unmount()
  })
})

describe('LinksView create and analytics', () => {
  it('prefills ?url= and does not create a link', async () => {
    const calls: Array<{ url: string; method: string }> = []
    route.query = { url: 'https://example.com/landing' }
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const method = init?.method ?? 'GET'
      calls.push({ url: requestUrl(input), method })
      return json(200, { items: [], nextCursor: null, links: [] })
    }))

    const wrapper = mount(LinksView)
    await flushPromises()

    const values = [...document.querySelectorAll('input')].map((input) => (input as HTMLInputElement).value)
    expect(values).toContain('https://example.com/landing')
    expect(calls.filter((call) => call.method === 'POST')).toEqual([])
    wrapper.unmount()
  })

  it('loads the analytics panel only when it opens', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => json(200, {
      items: [sampleLink],
      links: [{ id: 'link-1', original: 'https://example.com/a', short: 'eypi.cc/alpha', clicks: 3 }],
      nextCursor: null,
    })))

    const wrapper = mount(LinksView)
    await flushPromises()

    expect(analytics.loaded).toBe(false)
    expect(document.querySelector('[data-testid="analytics-panel"]')).toBeNull()

    await wrapper.get('[aria-label="Analytics"]').trigger('click')
    await flushPromises()

    expect(analytics.loaded).toBe(true)
    expect(document.querySelector('[data-testid="analytics-panel"]')).toBeTruthy()
    wrapper.unmount()
  })

  it('asks to delete the selected count before a bulk delete', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => json(200, {
      items: [
        sampleLink,
        { ...sampleLink, id: 'link-2', slug: 'beta', url: 'https://example.com/b' },
      ],
      nextCursor: null,
    })))
    confirm.mockResolvedValue(false)

    const wrapper = mount(LinksView)
    await flushPromises()
    await wrapper.get('[aria-label="Select alpha"]').setValue(true)
    await wrapper.get('[aria-label="Select beta"]').setValue(true)
    await wrapper.get('[aria-label="Delete selected"]').trigger('click')

    expect(confirm).toHaveBeenCalledWith(expect.objectContaining({
      title: 'Delete 2 links?',
    }))
    wrapper.unmount()
  })

  it('renders the open analytics dialog on document.body', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => json(200, {
      items: [sampleLink],
      nextCursor: null,
    })))

    const wrapper = mount(LinksView, { attachTo: document.body })
    await flushPromises()
    await wrapper.get('[aria-label="Analytics"]').trigger('click')
    await flushPromises()

    const dialog = document.querySelector('[data-testid="analytics-panel"]')
    expect(dialog).toBeTruthy()
    expect(dialog?.parentElement).toBe(document.body)
    expect(wrapper.element.contains(dialog)).toBe(false)
    wrapper.unmount()
  })
})

describe('LinksView mobile layout', () => {
  it('uses AppPage without a nested main and a sticky bulk bar above the tab bar', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => json(200, { items: [sampleLink], nextCursor: null })))
    const wrapper = mount(LinksView)
    await flushPromises()

    expect(wrapper.find('main').exists()).toBe(false)
    expect(wrapper.find('[data-app-page]').exists()).toBe(true)
    expect(wrapper.get('input#link-search').classes()).toContain('h-11')

    await wrapper.get('[aria-label="Select alpha"]').setValue(true)
    const bar = wrapper.get('[data-bulk-bar]')
    expect(bar.classes()).toContain('sticky')
    expect(bar.classes()).toContain('bottom-[calc(4.5rem+env(safe-area-inset-bottom))]')
    expect(bar.classes()).toContain('lg:bottom-0')
    // sticky only pins within its parent, so it must follow the list it overlays
    const list = wrapper.get('[aria-label="Select alpha"]').element
    expect(list.compareDocumentPosition(bar.element) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    // keep the actions clear of the floating back-to-top button
    expect(bar.classes()).toContain('pr-20')
    wrapper.unmount()
  })
})

describe('LinksView undo', () => {
  const beta = { ...sampleLink, id: 'link-2', slug: 'beta', url: 'https://example.com/b' }
  let writes: Array<{ url: string; method: string; headers: Headers; keepalive?: boolean }>

  function installList() {
    writes = []
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const method = init?.method ?? 'GET'
      if (method !== 'GET') {
        writes.push({ url: requestUrl(input), method, headers: new Headers(init?.headers), keepalive: init?.keepalive })
        return json(200, {})
      }
      return json(200, { items: [sampleLink, beta], nextCursor: null })
    }))
  }

  async function mountList() {
    installList()
    const wrapper = mount(LinksView)
    await flushPromises()
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] })
    return wrapper
  }

  function undo(message: string) {
    const toast = useToast().toasts.value.find((t) => t.message === message)
    expect(toast?.action?.label).toBe('Undo')
    toast!.action!.onClick()
  }

  afterEach(() => {
    window.dispatchEvent(new Event('pagehide'))
    useToast().toasts.value = []
    vi.useRealTimers()
  })

  it('deletes without a confirm, hides the row, and sends the DELETE after 5 s', async () => {
    const wrapper = await mountList()
    await wrapper.findAll('[aria-label="Delete"]')[0].trigger('click')

    expect(confirm).not.toHaveBeenCalled()
    expect(wrapper.text()).not.toContain('alpha')
    expect(writes).toEqual([])
    await vi.advanceTimersByTimeAsync(5_000)
    expect(writes).toHaveLength(1)
    expect(writes[0]).toMatchObject({ method: 'DELETE', keepalive: true })
    expect(writes[0].url).toContain('/api/links/link-1')
    wrapper.unmount()
  })

  it('Undo brings the row back and nothing is sent', async () => {
    const wrapper = await mountList()
    await wrapper.findAll('[aria-label="Delete"]')[0].trigger('click')
    undo('Link deleted.')
    await vi.advanceTimersByTimeAsync(10_000)
    await flushPromises()

    expect(wrapper.text()).toContain('alpha')
    expect(writes).toEqual([])
    wrapper.unmount()
  })

  it('keeps overlapping deletes independent', async () => {
    const wrapper = await mountList()
    await wrapper.findAll('[aria-label="Delete"]')[0].trigger('click')
    await wrapper.findAll('[aria-label="Delete"]')[0].trigger('click')
    expect(wrapper.text()).not.toContain('alpha')
    expect(wrapper.text()).not.toContain('beta')

    const toasts = useToast().toasts.value.filter((t) => t.message === 'Link deleted.')
    expect(toasts).toHaveLength(2)
    toasts[0].action!.onClick()
    await flushPromises()
    expect(wrapper.text()).toContain('alpha')
    expect(wrapper.text()).not.toContain('beta')

    toasts[1].action!.onClick()
    await flushPromises()
    expect(wrapper.text()).toContain('alpha')
    expect(wrapper.text()).toContain('beta')
    wrapper.unmount()
  })

  it('undoing an earlier disable does not bring back a link deleted since', async () => {
    const wrapper = await mountList()
    const disabledBefore = wrapper.text().split('Disabled').length
    await wrapper.get('[aria-label="Select beta"]').setValue(true)
    await wrapper.get('[aria-label="Disable selected"]').trigger('click')
    await wrapper.findAll('[aria-label="Delete"]')[0].trigger('click')
    expect(wrapper.text().split('Disabled').length).toBeGreaterThan(disabledBefore)
    undo('Link disabled.')
    await flushPromises()

    expect(wrapper.text()).not.toContain('alpha')
    expect(wrapper.text()).toContain('beta')
    expect(wrapper.text().split('Disabled').length).toBe(disabledBefore)
    wrapper.unmount()
  })

  it('Undo after an org switch does not put the row into the other org list', async () => {
    localStorage.setItem('active_org_id', 'org-1')
    const wrapper = await mountList()
    await wrapper.findAll('[aria-label="Delete"]')[0].trigger('click')
    localStorage.setItem('active_org_id', 'org-2')
    undo('Link deleted.')
    await flushPromises()

    expect(wrapper.text()).not.toContain('alpha')
    wrapper.unmount()
  })

  it('Undo of a disable after an org switch leaves the other org list alone', async () => {
    localStorage.setItem('active_org_id', 'org-1')
    const wrapper = await mountList()
    const disabledBefore = wrapper.text().split('Disabled').length
    await wrapper.get('[aria-label="Select beta"]').setValue(true)
    await wrapper.get('[aria-label="Disable selected"]').trigger('click')
    localStorage.setItem('active_org_id', 'org-2')
    undo('Link disabled.')
    await flushPromises()

    // revert was skipped, so the optimistic state is untouched in this list
    expect(wrapper.text().split('Disabled').length).toBeGreaterThan(disabledBefore)
    wrapper.unmount()
  })

  it('sends the delete to the org that was active when it started', async () => {
    localStorage.setItem('active_org_id', 'org-1')
    const wrapper = await mountList()
    await wrapper.findAll('[aria-label="Delete"]')[0].trigger('click')
    localStorage.setItem('active_org_id', 'org-2')
    await vi.advanceTimersByTimeAsync(5_000)

    expect(writes[0].headers.get('X-Active-Org-Id')).toBe('org-1')
    wrapper.unmount()
  })
})
