// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { isChunkLoadError, reloadOnceForChunkError } from '@/lib/chunkReload'

const assign = vi.fn()

beforeEach(() => {
  sessionStorage.clear()
  assign.mockReset()
  vi.stubGlobal('location', { assign, href: 'http://localhost:5173/dashboard' })
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('chunk reload', () => {
  it('recognizes a failed dynamic import', () => {
    expect(isChunkLoadError(new TypeError('Failed to fetch dynamically imported module'))).toBe(true)
    expect(isChunkLoadError(new TypeError('Failed to fetch'))).toBe(false)
  })

  it('reloads once per target path', () => {
    const err = new TypeError('Failed to fetch dynamically imported module')

    expect(reloadOnceForChunkError(err, '/links')).toBe(true)
    expect(sessionStorage.getItem('eypi_chunk_reload:/links')).toBe('1')
    expect(assign).toHaveBeenCalledTimes(1)
    expect(assign).toHaveBeenCalledWith('/links')

    expect(reloadOnceForChunkError(err, '/links')).toBe(false)
    expect(assign).toHaveBeenCalledTimes(1)

    expect(reloadOnceForChunkError(err, '/forms')).toBe(true)
    expect(sessionStorage.getItem('eypi_chunk_reload:/forms')).toBe('1')
    expect(assign).toHaveBeenCalledTimes(2)
    expect(assign).toHaveBeenLastCalledWith('/forms')
  })
})
