// @vitest-environment happy-dom
import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import LiveClicks from './LiveClicks.vue'

afterEach(() => vi.unstubAllGlobals())

describe('LiveClicks', () => {
  it('shows the sparkline total and recent clicks as time, country and app', async () => {
    const last60 = new Array<number>(60).fill(0)
    last60[59] = 3
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({
      last60,
      recent: [{ at: '2026-10-28T03:04:00Z', country: 'PH', app: 'messenger' }, { at: '2026-10-28T03:00:00Z', country: null, app: null }],
    }), { status: 200, headers: { ETag: 'W/"x"' } })))
    const wrapper = mount(LiveClicks)
    await flushPromises()
    expect(wrapper.text()).toContain('Clicks in the last 60 minutes')
    expect(wrapper.text()).toContain('3 clicks')
    expect(wrapper.text()).toContain('PH · Messenger')
    expect(wrapper.text()).toContain('Unknown')
    wrapper.unmount()
  })

  it('keeps showing the loading line when the payload has no click series', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 200, headers: { 'Content-Type': 'application/json' } })))
    const errors: unknown[] = []
    const onRejection = (e: unknown) => errors.push(e)
    process.on('unhandledRejection', onRejection)
    const wrapper = mount(LiveClicks)
    await flushPromises()
    expect(wrapper.text()).toContain('Loading live clicks')
    expect(errors).toEqual([])
    process.off('unhandledRejection', onRejection)
    wrapper.unmount()
  })
})
