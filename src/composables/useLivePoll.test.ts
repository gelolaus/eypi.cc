// @vitest-environment happy-dom
import { effectScope } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useLivePoll } from './useLivePoll'

type Reply = { status: number; body?: unknown; etag?: string } | 'throw'
let replies: Reply[] = []
let calls: { ifNoneMatch: string | null }[] = []
let hidden = false
const fetchMock = vi.fn()

function setHidden(value: boolean) {
  hidden = value
  document.dispatchEvent(new Event('visibilitychange'))
}

function start<T>(url = '/api/x/live', ms = 5000) {
  const scope = effectScope()
  const poll = scope.run(() => useLivePoll<T>(url, ms))!
  return { poll, scope }
}

beforeEach(() => {
  vi.useFakeTimers()
  replies = []
  calls = []
  hidden = false
  Object.defineProperty(document, 'hidden', { configurable: true, get: () => hidden })
  fetchMock.mockReset()
  fetchMock.mockImplementation(async (_url: string, init?: RequestInit) => {
    calls.push({ ifNoneMatch: new Headers(init?.headers).get('If-None-Match') })
    const r = replies.shift() ?? { status: 304 }
    if (r === 'throw') throw new TypeError('offline')
    const headers = new Headers(r.etag ? { ETag: r.etag } : {})
    return r.status === 304 ? new Response(null, { status: 304, headers }) : new Response(JSON.stringify(r.body), { status: r.status, headers })
  })
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('useLivePoll', () => {
  it('fetches at once, then every interval, sending the last ETag', async () => {
    replies = [{ status: 200, body: { n: 1 }, etag: 'W/"a"' }]
    const { poll, scope } = start<{ n: number }>()
    await vi.advanceTimersByTimeAsync(0)
    expect(poll.data.value).toEqual({ n: 1 })
    expect(poll.lastUpdated.value).toBeInstanceOf(Date)
    await vi.advanceTimersByTimeAsync(5000)
    expect(calls.map((c) => c.ifNoneMatch)).toEqual([null, 'W/"a"'])
    scope.stop()
  })

  it('keeps the previous data on 304', async () => {
    replies = [{ status: 200, body: { n: 1 }, etag: 'W/"a"' }, { status: 304 }]
    const { poll, scope } = start<{ n: number }>()
    await vi.advanceTimersByTimeAsync(5000)
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(poll.data.value).toEqual({ n: 1 })
    scope.stop()
  })

  it('pauses while the tab is hidden and fetches at once when it is visible again', async () => {
    replies = [{ status: 200, body: { n: 1 }, etag: 'W/"a"' }]
    const { scope } = start()
    await vi.advanceTimersByTimeAsync(0)
    setHidden(true)
    await vi.advanceTimersByTimeAsync(60_000)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    setHidden(false)
    await vi.advanceTimersByTimeAsync(0)
    expect(fetchMock).toHaveBeenCalledTimes(2)
    await vi.advanceTimersByTimeAsync(5000)
    expect(fetchMock).toHaveBeenCalledTimes(3)
    scope.stop()
  })

  it('does not start while hidden at mount', async () => {
    hidden = true
    const { scope } = start()
    await vi.advanceTimersByTimeAsync(20_000)
    expect(fetchMock).not.toHaveBeenCalled()
    scope.stop()
  })

  it('stops polling and removes its listener on dispose', async () => {
    const { scope } = start()
    await vi.advanceTimersByTimeAsync(0)
    scope.stop()
    await vi.advanceTimersByTimeAsync(30_000)
    setHidden(true)
    setHidden(false)
    await vi.advanceTimersByTimeAsync(0)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('never overlaps requests', async () => {
    let release: (r: Response) => void = () => undefined
    fetchMock.mockReset()
    fetchMock.mockImplementation(() => new Promise<Response>((resolve) => { release = resolve }))
    const { scope } = start()
    await vi.advanceTimersByTimeAsync(0)
    setHidden(true)
    setHidden(false)
    await vi.advanceTimersByTimeAsync(30_000)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    release(new Response(null, { status: 304 }))
    await vi.advanceTimersByTimeAsync(5000)
    expect(fetchMock).toHaveBeenCalledTimes(2)
    scope.stop()
  })

  it('keeps data and backs off quietly when requests fail', async () => {
    replies = [{ status: 200, body: { n: 1 }, etag: 'W/"a"' }, 'throw', { status: 500, body: {} }]
    const { poll, scope } = start<{ n: number }>()
    await vi.advanceTimersByTimeAsync(0)
    await vi.advanceTimersByTimeAsync(5000)
    expect(fetchMock).toHaveBeenCalledTimes(2)
    await vi.advanceTimersByTimeAsync(5000)
    expect(fetchMock).toHaveBeenCalledTimes(2)
    await vi.advanceTimersByTimeAsync(5000)
    expect(fetchMock).toHaveBeenCalledTimes(3)
    expect(poll.data.value).toEqual({ n: 1 })
    scope.stop()
  })
})
