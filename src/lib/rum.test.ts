// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { API_BASE_URL } from '@/config/api'

type Cb = (m: { name: string; value: number; rating: string; navigationType: string }) => void
const callbacks: Record<string, Cb> = {}
vi.mock('web-vitals', () => {
  const reg = (name: string) => (cb: Cb) => { callbacks[name] = cb }
  return { onLCP: reg('LCP'), onINP: reg('INP'), onCLS: reg('CLS'), onFCP: reg('FCP'), onTTFB: reg('TTFB') }
})

import { deviceClass, RUM_SAMPLE_RATE, startRum } from './rum'

const always = () => 0

function fakeRouter(name: string | undefined) {
  const hooks: Array<() => void> = []
  const currentRoute = { value: { name, fullPath: '/links?token=secret', path: '/links' } as { name?: string; fullPath: string; path: string } }
  let ready!: () => void
  const readyPromise = new Promise<void>((resolve) => { ready = resolve })
  return {
    router: {
      currentRoute,
      isReady: () => readyPromise,
      afterEach: (fn: () => void) => { hooks.push(fn) },
    } as never,
    hooks,
    resolve: (route: string) => { currentRoute.value.name = route; ready() },
  }
}

describe('deviceClass', () => {
  it.each([
    [375, true, 'mobile'],
    [767, false, 'mobile'],
    [768, true, 'tablet'],
    [1023, true, 'tablet'],
    [1023, false, 'desktop'],
    [1024, true, 'desktop'],
    [1920, false, 'desktop'],
  ] as const)('%i wide, coarse=%s -> %s', (w, coarse, expected) => {
    expect(deviceClass(w, coarse)).toBe(expected)
  })
})

describe('startRum', () => {
  beforeEach(() => { for (const k of Object.keys(callbacks)) delete callbacks[k] })
  afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks() })

  it('flushes one batch on visibilitychange hidden', () => {
    vi.stubEnv('PROD', true)
    const send = vi.fn(() => true)
    const { router } = fakeRouter('links')
    startRum(router, send, always)
    callbacks.LCP({ name: 'LCP', value: 1200, rating: 'good', navigationType: 'navigate' })
    callbacks.CLS({ name: 'CLS', value: 0.02, rating: 'good', navigationType: 'navigate' })
    expect(send).not.toHaveBeenCalled()

    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true })
    document.dispatchEvent(new Event('visibilitychange'))

    expect(send).toHaveBeenCalledTimes(1)
    const [url, body] = send.mock.calls[0] as unknown as [string, string]
    expect(url).toBe(`${API_BASE_URL}/api/rum`)
    const parsed = JSON.parse(body)
    const samples = Array.isArray(parsed) ? parsed : parsed.samples
    expect(samples).toHaveLength(2)
    expect(samples[0].route).toBe('links')
    expect(body).not.toContain('/links')
    expect(body).not.toContain('secret')

    document.dispatchEvent(new Event('visibilitychange'))
    expect(send).toHaveBeenCalledTimes(1)
  })

  it('does nothing in dev', () => {
    vi.stubEnv('PROD', false)
    const add = vi.spyOn(document, 'addEventListener')
    const send = vi.fn(() => true)
    const { router, hooks } = fakeRouter('links')
    startRum(router, send, always)
    expect(add).not.toHaveBeenCalled()
    expect(hooks).toHaveLength(0)
    expect(Object.keys(callbacks)).toHaveLength(0)
  })

  it('keeps vitals that fire before the first route resolves', async () => {
    vi.stubEnv('PROD', true)
    const send = vi.fn(() => true)
    const { router, resolve } = fakeRouter(undefined)
    startRum(router, send, always)
    callbacks.FCP({ name: 'FCP', value: 800, rating: 'good', navigationType: 'navigate' })
    resolve('links')
    await Promise.resolve()
    await Promise.resolve()
    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true })
    document.dispatchEvent(new Event('visibilitychange'))
    expect(send).toHaveBeenCalledTimes(1)
    const samples = JSON.parse((send.mock.calls[0] as unknown as [string, string])[1])
    expect(samples).toHaveLength(1)
    expect(samples[0].route).toBe('links')
  })

  it('samples a share of page loads, decided once before listeners register', () => {
    vi.stubEnv('PROD', true)
    const { router, hooks } = fakeRouter('links')
    startRum(router, vi.fn(() => true), () => RUM_SAMPLE_RATE)
    expect(Object.keys(callbacks)).toHaveLength(0)
    expect(hooks).toHaveLength(0)
    startRum(router, vi.fn(() => true), () => RUM_SAMPLE_RATE - 0.01)
    expect(Object.keys(callbacks)).toHaveLength(5)
  })
})
