// @vitest-environment happy-dom
import { effectScope, nextTick } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { clearQueryCache, invalidate, prefetchQuery, useQuery } from './queryCache'

function inScope<T>(fn: () => T): T {
  return effectScope().run(fn) as T
}

beforeEach(() => {
  vi.useFakeTimers()
  clearQueryCache()
})
afterEach(() => vi.useRealTimers())

describe('useQuery epoch', () => {
  it('restarts the load when the cache is cleared mid-flight', async () => {
    let release!: (v: string) => void
    const fetcher = vi.fn()
      .mockImplementationOnce(() => new Promise<string>((r) => { release = r }))
      .mockResolvedValueOnce('fresh')
    const q = inScope(() => useQuery('epoch:1', fetcher))
    expect(q.status.value).toBe('loading')
    clearQueryCache()
    release('stale')
    await vi.advanceTimersByTimeAsync(0)
    expect(fetcher).toHaveBeenCalledTimes(2)
    expect(q.status.value).toBe('ready')
    expect(q.data.value).toBe('fresh')
  })
})

describe('useQuery', () => {
  it('returns cached data immediately and refreshes when stale', async () => {
    const fetcher = vi.fn().mockResolvedValueOnce('one').mockResolvedValueOnce('two')
    const first = inScope(() => useQuery('a:1', fetcher))
    expect(first.status.value).toBe('loading')
    await vi.advanceTimersByTimeAsync(0)
    expect(first.data.value).toBe('one')

    // fresh: served from cache, no request
    const fresh = inScope(() => useQuery('a:1', fetcher))
    expect(fresh.data.value).toBe('one')
    expect(fresh.status.value).toBe('ready')
    expect(fetcher).toHaveBeenCalledTimes(1)

    vi.advanceTimersByTime(30_001)
    const stale = inScope(() => useQuery('a:1', fetcher))
    expect(stale.data.value).toBe('one')
    expect(stale.status.value).toBe('ready')
    await vi.advanceTimersByTimeAsync(0)
    expect(fetcher).toHaveBeenCalledTimes(2)
    expect(stale.data.value).toBe('two')
  })

  it('dedupes in-flight requests', async () => {
    const fetcher = vi.fn(() => new Promise<string>((r) => setTimeout(() => r('x'), 10)))
    const a = inScope(() => useQuery('d:1', fetcher))
    const b = inScope(() => useQuery('d:1', fetcher))
    await vi.advanceTimersByTimeAsync(10)
    expect(fetcher).toHaveBeenCalledTimes(1)
    expect(a.data.value).toBe('x')
    expect(b.data.value).toBe('x')
  })

  it("invalidate('links:') refetches links keys only", async () => {
    const links = vi.fn().mockResolvedValue('l')
    const orgs = vi.fn().mockResolvedValue('o')
    const q = inScope(() => useQuery('links:list', links))
    inScope(() => useQuery('orgs:catalog', orgs))
    await vi.advanceTimersByTimeAsync(0)
    invalidate('links:')
    await vi.advanceTimersByTimeAsync(0)
    expect(links).toHaveBeenCalledTimes(2)
    expect(orgs).toHaveBeenCalledTimes(1)
    expect(q.data.value).toBe('l')
  })

  it('invalidate drops inactive links entries so the next use refetches', async () => {
    const links = vi.fn().mockResolvedValue('l')
    await prefetchQuery('links:summary', links)
    invalidate('links:')
    inScope(() => useQuery('links:summary', links))
    await vi.advanceTimersByTimeAsync(0)
    expect(links).toHaveBeenCalledTimes(2)
  })

  it('clearQueryCache empties everything', async () => {
    const fetcher = vi.fn().mockResolvedValue('v')
    await prefetchQuery('c:1', fetcher)
    clearQueryCache()
    const q = inScope(() => useQuery('c:1', fetcher))
    expect(q.data.value).toBeUndefined()
    expect(q.status.value).toBe('loading')
    await vi.advanceTimersByTimeAsync(0)
    expect(fetcher).toHaveBeenCalledTimes(2)
  })

  it('discards a response that resolves after the cache was cleared', async () => {
    let resolve!: (v: string) => void
    const slow = () => new Promise<string>((r) => { resolve = r })
    const q = inScope(() => useQuery('s:1', slow))
    clearQueryCache()
    resolve('previous user')
    await vi.advanceTimersByTimeAsync(0)
    expect(q.data.value).toBeUndefined()
    const next = inScope(() => useQuery('s:1', async () => 'new user'))
    expect(next.data.value).toBeUndefined()
  })

  it('refetches when a reactive key changes and exposes errors', async () => {
    const { ref } = await import('vue')
    const org = ref('a')
    const fetcher = vi.fn(async () => { if (org.value === 'b') throw new Error('boom'); return org.value })
    const q = inScope(() => useQuery(() => `e:${org.value}`, fetcher))
    await vi.advanceTimersByTimeAsync(0)
    expect(q.data.value).toBe('a')
    org.value = 'b'
    await nextTick()
    await vi.advanceTimersByTimeAsync(0)
    expect(q.data.value).toBeUndefined()
    expect(q.status.value).toBe('error')
    expect((q.error.value as Error).message).toBe('boom')
  })
})

describe('stale responses', () => {
  it('keeps newer data when an older request resolves after invalidate', async () => {
    const resolvers: Array<(v: string) => void> = []
    const fetcher = vi.fn(() => new Promise<string>((r) => resolvers.push(r)))
    const q = inScope(() => useQuery('links:race', fetcher))
    invalidate('links:')
    expect(fetcher).toHaveBeenCalledTimes(2)
    resolvers[1]('new')
    await vi.advanceTimersByTimeAsync(0)
    resolvers[0]('old')
    await vi.advanceTimersByTimeAsync(0)
    expect(q.data.value).toBe('new')
    const again = inScope(() => useQuery('links:race', fetcher))
    expect(again.data.value).toBe('new')
  })
})
