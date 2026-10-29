// @vitest-environment happy-dom
import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import FramesInsights from './FramesInsights.vue'
import TixInsights from './TixInsights.vue'

const stubs = { 'router-link': { props: ['to'], template: '<a :href="to"><slot /></a>' } }

function respond(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

describe('insights components', () => {
  const fetchMock = vi.fn()
  beforeEach(() => {
    fetchMock.mockReset()
    vi.stubGlobal('fetch', fetchMock)
  })
  afterEach(() => vi.unstubAllGlobals())

  it('FramesInsights shows the funnel, conversion and per-frame downloads', async () => {
    fetchMock.mockResolvedValue(respond({
      funnel: { view: 40, photo_added: 20, downloadOrShare: 10 },
      conversion: 0.25,
      perFrame: [{ frameId: 'f1', label: 'Blue', downloads: 10 }],
      daily: [{ day: '2026-10-26', views: 40, downloads: 10 }],
    }))
    const wrapper = mount(FramesInsights, { props: { campaignId: 'c1', publicPath: '/frames/x' }, global: { stubs } })
    await flushPromises()
    expect(String(fetchMock.mock.calls[0][0])).toContain('/api/dp/c1/insights?days=30')
    const text = wrapper.text()
    expect(text).toContain('25%')
    expect(text).toContain('Downloaded or shared')
    expect(text).toContain('Blue')
  })

  it('FramesInsights labels the trend and per-frame figures as downloads and shares', async () => {
    fetchMock.mockResolvedValue(respond({
      funnel: { view: 40, photo_added: 20, downloadOrShare: 10 },
      conversion: 0.25,
      perFrame: [{ frameId: 'f1', label: 'Blue', downloads: 10 }],
      daily: [{ day: '2026-10-26', views: 40, downloads: 10 }],
    }))
    const wrapper = mount(FramesInsights, { props: { campaignId: 'c1', publicPath: '/frames/x' }, global: { stubs } })
    await flushPromises()
    const headings = wrapper.findAll('h3').map((h) => h.text())
    expect(headings).toContain('Views, downloads and shares per day (Manila time)')
    expect(headings).toContain('Downloads and shares per frame')
    expect(wrapper.findComponent({ name: 'LineChart' }).props('series').map((s: { label: string }) => s.label))
      .toContain('Downloads and shares')
  })

  it('FramesInsights refetches when the range changes', async () => {
    fetchMock.mockImplementation(async () => respond({
      funnel: { view: 1, photo_added: 0, downloadOrShare: 0 }, conversion: 0, perFrame: [], daily: [],
    }))
    const wrapper = mount(FramesInsights, { props: { campaignId: 'c1', publicPath: '/frames/x' }, global: { stubs } })
    await flushPromises()
    await wrapper.findAll('button').find((b) => b.text() === 'Last 7 days')!.trigger('click')
    await flushPromises()
    expect(String(fetchMock.mock.calls[fetchMock.mock.calls.length - 1][0])).toContain('days=7')
  })

  it('FramesInsights empty state has one primary action', async () => {
    fetchMock.mockResolvedValue(respond({
      funnel: { view: 0, photo_added: 0, downloadOrShare: 0 }, conversion: 0, perFrame: [], daily: [],
    }))
    const wrapper = mount(FramesInsights, { props: { campaignId: 'c1', publicPath: '/frames/x' }, global: { stubs } })
    await flushPromises()
    expect(wrapper.text()).toContain('No visits in this period yet')
    expect(wrapper.find('a[href="/frames/x"]').text()).toContain('Open the campaign page')
  })

  it('TixInsights shows show-up rate, status and answers with question labels', async () => {
    fetchMock.mockResolvedValue(respond({
      byStatus: [{ status: 'confirmed', n: 4 }, { status: 'pending', n: 1 }],
      registrationsDaily: [{ day: '2026-10-25', n: 5 }],
      byAnswer: [{ questionId: 'year', options: [{ value: '1st', n: 2 }] }],
      showUpRate: 0.75,
      checkInCurve: [{ bucket: '09:00', n: 2 }],
    }))
    const wrapper = mount(TixInsights, {
      props: { slug: 'door', publicPath: '/tix/door', questions: [{ id: 'year', label: 'Year level' }] },
      global: { stubs },
    })
    await flushPromises()
    const text = wrapper.text()
    expect(text).toContain('75%')
    expect(text).toContain('Confirmed')
    expect(text).toContain('Year level')
    expect(text).toContain('1st')
  })

  it('TixInsights says no data for a null show-up rate and shows the empty state', async () => {
    fetchMock.mockResolvedValue(respond({ byStatus: [], registrationsDaily: [], byAnswer: [], showUpRate: null, checkInCurve: [] }))
    const wrapper = mount(TixInsights, { props: { slug: 'door', publicPath: '/tix/door' }, global: { stubs } })
    await flushPromises()
    expect(wrapper.text()).toContain('No registrations yet')
    expect(wrapper.find('a[href="/tix/door"]').exists()).toBe(true)
  })

  it('shows a retry on failure', async () => {
    fetchMock.mockResolvedValue(respond({ error: { code: 'forbidden', message: 'Forbidden.' } }, 403))
    const wrapper = mount(TixInsights, { props: { slug: 'door', publicPath: '/tix/door' }, global: { stubs } })
    await flushPromises()
    expect(wrapper.find('[role="alert"]').text()).toContain('Could not load insights')
  })
})
