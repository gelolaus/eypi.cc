// @vitest-environment happy-dom
import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import EventsView from './EventsView.vue'

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
    for (const b of row.findAll('button')) expect(b.classes().join(' ')).toMatch(/min-h-11|btn-/)
  })
})
