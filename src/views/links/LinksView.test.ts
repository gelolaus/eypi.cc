// @vitest-environment happy-dom
import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
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
