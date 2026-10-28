// @vitest-environment happy-dom
import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import LiveStats from './LiveStats.vue'

const stats = {
  users: 1234, orgs: 5, members: 6, links: 7, clicks: 8, events: 9, tickets: 10, checkIns: 11, frames: 12, frameDownloads: 13,
}

function stubFetch(impl: () => Promise<Response>) {
  vi.stubGlobal('fetch', vi.fn(impl))
}

afterEach(() => vi.unstubAllGlobals())

describe('LiveStats', () => {
  it('shows a busy skeleton while loading', () => {
    stubFetch(() => new Promise<Response>(() => {}))
    const wrapper = mount(LiveStats)
    expect(wrapper.find('[aria-busy="true"]').exists()).toBe(true)
    expect(wrapper.findAll('dd')).toHaveLength(0)
  })

  it('reserves a fixed height per tile before /api/stats resolves', async () => {
    stubFetch(async () => new Response(JSON.stringify(stats), { headers: { 'Content-Type': 'application/json' } }))
    const wrapper = mount(LiveStats)
    const placeholders = wrapper.findAll('[aria-hidden="true"].animate-pulse')
    expect(placeholders).toHaveLength(10)
    for (const placeholder of placeholders) expect(placeholder.classes()).toContain('h-10')
    await flushPromises()
    for (const value of wrapper.findAll('dd')) expect(value.classes()).toContain('h-10')
  })

  it('renders ten formatted tiles on success', async () => {
    stubFetch(async () => new Response(JSON.stringify(stats), { headers: { 'Content-Type': 'application/json' } }))
    const wrapper = mount(LiveStats)
    await flushPromises()
    const tiles = wrapper.findAll('dd')
    expect(tiles).toHaveLength(10)
    expect(tiles[0].text()).toBe('1,234')
    expect(tiles[0].classes()).toContain('tabular-nums')
    expect(wrapper.get('dl').attributes('aria-label')).toBe('Platform totals')
  })

  it('hides tiles whose value is zero', async () => {
    stubFetch(async () => new Response(JSON.stringify({ ...stats, orgs: 0, checkIns: 0 }), { headers: { 'Content-Type': 'application/json' } }))
    const wrapper = mount(LiveStats)
    await flushPromises()
    expect(wrapper.findAll('dd')).toHaveLength(8)
    expect(wrapper.text()).not.toContain('Orgs')
    expect(wrapper.text()).not.toContain('Check-ins')
  })

  it('renders nothing when every metric is zero', async () => {
    const zeros = Object.fromEntries(Object.keys(stats).map(key => [key, 0]))
    stubFetch(async () => new Response(JSON.stringify(zeros), { headers: { 'Content-Type': 'application/json' } }))
    const wrapper = mount(LiveStats)
    await flushPromises()
    expect(wrapper.find('section').exists()).toBe(false)
    expect(wrapper.findAll('dd')).toHaveLength(0)
  })

  it('shows the unavailable text, not zeros, when the request is not ok', async () => {
    stubFetch(async () => new Response('{}', { status: 500 }))
    const wrapper = mount(LiveStats)
    await flushPromises()
    expect(wrapper.text()).toContain('Stats are unavailable right now.')
    expect(wrapper.findAll('dd')).toHaveLength(0)
  })

  it('shows the unavailable text when fetch rejects', async () => {
    stubFetch(async () => { throw new Error('offline') })
    const wrapper = mount(LiveStats)
    await flushPromises()
    expect(wrapper.text()).toContain('Stats are unavailable right now.')
  })
})
