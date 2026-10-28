// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'
import { routeTransitions } from './viewTransition'

type Doc = { startViewTransition?: unknown }
const C = { template: '<div />' }
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

let released: boolean[]
let start: ReturnType<typeof vi.fn>

// Like the real API: the callback runs later, not inside startViewTransition.
function mockApi() {
  released = []
  start = vi.fn((cb: () => Promise<void>) => {
    const i = released.push(false) - 1
    const p = new Promise<void>((r) => setTimeout(() => { void cb().then(() => { released[i] = true; r() }) }, 0))
    return { skipTransition: vi.fn(), ready: p, finished: p, updateCallbackDone: p }
  })
  ;(document as Doc).startViewTransition = start
}

async function makeRouter() {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: ['/', '/a', '/b', '/c', '/err', '/slow'].map((path) => ({ path, component: C })),
  })
  routeTransitions(router)
  router.beforeResolve(async (to) => {
    if (to.path === '/c') return false
    if (to.path === '/err') throw new Error('guard failed')
    if (to.path === '/slow') await sleep(30)
  })
  router.onError(() => {})
  await router.push('/')
  return router
}

describe('routeTransitions', () => {
  beforeEach(() => {
    vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: false })))
    mockApi()
  })
  afterEach(() => {
    delete (document as Doc).startViewTransition
    vi.unstubAllGlobals()
    vi.useRealTimers()
  })

  it('does not animate the first load', async () => {
    await makeRouter()
    expect(start).not.toHaveBeenCalled()
  })

  it('animates a navigation and releases it after the render', async () => {
    const router = await makeRouter()
    await router.push('/a')
    expect(start).toHaveBeenCalledTimes(1)
    await vi.waitFor(() => expect(released).toEqual([true]))
  })

  it('ignores same-path, query-only and hash-only navigations', async () => {
    const router = await makeRouter()
    await router.push('/a')
    await vi.waitFor(() => expect(released).toEqual([true]))
    await router.push('/a?x=1')
    await router.push('/a?x=1#h')
    await router.push('/a?x=1#h')
    expect(start).toHaveBeenCalledTimes(1)
  })

  it('releases when the navigation is cancelled by a later guard', async () => {
    const router = await makeRouter()
    await router.push('/c')
    expect(start).toHaveBeenCalledTimes(1)
    await vi.waitFor(() => expect(released).toEqual([true]))
  })

  it('releases when navigation errors', async () => {
    const router = await makeRouter()
    await router.push('/err').catch(() => {})
    await vi.waitFor(() => expect(released).toEqual([true]))
  })

  it('releases every navigation in an A-then-B race', async () => {
    const router = await makeRouter()
    const a = router.push('/slow')
    await vi.waitFor(() => expect(start).toHaveBeenCalledTimes(1))
    const b = router.push('/b')
    await Promise.all([a, b])
    await vi.waitFor(() => expect(released).toEqual([true, true]))
    expect(router.currentRoute.value.path).toBe('/b')
  })

  it('still navigates when startViewTransition throws', async () => {
    const router = await makeRouter()
    ;(document as Doc).startViewTransition = () => { throw new Error('boom') }
    await router.push('/a')
    expect(router.currentRoute.value.path).toBe('/a')
  })

  it('does not wait forever for a callback the browser never runs', async () => {
    const router = await makeRouter()
    ;(document as Doc).startViewTransition = () => ({
      skipTransition() {}, ready: new Promise(() => {}), finished: new Promise(() => {}), updateCallbackDone: new Promise(() => {}),
    })
    vi.useFakeTimers()
    const nav = router.push('/a')
    await vi.advanceTimersByTimeAsync(1100)
    await nav
    expect(router.currentRoute.value.path).toBe('/a')
  })

  it('does not animate under reduced motion', async () => {
    vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: true })))
    const router = await makeRouter()
    await router.push('/a')
    expect(start).not.toHaveBeenCalled()
    expect(router.currentRoute.value.path).toBe('/a')
  })
})
