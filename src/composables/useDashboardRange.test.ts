// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

async function load() {
  vi.resetModules()
  return import('./useDashboardRange')
}

beforeEach(() => {
  sessionStorage.clear()
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('useDashboardRange', () => {
  it('defaults to 30', async () => {
    const { useDashboardRange } = await load()
    expect(useDashboardRange().range.value).toBe(30)
  })

  it('writes the chosen range to sessionStorage', async () => {
    const { useDashboardRange } = await load()
    useDashboardRange().setRange(7)
    expect(sessionStorage.getItem('eypi.dashboardRange')).toBe('7')
    expect(useDashboardRange().range.value).toBe(7)
  })

  it('falls back to 30 when sessionStorage throws', async () => {
    const boom = () => { throw new Error('blocked') }
    vi.stubGlobal('sessionStorage', { getItem: boom, setItem: boom, removeItem: boom, clear: boom, key: boom, length: 0 })
    const { useDashboardRange } = await load()
    expect(() => useDashboardRange().setRange(90)).not.toThrow()
    expect(useDashboardRange().range.value).toBe(90)
    const again = await load()
    expect(again.useDashboardRange().range.value).toBe(30)
  })

  it('reads a stored 90 on a fresh module load', async () => {
    sessionStorage.setItem('eypi.dashboardRange', '90')
    const { useDashboardRange } = await load()
    expect(useDashboardRange().range.value).toBe(90)
  })

  it('ignores an invalid stored value', async () => {
    sessionStorage.setItem('eypi.dashboardRange', '14')
    const { useDashboardRange } = await load()
    expect(useDashboardRange().range.value).toBe(30)
  })
})