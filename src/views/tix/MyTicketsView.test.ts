// @vitest-environment happy-dom
import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import MyTicketsView from './MyTicketsView.vue'
import { clearQueryCache } from '@/lib/queryCache'
import { useSession } from '@/stores/session'

vi.mock('qr-code-styling', () => ({ default: class { append() {} } }))

const stubs = { RouterLink: { props: ['to'], template: '<a :href="String(to)"><slot /></a>' } }

function t(id: string, name: string, eventDate: string, status = 'confirmed') {
  return {
    id, status, qrToken: status === 'confirmed' ? 'q' + id : null, waitlistPosition: null, answers: {},
    event: { slug: id, name, eventDate, eventTime: '09:00', endTime: null, location: 'Hall', coverUrl: null, coverMeta: null },
  }
}
const json = (body: unknown, headers: Record<string, string> = {}, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...headers } })

beforeEach(() => { clearQueryCache(); vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date('2026-11-10T04:00:00Z')) })
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals() })

describe('MyTicketsView', () => {
  it('shows a loading state, then upcoming tickets before past ones', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => json({ tickets: [t('old', 'Old Night', '2026-10-01'), t('soon', 'Soon Night', '2026-11-12')] })))
    const w = mount(MyTicketsView, { global: { stubs } })
    expect(w.find('[aria-busy="true"]').exists()).toBe(true)
    await flushPromises()
    const text = w.text()
    expect(text.indexOf('Soon Night')).toBeGreaterThan(-1)
    expect(text.indexOf('Soon Night')).toBeLessThan(text.indexOf('Old Night'))
    expect(text).toContain('Upcoming')
    expect(text).toContain('Past')
  })

  it('shows an empty state with a way to find events', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => json({ tickets: [] })))
    const w = mount(MyTicketsView, { global: { stubs } })
    await flushPromises()
    const empty = w.get('[data-empty-state]')
    expect(empty.text()).toContain('No tickets yet')
    const actions = empty.findAll('a, button')
    expect(actions).toHaveLength(1)
    expect(actions[0].text()).toBe('Browse events')
    expect(actions[0].attributes('href')).toBe('/orgs')
    expect(w.find('[aria-busy="true"]').exists()).toBe(false)
  })

  it('shows an error with retry', async () => {
    const fetchMock = vi.fn(async () => json({ error: { code: 'x', message: 'bad' } }, {}, 500))
    vi.stubGlobal('fetch', fetchMock)
    const w = mount(MyTicketsView, { global: { stubs } })
    await flushPromises()
    expect(w.find('[role="alert"]').text()).toContain('Could not load your tickets')
    fetchMock.mockImplementation(async () => json({ tickets: [t('a', 'Alpha', '2026-11-20')] }))
    await w.findAll('button').find((b) => b.text() === 'Try again')!.trigger('click')
    await flushPromises()
    expect(w.text()).toContain('Alpha')
  })

  it('shows the offline banner when the service worker served a cached copy', async () => {
    const cachedAt = String(Date.UTC(2026, 10, 9, 3, 30))
    vi.stubGlobal('fetch', vi.fn(async () => json({ tickets: [t('a', 'Alpha', '2026-11-20')] }, { 'x-eypi-offline': '1', 'x-eypi-cached-at': cachedAt })))
    const w = mount(MyTicketsView, { global: { stubs } })
    await flushPromises()
    expect(w.find('[role="status"]').text()).toBe('Offline — last updated 2026-11-09 11:30')
  })

  it('has no banner online and clears the nav badge count', async () => {
    useSession().ticketUpdates.value = 2
    vi.stubGlobal('fetch', vi.fn(async () => json({ tickets: [t('a', 'Alpha', '2026-11-20')] })))
    const w = mount(MyTicketsView, { global: { stubs } })
    await flushPromises()
    expect(w.text()).not.toContain('Offline')
    expect(useSession().ticketUpdates.value).toBe(0)
  })

  it('keeps the badge when the list came from the offline cache', async () => {
    useSession().ticketUpdates.value = 2
    vi.stubGlobal('fetch', vi.fn(async () => json({ tickets: [] }, { 'x-eypi-offline': '1' })))
    mount(MyTicketsView, { global: { stubs } })
    await flushPromises()
    expect(useSession().ticketUpdates.value).toBe(2)
  })
})
