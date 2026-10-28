// @vitest-environment happy-dom
import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import EventsView from './EventsView.vue'
import { api } from '@/lib/api'

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

beforeEach(() => {
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
})
