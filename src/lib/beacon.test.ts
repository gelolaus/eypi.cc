// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { API_BASE_URL } from '@/config/api'
import { sendModuleBeacon } from './beacon'

describe('sendModuleBeacon', () => {
  beforeEach(() => { vi.stubEnv('PROD', true) })
  afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals() })

  it('posts a text body with sendBeacon', () => {
    const sendBeacon = vi.fn(() => true)
    vi.stubGlobal('navigator', { sendBeacon })
    sendModuleBeacon('frames', 'c1:f1', 'download')
    expect(sendBeacon).toHaveBeenCalledWith(`${API_BASE_URL}/api/beacon`, JSON.stringify({ module: 'frames', subjectId: 'c1:f1', action: 'download' }))
  })

  it('falls back to fetch keepalive when sendBeacon is refused', () => {
    vi.stubGlobal('navigator', { sendBeacon: () => false })
    const fetchMock = vi.fn(() => Promise.resolve(new Response(null, { status: 204 })))
    vi.stubGlobal('fetch', fetchMock)
    sendModuleBeacon('org', 'acme', 'view')
    expect(fetchMock).toHaveBeenCalledWith(`${API_BASE_URL}/api/beacon`, expect.objectContaining({ method: 'POST', keepalive: true, credentials: 'omit' }))
  })

  it('swallows every failure', () => {
    vi.stubGlobal('navigator', { sendBeacon: () => { throw new Error('boom') } })
    expect(() => sendModuleBeacon('org', 'acme', 'view')).not.toThrow()
    vi.stubGlobal('navigator', { sendBeacon: () => false })
    vi.stubGlobal('fetch', () => Promise.reject(new Error('offline')))
    expect(() => sendModuleBeacon('org', 'acme', 'view')).not.toThrow()
  })

  it('sends nothing outside production builds', () => {
    vi.stubEnv('PROD', false)
    const sendBeacon = vi.fn(() => true)
    vi.stubGlobal('navigator', { sendBeacon })
    sendModuleBeacon('org', 'acme', 'view')
    expect(sendBeacon).not.toHaveBeenCalled()
  })
})
