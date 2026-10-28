// @vitest-environment happy-dom
import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import AdminSpeedView from './AdminSpeedView.vue'

const payload = {
  thresholds: { LCP: [2500, 4000], INP: [200, 500], CLS: [0.1, 0.25], FCP: [1800, 3000], TTFB: [800, 1800] },
  rows: [
    { route: '/', metric: 'LCP', device: 'mobile', p75: 3000, samples: 10 },
    { route: '/', metric: 'INP', device: 'mobile', p75: 100, samples: 10 },
    { route: '/', metric: 'CLS', device: 'mobile', p75: 0.05, samples: 10 },
    { route: '/', metric: 'FCP', device: 'mobile', p75: 1000, samples: 10 },
    { route: '/', metric: 'TTFB', device: 'mobile', p75: 500, samples: 10 },
  ],
  trend: [
    { metric: 'LCP', day: '2026-10-26', p75: 2800 },
    { metric: 'LCP', day: '2026-10-27', p75: 3000 },
  ],
}

afterEach(() => vi.unstubAllGlobals())

describe('AdminSpeedView', () => {
  it('renders one tile per metric and flags values above the good threshold in text', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(payload), {
      headers: { 'Content-Type': 'application/json' },
    })))
    const wrapper = mount(AdminSpeedView)
    await flushPromises()
    const tiles = wrapper.findAll('[data-testid="speed-tile"]')
    expect(tiles).toHaveLength(5)
    const lcp = tiles.find((t) => t.text().includes('LCP'))!
    expect(lcp.text()).toContain('Needs work')
    const inp = tiles.find((t) => t.text().includes('INP'))!
    expect(inp.text()).not.toContain('Needs work')
    expect(inp.text()).toContain('Good')
  })

  it('requests the chosen window and ignores a stale response', async () => {
    const urls: string[] = []
    const resolvers: Array<(r: Response) => void> = []
    vi.stubGlobal('fetch', vi.fn((input: RequestInfo | URL) => {
      urls.push(String(input))
      return new Promise<Response>((resolve) => { resolvers.push(resolve) })
    }))
    const stale = { ...payload, rows: [{ route: '/stale', metric: 'LCP', device: 'mobile', p75: 1, samples: 1 }] }
    const answer = (body: unknown) => new Response(JSON.stringify(body), { headers: { 'Content-Type': 'application/json' } })
    const wrapper = mount(AdminSpeedView)
    await flushPromises()
    await wrapper.findAll('button').find((b) => b.text().includes('28'))!.trigger('click')
    await flushPromises()
    expect(urls[0]).toContain('days=7')
    expect(urls[1]).toContain('days=28')
    resolvers[1](answer(payload))
    await flushPromises()
    resolvers[0](answer(stale))
    await flushPromises()
    expect(wrapper.text()).not.toContain('/stale')
    expect(wrapper.findAll('[data-testid="speed-tile"]')).toHaveLength(5)
  })

  it('clears old data when a reload fails', async () => {
    let fail = false
    vi.stubGlobal('fetch', vi.fn(async () => (fail
      ? new Response('{}', { status: 500, headers: { 'Content-Type': 'application/json' } })
      : new Response(JSON.stringify(payload), { headers: { 'Content-Type': 'application/json' } }))))
    const wrapper = mount(AdminSpeedView)
    await flushPromises()
    expect(wrapper.findAll('[data-testid="speed-tile"]')).toHaveLength(5)
    fail = true
    await wrapper.findAll('button').find((b) => b.text().includes('28'))!.trigger('click')
    await flushPromises()
    expect(wrapper.findAll('[data-testid="speed-tile"]')).toHaveLength(0)
    expect(wrapper.text()).toContain('Could not load speed data')
  })

  it('shows the shared empty state when the period has no samples', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({
      thresholds: payload.thresholds,
      rows: [],
      trend: [],
    }), { headers: { 'Content-Type': 'application/json' } })))
    const wrapper = mount(AdminSpeedView)
    await flushPromises()

    const empty = wrapper.get('[data-empty-state]')
    expect(empty.text()).toContain('No speed data yet')
    expect(empty.findAll('a, button')).toHaveLength(0)
    expect(wrapper.find('[aria-busy="true"]').exists()).toBe(false)
  })
})
