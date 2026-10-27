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
})
