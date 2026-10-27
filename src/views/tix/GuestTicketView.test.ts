// @vitest-environment happy-dom
import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import GuestTicketView from './GuestTicketView.vue'
import { useSession } from '@/stores/session'

vi.mock('qr-code-styling', () => ({ default: class { append(el: HTMLElement) { el.innerHTML = '<canvas data-qr></canvas>' } } }))
vi.mock('vue-router', () => ({ useRoute: () => ({ params: { token: 'tok_abc-123' } }) }))

const ticket = {
  id: 'a1', status: 'confirmed', qrToken: 'qr', waitlistPosition: null, answers: {},
  event: { slug: 'launch', name: 'Launch Night', eventDate: '2026-11-10', eventTime: '19:00', endTime: null, location: 'Hall', coverUrl: null, coverMeta: null },
}
const json = (body: unknown, headers: Record<string, string> = {}, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...headers } })

afterEach(() => { vi.unstubAllGlobals(); document.head.querySelectorAll('meta[name="robots"]').forEach((m) => m.remove()) })

describe('GuestTicketView', () => {
  it('shows the ticket without a session, with wallet and no cancel', async () => {
    const fetchMock = vi.fn(async () => json({ ticket, passToken: 'pt' }))
    vi.stubGlobal('fetch', fetchMock)
    expect(useSession().user.value).toBeNull()
    const w = mount(GuestTicketView)
    expect(w.find('[aria-busy="true"]').exists()).toBe(true)
    await flushPromises()
    expect(String((fetchMock.mock.calls[0] as unknown[])[0])).toContain('/api/tickets/guest/tok_abc-123')
    expect(w.text()).toContain('Launch Night')
    expect(w.find('[data-ticket-qr]').exists()).toBe(true)
    expect(w.text()).toContain('Add to Google Wallet')
    expect(w.text()).not.toContain('Cancel registration')
  })

  it('shows a friendly message for a dead link', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => json({ error: { code: 'not_found', message: 'Ticket not found.' } }, {}, 404)))
    const w = mount(GuestTicketView)
    await flushPromises()
    expect(w.text()).toContain("This link doesn't work anymore. Ask the organiser for a new one.")
    expect(w.find('[data-ticket-qr]').exists()).toBe(false)
  })

  it('offers a retry when the network or server fails', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => json({ error: { code: 'x', message: 'bad' } }, {}, 500)))
    const w = mount(GuestTicketView)
    await flushPromises()
    expect(w.find('[role="alert"]').text()).toContain('Could not load your ticket')
    expect(w.text()).not.toContain("doesn't work anymore")
  })

  it('shows the offline banner for a cached copy', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => json({ ticket, passToken: null }, { 'x-eypi-offline': '1', 'x-eypi-cached-at': String(Date.UTC(2026, 10, 9, 3, 30)) })))
    const w = mount(GuestTicketView)
    await flushPromises()
    expect(w.find('[role="status"]').text()).toBe('Offline — last updated 2026-11-09 11:30')
  })

  it('is noindex while mounted only', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => json({ ticket, passToken: null })))
    const w = mount(GuestTicketView)
    expect(document.head.querySelector('meta[name="robots"]')?.getAttribute('content')).toBe('noindex')
    w.unmount()
    expect(document.head.querySelector('meta[name="robots"]')).toBeNull()
  })
})
