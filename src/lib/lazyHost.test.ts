// @vitest-environment happy-dom
import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, type Component } from 'vue'
import { lazyHost } from './lazyHost'

const assign = vi.fn()

const Loaded: Component = () => h('p', { 'data-loaded': '' }, 'Loaded')

function chunkError() {
  return new TypeError('Failed to fetch dynamically imported module')
}

function mountLazy(load: () => Promise<Component>) {
  const Host = lazyHost(load)
  return mount(defineComponent({ render: () => h(Host) }), {
    global: { config: { errorHandler: () => {} } },
  })
}

beforeEach(() => {
  sessionStorage.clear()
  assign.mockReset()
  vi.stubGlobal('location', { assign, pathname: '/links', search: '?tab=all' })
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('lazyHost', () => {
  it('retries a failed chunk load once and recovers', async () => {
    const load = vi.fn()
      .mockRejectedValueOnce(chunkError())
      .mockResolvedValueOnce({ __esModule: true, default: Loaded })
    const wrapper = mountLazy(load)

    await flushPromises()
    await flushPromises()

    expect(load).toHaveBeenCalledTimes(2)
    expect(wrapper.find('[data-loaded]').exists()).toBe(true)
    expect(assign).not.toHaveBeenCalled()
    wrapper.unmount()
  })

  it('reloads the current page once when the retry also fails', async () => {
    const load = vi.fn(async () => { throw chunkError() })
    const wrapper = mountLazy(load)

    await flushPromises()
    await flushPromises()

    expect(load).toHaveBeenCalledTimes(2)
    expect(assign).toHaveBeenCalledTimes(1)
    expect(assign).toHaveBeenCalledWith('/links?tab=all')
    wrapper.unmount()
  })

  it('does not loop when the page already reloaded for this path', async () => {
    sessionStorage.setItem('eypi_chunk_reload:/links?tab=all', '1')
    const load = vi.fn(async () => { throw chunkError() })
    const wrapper = mountLazy(load)

    await flushPromises()
    await flushPromises()

    expect(load).toHaveBeenCalledTimes(2)
    expect(assign).not.toHaveBeenCalled()
    wrapper.unmount()
  })
})
