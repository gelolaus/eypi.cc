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
    const first = requestUrl(fetchMock.mock.calls[0][0])
    expect(first).toContain('/api/links/link-1/analytics?from=')
    expect(first).toMatch(/[?&]to=[0-9-]{10}/)
    expect(first).not.toContain('compare=1')
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
    const last = new URL(urls[urls.length - 1]!, 'http://x')
    const days = (Date.parse(last.searchParams.get('to')!) - Date.parse(last.searchParams.get('from')!)) / 86_400_000
    expect(days).toBe(6)
    wrapper.unmount()
  })

  it('sends custom from/to and rejects invalid ranges', async () => {
    const wrapper = mount(AnalyticsPanel, {
      props: { linkId: 'link-1', isOpen: true, shortUrl: 'eypi.cc/alpha' },
      attachTo: document.body,
    })
    await flushPromises()
    const set = async (label: string, value: string) => {
      const input = document.querySelector<HTMLInputElement>(`input[aria-label="${label}"]`)!
      input.value = value
      input.dispatchEvent(new Event('input', { bubbles: true }))
      await flushPromises()
    }
    await set('From date', '2026-10-01')
    await set('To date', '2026-10-10')
    const url = requestUrl(fetchMock.mock.calls[fetchMock.mock.calls.length - 1]![0])
    expect(url).toContain('from=2026-10-01')
    expect(url).toContain('to=2026-10-10')

    const before = fetchMock.mock.calls.length
    await set('From date', '2026-10-20')
    expect(fetchMock.mock.calls.length).toBe(before)
    expect(document.body.textContent).toContain('Start date must be on or before the end date')
    await set('From date', '2024-01-01')
    expect(fetchMock.mock.calls.length).toBe(before)
    expect(document.body.textContent).toContain('Range can be at most 400 days')
    await set('From date', '2026-10-01')
    const mid = fetchMock.mock.calls.length
    await set('To date', '2999-01-01')
    expect(fetchMock.mock.calls.length).toBe(mid)
    expect(document.body.textContent).toContain('End date cannot be in the future')
    wrapper.unmount()
  })

  async function mountComparing(body: unknown) {
    fetchMock.mockImplementation(async () => new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } }))
    const wrapper = mount(AnalyticsPanel, {
      props: { linkId: 'link-1', isOpen: true, shortUrl: 'eypi.cc/alpha' },
      attachTo: document.body,
    })
    await flushPromises()
    const toggle = document.querySelector<HTMLInputElement>('input[aria-label="Compare to previous period"]')!
    toggle.checked = true
    toggle.dispatchEvent(new Event('change', { bubbles: true }))
    await flushPromises()
    return wrapper
  }

  it('shows period deltas as text when comparing', async () => {
    const wrapper = await mountComparing({
      ...payload,
      totals: { clicks: 112, avgDailyUniques: 5, qrShare: 0.5 },
      previous: { totals: { clicks: 100, avgDailyUniques: 0, qrShare: 0.5 } },
    })
    expect(requestUrl(fetchMock.mock.calls[fetchMock.mock.calls.length - 1]![0])).toContain('compare=1')
    const deltas = wrapper.findAllComponents(StatTile).map((t) => t.props('delta'))
    expect(deltas[0]).toBeCloseTo(12)
    expect(deltas[1]).toBeNull()
    expect(document.body.textContent).toContain('+12%')
    expect(document.body.textContent).toContain('New')
    expect(document.body.textContent).not.toMatch(/NaN|Infinity/)
    wrapper.unmount()
  })

  it('shows decreases as negative percentages', async () => {
    const wrapper = await mountComparing({
      ...payload,
      totals: { clicks: 92, avgDailyUniques: 1, qrShare: 0 },
      previous: { totals: { clicks: 100, avgDailyUniques: 1, qrShare: 0 } },
    })
    expect(document.body.textContent).toContain('−8%')
    wrapper.unmount()
  })

  it('labels source apps with friendly names', async () => {
    fetchMock.mockImplementation(async () => new Response(JSON.stringify({
      ...payload, top: { ...payload.top, app: [{ value: 'messenger', clicks: 3 }, { value: 'tiktok', clicks: 2 }, { value: 'Unknown', clicks: 1 }] },
    }), { status: 200, headers: { 'Content-Type': 'application/json' } }))
    const wrapper = mount(AnalyticsPanel, {
      props: { linkId: 'link-1', isOpen: true, shortUrl: 'eypi.cc/alpha' },
      attachTo: document.body,
    })
    await flushPromises()
    expect(document.body.textContent).toContain('Source apps')
    const bars = wrapper.findAllComponents(BarList).find((b) => b.props('items').some((i: { label: string }) => i.label === 'Messenger'))
    expect(bars!.props('items')).toEqual([
      { label: 'Messenger', value: 3 }, { label: 'TikTok', value: 2 }, { label: 'Unknown', value: 1 },
    ])
    wrapper.unmount()
  })

  it('shows the empty state when the period has no clicks', async () => {
    fetchMock.mockImplementation(async () => new Response(JSON.stringify({
      totals: { clicks: 0, avgDailyUniques: 0, qrShare: 0 }, timeline: [], heat: new Array<number>(168).fill(0),
      top: { referrer: [], app: [], country: [], device: [], browser: [], os: [] },
    }), { status: 200, headers: { 'Content-Type': 'application/json' } }))
    const wrapper = mount(AnalyticsPanel, {
      props: { linkId: 'link-1', isOpen: true, shortUrl: 'eypi.cc/alpha' },
      attachTo: document.body,
    })
    await flushPromises()
    expect(document.body.textContent).toContain('No clicks in this period yet')
    expect(wrapper.findComponent(LineChart).exists()).toBe(false)
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
    expect((document.body.textContent ?? '').match(/No data/g)).toHaveLength(6)
    wrapper.unmount()
  })

  it('has no chart.js import', () => {
    expect(source).not.toMatch(/chart\.js|vue-chartjs/)
  })
})
