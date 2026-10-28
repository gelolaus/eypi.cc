// @vitest-environment happy-dom
import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import EventsView from './EventsView.vue'
import { api } from '@/lib/api'
import { clearQueryCache } from '@/lib/queryCache'

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

beforeEach(() => {
  clearQueryCache()
  localStorage.clear()
  vi.stubGlobal('fetch', vi.fn(async () => json({
    status: 'ok',
    events: [{ id: '1', slug: 'launch', name: 'Launch', event_date: '2026-11-01', event_time: '09:00', location: 'Hall', created_at: '' }],
  })))
})
afterEach(() => vi.unstubAllGlobals())

describe('EventsView', () => {
  it('uses AppPage, no nested main, and no in-page OrgSwitcher', async () => {
    const wrapper = mount(EventsView, { global: { stubs: { RouterLink: { template: '<a><slot /></a>' } } } })
    await flushPromises()
    expect(wrapper.find('[data-app-page]').exists()).toBe(true)
    expect(wrapper.find('main').exists()).toBe(false)
    expect(wrapper.findComponent({ name: 'OrgSwitcher' }).exists()).toBe(false)
  })

  it('renders events as cards below md with 44px actions and no min-width wrapper', async () => {
    const wrapper = mount(EventsView, { global: { stubs: { RouterLink: { template: '<a><slot /></a>' } } } })
    await flushPromises()
    const row = wrapper.find('[data-event-row]')
    expect(row.exists()).toBe(true)
    expect(row.classes()).toContain('rounded-2xl')
    expect(wrapper.html()).not.toMatch(/min-w-\[\d+px\]/)
    expect(wrapper.html()).toContain('Launch')
    for (const b of row.findAll('button')) expect(b.attributes('data-slot')).toBe('button')
  })

  it('shows the status and the admission mode on each row, and links to the builder', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => json({
      status: 'ok',
      events: [
        { id: '1', slug: 'a', name: 'Alpha', event_date: '2026-11-01', event_time: '09:00', location: 'Hall', created_at: '', status: 'draft', admission_mode: 'lottery' },
        { id: '2', slug: 'b', name: 'Beta', event_date: '2026-11-02', event_time: '09:00', location: 'Hall', created_at: '', status: 'published', admission_mode: 'fcfs' },
        { id: '3', slug: 'c', name: 'Gamma', event_date: '2026-11-03', event_time: '09:00', location: 'Hall', created_at: '', status: 'closed', admission_mode: 'approval' },
        { id: '4', slug: 'd', name: 'Delta', event_date: '2026-11-04', event_time: '09:00', location: 'Hall', created_at: '', status: 'cancelled', admission_mode: 'import' },
      ],
    })))
    const wrapper = mount(EventsView, { global: { stubs: { RouterLink: { props: ['to'], template: '<a :href="to"><slot /></a>' } } } })
    await flushPromises()
    const rows = wrapper.findAll('[data-event-row]')
    const badges = rows.map((r) => r.findAll('[data-slot="badge"]').map((b) => b.text()))
    expect(badges).toEqual([['Draft', 'Lottery'], ['Published', 'First come, first served'], ['Closed', 'Approval'], ['Cancelled', 'CSV import']])
    expect(rows[0].find('a[href="/manage/tix/a/edit"]').exists()).toBe(true)
    wrapper.unmount()
  })

  it('shows an event created after the first visit when the list is opened again', async () => {
    const events = [{ id: '1', slug: 'launch', name: 'Launch', event_date: '2026-11-01', event_time: '09:00', location: 'Hall', created_at: '' }]
    vi.stubGlobal('fetch', vi.fn(async (_url: unknown, init?: RequestInit) => {
      if (init?.method === 'POST') {
        events.push({ id: '2', slug: 'gala', name: 'Gala', event_date: '2026-12-01', event_time: '18:00', location: 'Hall', created_at: '' })
        return json({ status: 'ok' })
      }
      return json({ status: 'ok', events })
    }))
    const stubs = { RouterLink: { template: '<a><slot /></a>' } }
    const first = mount(EventsView, { global: { stubs } })
    await flushPromises()
    first.unmount()
    await api.raw('/api/events', { method: 'POST', body: '{}' })
    const second = mount(EventsView, { global: { stubs } })
    await flushPromises()
    expect(second.text()).toContain('Gala')
  })

  it('shows one create action in the empty event list', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => json({ status: 'ok', events: [] })))
    const wrapper = mount(EventsView, {
      global: { stubs: { RouterLink: { props: ['to'], template: '<a :href="String(to)"><slot /></a>' } } },
    })
    await flushPromises()

    const empty = wrapper.get('[data-empty-state]')
    expect(empty.text()).toContain('No events yet')
    const actions = empty.findAll('a, button')
    expect(actions).toHaveLength(1)
    expect(actions[0].text()).toBe('Create event')
    expect(actions[0].attributes('href')).toBe('/manage/tix/new')
    expect(wrapper.find('[aria-busy="true"]').exists()).toBe(false)
    wrapper.unmount()
  })

  it('hides the header New Event and the search row when there are no events', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => json({ status: 'ok', events: [] })))
    const wrapper = mount(EventsView, {
      global: { stubs: { RouterLink: { props: ['to'], template: '<a :href="String(to)"><slot /></a>' } } },
    })
    await flushPromises()

    expect(wrapper.findAll('a').filter((a) => a.text() === 'New Event')).toHaveLength(0)
    expect(wrapper.find('input[aria-label="Search events"]').exists()).toBe(false)
    expect(wrapper.get('[data-empty-state]').text()).toContain('Create event')
    wrapper.unmount()
  })

  it('shows the header New Event and the search row when events exist', async () => {
    const wrapper = mount(EventsView, {
      global: { stubs: { RouterLink: { props: ['to'], template: '<a :href="String(to)"><slot /></a>' } } },
    })
    await flushPromises()

    const create = wrapper.findAll('a').filter((a) => a.text() === 'New Event')
    expect(create).toHaveLength(1)
    expect(create[0].attributes('href')).toBe('/manage/tix/new')
    expect(wrapper.find('input[aria-label="Search events"]').exists()).toBe(true)
    wrapper.unmount()
  })

  it('keeps the header when a search matches nothing', async () => {
    const wrapper = mount(EventsView, {
      global: { stubs: { RouterLink: { props: ['to'], template: '<a :href="String(to)"><slot /></a>' } } },
    })
    await flushPromises()
    await wrapper.get('input[aria-label="Search events"]').setValue('zzz')

    expect(wrapper.text()).toContain('No matching events')
    expect(wrapper.findAll('a').filter((a) => a.text() === 'New Event')).toHaveLength(1)
    wrapper.unmount()
  })

  it('shows the org lockout with a real destination instead of a dead create action without an org', async () => {
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      const path = new URL(String(input), 'https://eypi.cc').pathname
      if (path === '/api/orgs/invites') return json([])
      return json({ status: 'locked', message: 'No org.' }, 403)
    }))
    const wrapper = mount(EventsView, {
      global: { stubs: { RouterLink: { props: ['to'], template: '<a :href="String(to)"><slot /></a>' } } },
    })
    await flushPromises()

    expect(wrapper.text()).toContain('Access restricted')
    expect(wrapper.find('[data-empty-state]').exists()).toBe(false)
    expect(wrapper.find('a[href="/manage/tix/new"]').exists()).toBe(false)
    const action = wrapper.get('a[href="/orgs"]')
    expect(action.text()).toBe('Browse orgs')
    wrapper.unmount()
  })
})
