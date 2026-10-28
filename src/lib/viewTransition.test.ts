// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { withViewTransition } from './viewTransition'

type Doc = { startViewTransition?: unknown }

function transition() {
  return {
    skipTransition: vi.fn(),
    ready: Promise.resolve(),
    finished: Promise.resolve(),
    updateCallbackDone: Promise.resolve(),
  }
}

function mockMotion(reduce: boolean) {
  vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: reduce })))
}

describe('withViewTransition', () => {
  beforeEach(() => mockMotion(false))
  afterEach(() => {
    delete (document as Doc).startViewTransition
    vi.unstubAllGlobals()
  })

  it('runs the update inside startViewTransition when available', async () => {
    const start = vi.fn((cb: () => Promise<void>) => {
      void cb()
      return transition()
    })
    ;(document as Doc).startViewTransition = start
    const update = vi.fn()
    await withViewTransition(update)
    expect(start).toHaveBeenCalledTimes(1)
    expect(update).toHaveBeenCalledTimes(1)
  })

  it('runs the update directly when the API is absent', async () => {
    const update = vi.fn()
    await withViewTransition(update)
    expect(update).toHaveBeenCalledTimes(1)
  })

  it('skips the transition under prefers-reduced-motion', async () => {
    mockMotion(true)
    const start = vi.fn()
    ;(document as Doc).startViewTransition = start
    const update = vi.fn()
    await withViewTransition(update)
    expect(start).not.toHaveBeenCalled()
    expect(update).toHaveBeenCalledTimes(1)
  })

  it('propagates update errors with and without the API', async () => {
    await expect(withViewTransition(() => { throw new Error('plain') })).rejects.toThrow('plain')
    ;(document as Doc).startViewTransition = (cb: () => Promise<void>) => {
      void cb()
      return transition()
    }
    await expect(withViewTransition(async () => { throw new Error('animated') })).rejects.toThrow('animated')
  })

  it('skips the previous transition while it is still running when a new one starts', async () => {
    const first = { ...transition(), finished: new Promise<void>(() => {}) }
    const second = transition()
    const queue = [first, second]
    ;(document as Doc).startViewTransition = (cb: () => Promise<void>) => {
      void cb()
      return queue.shift()
    }
    await withViewTransition(() => {})
    await withViewTransition(() => {})
    expect(first.skipTransition).toHaveBeenCalledTimes(1)
    expect(second.skipTransition).not.toHaveBeenCalled()
  })
})

describe('withViewTransition edge cases', () => {
  afterEach(() => {
    delete (document as Doc).startViewTransition
    vi.unstubAllGlobals()
  })

  it('animates when matchMedia is absent', async () => {
    vi.stubGlobal('matchMedia', undefined)
    const start = vi.fn((cb: () => Promise<void>) => { void cb(); return transition() })
    ;(document as Doc).startViewTransition = start
    await withViewTransition(() => {})
    expect(start).toHaveBeenCalledTimes(1)
  })

  it('rejects when startViewTransition throws synchronously', async () => {
    vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: false })))
    ;(document as Doc).startViewTransition = () => { throw new Error('sync') }
    await expect(withViewTransition(() => {})).rejects.toThrow('sync')
  })
})
