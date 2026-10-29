// @vitest-environment happy-dom
import { mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'
import { vPrefetch, warmRoute } from './prefetch'
import { useSession } from '@/stores/session'
import { clearQueryCache, peekQuery } from '@/lib/queryCache'
import { prefetchDashboard, prefetchLinks, prefetchOrgsCatalog, linksListKey, linksListPath, ORGS_CATALOG_KEY, LINKS_SUMMARY_KEY } from '@/lib/queries'

const stub = { template: '<div />' }
const loadLinks = vi.fn(async () => stub)
const loadOrgs = vi.fn(async () => stub)
const data = vi.fn(async () => {})
const authData = vi.fn(async () => {})
const throwing = vi.fn((): Promise<void> => { throw new Error('sync') })

const router = createRouter({
  history: createMemoryHistory(),
  routes: [
    { path: '/', component: stub },
    { path: '/links', component: loadLinks, meta: { requiresAuth: true, prefetch: authData } },
    { path: '/orgs', component: loadOrgs, meta: { prefetch: data } },
    { path: '/boom', component: stub, meta: { prefetch: throwing } },
  ],
})

function mountLink(to: string) {
  const wrapper = mount({
    directives: { prefetch: vPrefetch },
    template: `<a v-prefetch="'${to}'" href="${to}">x</a>`,
  }, { global: { plugins: [router] } })
  return wrapper
}

const tick = () => new Promise((r) => setTimeout(r, 0))

beforeEach(() => {
  vi.clearAllMocks()
  useSession().user.value = null
})
afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
  Object.defineProperty(navigator, 'connection', { value: undefined, configurable: true })
})

describe('v-prefetch', () => {
  it('pointerenter loads the route component once', async () => {
    useSession().user.value = { id: 'u', email: 'a@b.c', name: 'A', role: 'user', avatarIcon: null, avatarColor: null }
    const w = mountLink('/links')
    await w.trigger('pointerenter')
    await w.trigger('focus')
    await w.trigger('pointerenter')
    await tick()
    expect(loadLinks).toHaveBeenCalledTimes(1)
    expect(authData).toHaveBeenCalledTimes(1)
    w.unmount()
  })

  it('visible for 1 s triggers on idle', async () => {
    vi.useFakeTimers()
    let cb: IntersectionObserverCallback = () => {}
    vi.stubGlobal('IntersectionObserver', class {
      constructor(c: IntersectionObserverCallback) { cb = c }
      observe() {}
      disconnect() {}
    })
    const idle = vi.fn((fn: () => void) => fn())
    vi.stubGlobal('requestIdleCallback', idle)
    const w = mountLink('/orgs')
    cb([{ isIntersecting: true } as IntersectionObserverEntry], {} as IntersectionObserver)
    await vi.advanceTimersByTimeAsync(999)
    expect(idle).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(2)
    expect(idle).toHaveBeenCalledTimes(1)
    expect(loadOrgs).toHaveBeenCalledTimes(1)
    expect(data).toHaveBeenCalledTimes(1)
    w.unmount()
  })

  it('does not warm if it leaves view before 1 s', async () => {
    vi.useFakeTimers()
    let cb: IntersectionObserverCallback = () => {}
    vi.stubGlobal('IntersectionObserver', class {
      constructor(c: IntersectionObserverCallback) { cb = c }
      observe() {}
      disconnect() {}
    })
    const w = mountLink('/orgs')
    cb([{ isIntersecting: true } as IntersectionObserverEntry], {} as IntersectionObserver)
    await vi.advanceTimersByTimeAsync(500)
    cb([{ isIntersecting: false } as IntersectionObserverEntry], {} as IntersectionObserver)
    await vi.advanceTimersByTimeAsync(2000)
    expect(data).not.toHaveBeenCalled()
    w.unmount()
  })

  it('survives a prefetch loader that throws synchronously', async () => {
    await expect(warmRoute(router, '/boom')).resolves.toBeUndefined()
    expect(throwing).toHaveBeenCalledTimes(1)
  })

  it('cancels a queued idle callback and pending timer on unmount', async () => {
    vi.useFakeTimers()
    let cb: IntersectionObserverCallback = () => {}
    vi.stubGlobal('IntersectionObserver', class {
      constructor(c: IntersectionObserverCallback) { cb = c }
      observe() {}
      disconnect() {}
    })
    const idle = vi.fn(() => 42)
    const cancel = vi.fn()
    vi.stubGlobal('requestIdleCallback', idle)
    vi.stubGlobal('cancelIdleCallback', cancel)
    const w = mountLink('/orgs')
    cb([{ isIntersecting: true } as IntersectionObserverEntry], {} as IntersectionObserver)
    await vi.advanceTimersByTimeAsync(1001)
    expect(idle).toHaveBeenCalledTimes(1)
    w.unmount()
    expect(cancel).toHaveBeenCalledWith(42)

    const w2 = mountLink('/orgs')
    cb([{ isIntersecting: true } as IntersectionObserverEntry], {} as IntersectionObserver)
    await vi.advanceTimersByTimeAsync(500)
    w2.unmount()
    await vi.advanceTimersByTimeAsync(2000)
    expect(idle).toHaveBeenCalledTimes(1)
  })

  it('saveData skips', async () => {
    Object.defineProperty(navigator, 'connection', { value: { saveData: true }, configurable: true })
    const w = mountLink('/orgs')
    await w.trigger('pointerenter')
    await tick()
    expect(data).not.toHaveBeenCalled()
    w.unmount()
  })

  it('never warms a protected route for a signed-out user', async () => {
    const w = mountLink('/links')
    await w.trigger('pointerenter')
    await tick()
    expect(loadLinks).not.toHaveBeenCalled()
    expect(authData).not.toHaveBeenCalled()
    w.unmount()
  })
})

describe('prefetch keys match the views', () => {
  const fetchMock = vi.fn()
  beforeEach(() => {
    clearQueryCache()
    localStorage.clear()
    fetchMock.mockReset()
    fetchMock.mockImplementation(async () => new Response(JSON.stringify({ items: [], orgs: [], count: 0 }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }))
    vi.stubGlobal('fetch', fetchMock)
  })

  it('links list is cached under the key useLinks reads', async () => {
    await prefetchLinks()
    expect(peekQuery(linksListKey(linksListPath()))).toBeDefined()
    expect(linksListKey(linksListPath())).toBe('links:list:/api/links')
  })

  it('orgs catalog and dashboard use the view keys', async () => {
    await prefetchOrgsCatalog()
    expect(peekQuery(ORGS_CATALOG_KEY)).toBeDefined()
    localStorage.setItem('active_org_id', 'jpcs')
    await prefetchDashboard()
    expect(peekQuery(LINKS_SUMMARY_KEY)).toBeDefined()
    expect(peekQuery('orgs:summary:jpcs')).toBeDefined()
  })
})
