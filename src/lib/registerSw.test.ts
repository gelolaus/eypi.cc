// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { clearTicketsCache, registerSw } from './registerSw'

const register = vi.fn(() => Promise.resolve({}))

beforeEach(() => {
  register.mockClear()
  Object.defineProperty(navigator, 'serviceWorker', { value: { register }, configurable: true })
  vi.stubGlobal('requestIdleCallback', (cb: () => void) => { cb(); return 1 })
})
afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

describe('registerSw', () => {
  it('does nothing outside production', () => {
    vi.stubEnv('PROD', false)
    Object.defineProperty(document, 'readyState', { value: 'complete', configurable: true })
    registerSw()
    expect(register).not.toHaveBeenCalled()
  })

  it('registers /sw.js in production once the page has loaded', () => {
    vi.stubEnv('PROD', true)
    Object.defineProperty(document, 'readyState', { value: 'loading', configurable: true })
    registerSw()
    expect(register).not.toHaveBeenCalled()
    window.dispatchEvent(new Event('load'))
    expect(register).toHaveBeenCalledWith('/sw.js')
  })

  it('registers right away when the page already loaded', () => {
    vi.stubEnv('PROD', true)
    Object.defineProperty(document, 'readyState', { value: 'complete', configurable: true })
    registerSw()
    expect(register).toHaveBeenCalledWith('/sw.js')
  })
})

describe('clearTicketsCache', () => {
  it('deletes the tickets cache and tolerates a missing Cache API', async () => {
    const del = vi.fn(async () => true)
    vi.stubGlobal('caches', { delete: del })
    await clearTicketsCache()
    expect(del).toHaveBeenCalledWith('eypi-tickets-v1')
    vi.stubGlobal('caches', undefined)
    await expect(clearTicketsCache()).resolves.toBeUndefined()
  })
})
