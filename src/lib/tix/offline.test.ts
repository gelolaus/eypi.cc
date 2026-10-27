import { describe, expect, it } from 'vitest'
import { offlineBanner, readOfflineInfo } from './offline'

describe('readOfflineInfo', () => {
  it('is online without the header', () => {
    expect(readOfflineInfo(new Response('{}'))).toEqual({ offline: false, cachedAt: null })
  })

  it('reads the offline flag and the stored time', () => {
    const res = new Response('{}', { headers: { 'x-eypi-offline': '1', 'x-eypi-cached-at': String(Date.UTC(2026, 10, 10, 3, 30)) } })
    expect(readOfflineInfo(res)).toEqual({ offline: true, cachedAt: Date.UTC(2026, 10, 10, 3, 30) })
  })

  it('falls back to the date header', () => {
    const res = new Response('{}', { headers: { 'x-eypi-offline': '1', date: 'Tue, 10 Nov 2026 03:30:00 GMT' } })
    expect(readOfflineInfo(res).cachedAt).toBe(Date.UTC(2026, 10, 10, 3, 30))
  })
})

describe('offlineBanner', () => {
  it('shows the Manila time', () => {
    expect(offlineBanner({ offline: true, cachedAt: Date.UTC(2026, 10, 10, 3, 30) })).toBe('Offline — last updated 2026-11-10 11:30')
  })
  it('is empty when online', () => {
    expect(offlineBanner({ offline: false, cachedAt: null })).toBe('')
  })
})
