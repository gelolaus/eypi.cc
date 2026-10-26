// @vitest-environment happy-dom
import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import AnalyticsPanel from './AnalyticsPanel.vue'

vi.mock('vue-chartjs', () => ({
  Line: {
    name: 'Line',
    props: ['data', 'options'],
    template: '<div data-testid="clicks-chart" />',
  },
}))

const payload = {
  total: 42,
  unique: 10,
  qr: 7,
  direct: 35,
  timeline: [{ day: '2026-10-26', clicks: 4 }],
  topReferrers: [{ referrer: 'Campus mail', count: 5 }],
  topCountries: [{ country: 'PH', count: 6 }],
  topOs: [{ os: 'Windows', count: 8 }],
  peakHour: 15,
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
    expect(document.querySelector('[data-testid="clicks-chart"]')).toBeTruthy()
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
})
