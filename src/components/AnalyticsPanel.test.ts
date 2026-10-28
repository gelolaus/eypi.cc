// @vitest-environment happy-dom
import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import AnalyticsPanel from './AnalyticsPanel.vue'
import source from './AnalyticsPanel.vue?raw'
import BarList from './charts/BarList.vue'
import LineChart from './charts/LineChart.vue'
import StatTile from './charts/StatTile.vue'

const heat = new Array<number>(168).fill(0)
heat[15] = 9

const payload = {
  totals: { clicks: 42, avgDailyUniques: 3.5, qrShare: 7 / 42 },
  timeline: [{ day: '2026-10-26', clicks: 4, uniques: 10 }],
  heat,
  top: {
    referrer: [{ value: 'Campus mail', clicks: 5 }],
    app: [],
    country: [{ value: 'PH', clicks: 6 }],
    device: [],
    browser: [],
    os: [{ value: 'Windows', clicks: 8 }],
  },
}

function requestUrl(input: RequestInfo | URL): string {
  if (typeof input === 'string') return input
  if (input instanceof URL) return input.toString()
  return input.url
}

describe('AnalyticsPanel', () => {
  const fetchMock = vi.fn()

  beforeEach(() => {
    fetchMock.mockReset()
    fetchMock.mockImplementation(async () => new Response(JSON.stringify(payload), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }))
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('reads totals, ranked lists, and peak hour from the analytics payload', async () => {
    const wrapper = mount(AnalyticsPanel, {
      props: { linkId: 'link-1', isOpen: true, shortUrl: 'eypi.cc/alpha' },
      attachTo: document.body,
    })
    await flushPromises()

    const text = document.body.textContent ?? ''
    expect(text).toContain('42')
    expect(text).toContain('10')
    expect(text).toContain('Campus mail')
    expect(text).toContain('PH')
    expect(text).toContain('Windows')
    expect(text).toContain('Busiest hour: 3:00 PM')
    expect(text).not.toContain('🔥')
    expect(requestUrl(fetchMock.mock.calls[0][0])).toContain('/api/links/link-1/analytics?range=30')
    wrapper.unmount()
  })

  it('requests a 7 day range when that range is selected', async () => {
    const wrapper = mount(AnalyticsPanel, {
      props: { linkId: 'link-1', isOpen: true, shortUrl: 'eypi.cc/alpha' },
      attachTo: document.body,
    })
    await flushPromises()
    const button = document.querySelector('[aria-label="Last 7 days"]')
    expect(button).toBeTruthy()
    button!.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await flushPromises()

    const urls = fetchMock.mock.calls.map((call) => requestUrl(call[0]))
    expect(urls.some((url) => url.includes('range=7'))).toBe(true)
    wrapper.unmount()
  })

  it('renders timeline with LineChart and top lists with BarList', async () => {
    const wrapper = mount(AnalyticsPanel, {
      props: { linkId: 'link-1', isOpen: true, shortUrl: 'eypi.cc/alpha' },
      attachTo: document.body,
    })
    await flushPromises()
    const line = wrapper.findComponent(LineChart)
    expect(line.exists()).toBe(true)
    expect(line.props('series')).toEqual([{ label: 'Clicks', points: [{ x: '2026-10-26', y: 4 }] }])
    const bars = wrapper.findAllComponents(BarList)
    expect(bars).toHaveLength(3)
    expect(bars[0]!.props('items')).toEqual([{ label: 'Windows', value: 8 }])
    expect(bars[1]!.props('items')).toEqual([{ label: 'PH', value: 6 }])
    expect(bars[2]!.props('items')).toEqual([{ label: 'Campus mail', value: 5 }])
    const tiles = wrapper.findAllComponents(StatTile).map((t) => [t.props('label'), t.props('value')])
    expect(tiles).toEqual([['Total', '42'], ['Avg daily uniques', '3.5'], ['QR scans', '7'], ['Direct', '35']])
    wrapper.unmount()
  })

  it('shows No data for empty top lists', async () => {
    fetchMock.mockImplementation(async () => new Response(JSON.stringify({
      ...payload, top: { ...payload.top, os: [], country: [], referrer: [] },
    }), { status: 200, headers: { 'Content-Type': 'application/json' } }))
    const wrapper = mount(AnalyticsPanel, {
      props: { linkId: 'link-1', isOpen: true, shortUrl: 'eypi.cc/alpha' },
      attachTo: document.body,
    })
    await flushPromises()
    expect(wrapper.findAllComponents(BarList)).toHaveLength(0)
    expect((document.body.textContent ?? '').match(/No data/g)).toHaveLength(3)
    wrapper.unmount()
  })

  it('has no chart.js import', () => {
    expect(source).not.toMatch(/chart\.js|vue-chartjs/)
  })
})
