// @vitest-environment happy-dom
import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const makeVariants = vi.fn()
vi.mock('@/lib/images/variants', () => ({ makeVariants: (...a: unknown[]) => makeVariants(...a) }))

import AdminMaintenanceView from './AdminMaintenanceView.vue'

const items = [
  { key: 'orgs/a/logo-0123abcd.png', profile: 'orgLogo' },
  { key: 'orgs/b/banner-0123abcd.png', profile: 'banner' },
  { key: 'frames/c/f-0123abcd.png', profile: 'frame' },
]

type Handler = (url: string, init?: RequestInit) => Response | Promise<Response>

function stubFetch(handler: Handler) {
  const calls: { url: string; method: string }[] = []
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input)
    calls.push({ url, method: init?.method ?? 'GET' })
    return handler(url, init)
  }))
  return calls
}

const jsonRes = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...headers } })

beforeEach(() => {
  makeVariants.mockReset()
  makeVariants.mockResolvedValue({
    meta: { w: 800, h: 400, fmt: 'webp', widths: [96], ph: 'data:image/webp;base64,AAAA' },
    variants: [{ width: 96, dataUrl: 'data:image/webp;base64,AAAA' }],
  })
})
afterEach(() => vi.unstubAllGlobals())

async function run(wrapper: ReturnType<typeof mount>) {
  await wrapper.find('button').trigger('click')
  await vi.waitFor(() => expect(wrapper.get('[data-testid="progress"]').text()).toContain('Done'))
}

describe('AdminMaintenanceView', () => {
  it('processes items one at a time, fetching originals from /media and putting variants', async () => {
    let active = 0
    let maxActive = 0
    const calls = stubFetch(async (url) => {
      if (url.endsWith('/api/admin/media/pending')) return jsonRes({ items })
      if (url.startsWith('/media/')) {
        active += 1
        maxActive = Math.max(maxActive, active)
        await Promise.resolve()
        active -= 1
        return new Response(new Blob(['x'], { type: 'image/png' }))
      }
      return jsonRes({ meta: {} })
    })
    const wrapper = mount(AdminMaintenanceView, { props: { paceMs: 0 } })
    await flushPromises()
    expect(wrapper.get('[data-testid="progress"]').text()).toContain('3 images')
    await run(wrapper)
    expect(maxActive).toBe(1)
    expect(calls.filter((c) => c.url.startsWith('/media/')).map((c) => c.url)).toEqual(items.map((i) => `/media/${i.key}`))
    expect(calls.filter((c) => c.method === 'PUT')).toHaveLength(3)
    expect(makeVariants.mock.calls.map((c) => c[1])).toEqual(['orgLogo', 'banner', 'frame'])
    expect(wrapper.get('[data-testid="progress"]').text()).toContain('3 of 3 optimized')
  })

  it('shows n of m while running', async () => {
    let release: () => void = () => {}
    const gate = new Promise<void>((r) => { release = r })
    stubFetch(async (url) => {
      if (url.endsWith('/api/admin/media/pending')) return jsonRes({ items })
      if (url.startsWith('/media/')) { await gate; return new Response(new Blob(['x'])) }
      return jsonRes({ meta: {} })
    })
    const wrapper = mount(AdminMaintenanceView, { props: { paceMs: 0 } })
    await flushPromises()
    await wrapper.find('button').trigger('click')
    await flushPromises()
    expect(wrapper.get('[data-testid="progress"]').text()).toBe('1 of 3')
    release()
    await vi.waitFor(() => expect(wrapper.get('[data-testid="progress"]').text()).toContain('Done'))
  })

  it('continues after a failure and lists the failed keys', async () => {
    stubFetch((url) => {
      if (url.endsWith('/api/admin/media/pending')) return jsonRes({ items })
      if (url === `/media/${items[1].key}`) return new Response('nope', { status: 404 })
      if (url.startsWith('/media/')) return new Response(new Blob(['x']))
      return jsonRes({ meta: {} })
    })
    const wrapper = mount(AdminMaintenanceView, { props: { paceMs: 0 } })
    await flushPromises()
    await run(wrapper)
    expect(wrapper.get('[data-testid="failed"]').text()).toContain(items[1].key)
    expect(wrapper.get('[data-testid="failed"]').text()).not.toContain(items[0].key)
    expect(wrapper.get('[data-testid="progress"]').text()).toContain('2 of 3 optimized, 1 failed')
  })

  it('backs off and retries when the API answers 429', async () => {
    let puts = 0
    const calls = stubFetch((url, init) => {
      if (url.endsWith('/api/admin/media/pending')) return jsonRes({ items: [items[0]] })
      if (url.startsWith('/media/')) return new Response(new Blob(['x']))
      if (init?.method === 'PUT') {
        puts += 1
        return puts === 1
          ? jsonRes({ error: { code: 'rate_limited', message: 'slow' } }, 429)
          : jsonRes({ meta: {} })
      }
      return jsonRes({})
    })
    const wrapper = mount(AdminMaintenanceView, { props: { paceMs: 0, backoffMs: 1 } })
    await flushPromises()
    await run(wrapper)
    expect(calls.filter((c) => c.method === 'PUT')).toHaveLength(2)
    expect(wrapper.find('[data-testid="failed"]').exists()).toBe(false)
    expect(wrapper.get('[data-testid="progress"]').text()).toContain('1 of 1 optimized')
  })

  it('paces items by default so 30 uploads a minute is never exceeded', async () => {
    vi.useFakeTimers()
    try {
      const calls = stubFetch((url) => {
        if (url.endsWith('/api/admin/media/pending')) return jsonRes({ items })
        if (url.startsWith('/media/')) return new Response(new Blob(['x']))
        return jsonRes({ meta: {} })
      })
      const wrapper = mount(AdminMaintenanceView)
      await vi.advanceTimersByTimeAsync(0)
      await wrapper.find('button').trigger('click')
      await vi.advanceTimersByTimeAsync(100)
      expect(calls.filter((c) => c.method === 'PUT')).toHaveLength(1)
      await vi.advanceTimersByTimeAsync(2500)
      expect(calls.filter((c) => c.method === 'PUT')).toHaveLength(2)
      await vi.advanceTimersByTimeAsync(2500)
      expect(calls.filter((c) => c.method === 'PUT')).toHaveLength(3)
    } finally {
      vi.useRealTimers()
    }
  })

  it('says so when nothing needs optimizing', async () => {
    stubFetch(() => jsonRes({ items: [] }))
    const wrapper = mount(AdminMaintenanceView)
    await flushPromises()
    expect(wrapper.text()).toContain('already optimized')
    expect(wrapper.find('button').exists()).toBe(false)
  })

  it('re-reads the pending list on start so Run again only does what is left', async () => {
    let pendingCalls = 0
    const calls = stubFetch((url) => {
      if (url.endsWith('/api/admin/media/pending')) {
        pendingCalls += 1
        return jsonRes({ items: pendingCalls === 1 ? items : [items[2]] })
      }
      if (url.startsWith('/media/')) return new Response(new Blob(['x']))
      return jsonRes({ meta: {} })
    })
    const wrapper = mount(AdminMaintenanceView, { props: { paceMs: 0 } })
    await flushPromises()
    await run(wrapper)
    expect(pendingCalls).toBe(2)
    expect(calls.filter((c) => c.method === 'PUT')).toHaveLength(1)
    expect(wrapper.get('[data-testid="progress"]').text()).toContain('1 of 1 optimized')
  })

  it('keeps backing off for longer than the 60 s rate-limit window', async () => {
    vi.useFakeTimers()
    try {
      const calls = stubFetch((url, init) => {
        if (url.endsWith('/api/admin/media/pending')) return jsonRes({ items: [items[0]] })
        if (url.startsWith('/media/')) return new Response(new Blob(['x']))
        if (init?.method === 'PUT') return jsonRes({ error: { code: 'rate_limited', message: 'slow' } }, 429)
        return jsonRes({})
      })
      const wrapper = mount(AdminMaintenanceView)
      await vi.advanceTimersByTimeAsync(0)
      await wrapper.find('button').trigger('click')
      await vi.advanceTimersByTimeAsync(61_000)
      expect(wrapper.find('[data-testid="failed"]').exists()).toBe(false)
      await vi.advanceTimersByTimeAsync(30_000)
      expect(wrapper.find('[data-testid="failed"]').exists()).toBe(true)
      expect(calls.filter((c) => c.method === 'PUT')).toHaveLength(5)
    } finally {
      vi.useRealTimers()
    }
  })
})
