// @vitest-environment happy-dom
import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import TicketCard from './TicketCard.vue'
import type { TicketDto } from '@/lib/tix/tickets'

const qrAppend = vi.fn()
vi.mock('qr-code-styling', () => ({
  default: class {
    data: string
    constructor(opts: { data: string }) { this.data = opts.data }
    append(el: HTMLElement) { qrAppend(this.data); el.innerHTML = `<canvas data-qr="${this.data}"></canvas>` }
  },
}))
const confirm = vi.fn()
vi.mock('@/composables/useDialog', () => ({ useDialog: () => ({ confirm }) }))
const invalidate = vi.fn()
vi.mock('@/lib/queryCache', () => ({ invalidate: (p: string) => invalidate(p) }))

function ticket(status: string, extra: Partial<TicketDto> = {}): TicketDto {
  return {
    id: 'att-1', status, qrToken: status === 'confirmed' ? 'qr-secret' : null, waitlistPosition: null, answers: {},
    event: { slug: 'launch', name: 'Launch Night', eventDate: '2099-11-10', eventTime: '19:00', endTime: '21:00', location: 'APC Hall', coverUrl: null, coverMeta: null },
    ...extra,
  } as TicketDto
}

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

beforeEach(() => { vi.clearAllMocks() })
afterEach(() => { vi.unstubAllGlobals() })

describe('TicketCard', () => {
  it('shows the event name, date, time and place in Manila terms', () => {
    const w = mount(TicketCard, { props: { ticket: ticket('confirmed') } })
    expect(w.text()).toContain('Launch Night')
    expect(w.text()).toContain('Nov 10, 2099')
    expect(w.text()).toContain('7:00 PM')
    expect(w.text()).toContain('APC Hall')
  })

  it('renders the QR only for confirmed tickets', async () => {
    const confirmed = mount(TicketCard, { props: { ticket: ticket('confirmed') } })
    await flushPromises()
    expect(confirmed.find('[data-ticket-qr]').exists()).toBe(true)
    expect(qrAppend).toHaveBeenCalledWith('qr-secret')
    for (const status of ['pending', 'entered', 'waitlisted', 'declined', 'cancelled']) {
      const w = mount(TicketCard, { props: { ticket: ticket(status) } })
      await flushPromises()
      expect(w.find('[data-ticket-qr]').exists(), status).toBe(false)
    }
  })

  it('says where you are on the waitlist', () => {
    const w = mount(TicketCard, { props: { ticket: ticket('waitlisted', { waitlistPosition: 3 }) } })
    expect(w.text()).toContain("You're #3 on the waitlist")
  })

  it('explains pending, entered, declined and cancelled in plain words', () => {
    expect(mount(TicketCard, { props: { ticket: ticket('pending') } }).text()).toContain('waiting for the organisers to approve')
    expect(mount(TicketCard, { props: { ticket: ticket('entered') } }).text()).toContain('lottery')
    expect(mount(TicketCard, { props: { ticket: ticket('declined') } }).text()).toContain('not accepted')
    expect(mount(TicketCard, { props: { ticket: ticket('cancelled') } }).text()).toContain('cancelled')
  })

  it('offers Google Wallet only for a confirmed ticket with a pass token', async () => {
    expect(mount(TicketCard, { props: { ticket: ticket('confirmed'), guest: true } }).text()).not.toContain('Google Wallet')
    expect(mount(TicketCard, { props: { ticket: ticket('pending'), passToken: 'p' } }).text()).not.toContain('Google Wallet')
    const fetchMock = vi.fn(async () => json({ status: 'ok', url: 'https://pay.google.com/gp/v/save/x' }))
    vi.stubGlobal('fetch', fetchMock)
    const w = mount(TicketCard, { props: { ticket: ticket('confirmed'), passToken: 'tok en' } })
    const btn = w.findAll('button').find((b) => b.text().includes('Google Wallet'))!
    expect(btn.exists()).toBe(true)
    await btn.trigger('click')
    await flushPromises()
    const url = String((fetchMock.mock.calls[0] as unknown[])[0])
    expect(url).toContain('/api/events/launch/passes/google?token=tok%20en')
  })

  it('makes a wallet link on demand for an own confirmed ticket without a pass token', async () => {
    const fetchMock = vi.fn(async () => json({ url: 'https://pay.google.com/gp/v/save/x' }))
    vi.stubGlobal('fetch', fetchMock)
    const w = mount(TicketCard, { props: { ticket: ticket('confirmed') } })
    const btn = w.findAll('button').find((b) => b.text().includes('Google Wallet'))!
    expect(btn).toBeTruthy()
    await btn.trigger('click')
    await flushPromises()
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toContain('/api/tickets/att-1/pass')
    expect(init.method).toBe('POST')
  })

  it('shows no wallet button for a guest ticket without a pass token', () => {
    const w = mount(TicketCard, { props: { ticket: ticket('confirmed'), guest: true } })
    expect(w.text()).not.toContain('Google Wallet')
  })

  it('asks for a fresh pass token once when the guest pass token has expired', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(json({ message: 'Invalid or expired pass token.' }, 400))
      .mockResolvedValueOnce(json({ url: 'https://pay.google.com/gp/v/save/y' }))
    vi.stubGlobal('fetch', fetchMock)
    const refreshPass = vi.fn(async () => 'fresh')
    const w = mount(TicketCard, { props: { ticket: ticket('confirmed'), guest: true, passToken: 'old', refreshPass } })
    await w.findAll('button').find((b) => b.text().includes('Google Wallet'))!.trigger('click')
    await flushPromises()
    expect(refreshPass).toHaveBeenCalledTimes(1)
    expect(String((fetchMock.mock.calls[1] as unknown[])[0])).toContain('token=fresh')
  })

  it('shows the error when the retry also fails', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => json({ message: 'Invalid or expired pass token.' }, 400)))
    const refreshPass = vi.fn(async () => 'fresh')
    const w = mount(TicketCard, { props: { ticket: ticket('confirmed'), guest: true, passToken: 'old', refreshPass } })
    await w.findAll('button').find((b) => b.text().includes('Google Wallet'))!.trigger('click')
    await flushPromises()
    expect(refreshPass).toHaveBeenCalledTimes(1)
    expect(w.find('[role="alert"]').text()).toContain('expired')
  })

  it('hides the QR, wallet, calendar and cancel once the event is over', async () => {
    const past = ticket('confirmed')
    past.event.eventDate = '2020-01-01'
    const w = mount(TicketCard, { props: { ticket: past, passToken: 'p' } })
    await flushPromises()
    expect(w.find('[data-ticket-qr]').exists()).toBe(false)
    expect(w.text()).toContain('This event has passed')
    for (const label of ['Google Wallet', 'Add to calendar', 'Cancel registration']) expect(w.text()).not.toContain(label)
  })

  it('skips the calendar button when the date cannot be read', () => {
    const bad = ticket('confirmed')
    bad.event.eventTime = 'TBA'
    expect(mount(TicketCard, { props: { ticket: bad } }).text()).not.toContain('Add to calendar')
  })

  it('downloads a calendar file', async () => {
    const createObjectURL = vi.fn(() => 'blob:x')
    vi.stubGlobal('URL', Object.assign(URL, { createObjectURL, revokeObjectURL: vi.fn() }))
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    const w = mount(TicketCard, { props: { ticket: ticket('confirmed') } })
    await w.findAll('button').find((b) => b.text().includes('Add to calendar'))!.trigger('click')
    expect(createObjectURL).toHaveBeenCalled()
    expect(click).toHaveBeenCalled()
    click.mockRestore()
  })

  it('cancels only after the person confirms, then refreshes the lists', async () => {
    const fetchMock = vi.fn(async () => new Response(null, { status: 204 }))
    vi.stubGlobal('fetch', fetchMock)
    const w = mount(TicketCard, { props: { ticket: ticket('confirmed') } })
    const cancel = () => w.findAll('button').find((b) => b.text().includes('Cancel registration'))!

    confirm.mockResolvedValueOnce(false)
    await cancel().trigger('click')
    await flushPromises()
    expect(fetchMock).not.toHaveBeenCalled()

    confirm.mockResolvedValueOnce(true)
    await cancel().trigger('click')
    await flushPromises()
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toContain('/api/events/launch/registration')
    expect(init.method).toBe('DELETE')
    expect(invalidate).toHaveBeenCalledWith('tickets:')
    expect(w.emitted('cancelled')).toHaveLength(1)
  })

  it('hides cancel on the guest page and for tickets that are already over', () => {
    expect(mount(TicketCard, { props: { ticket: ticket('confirmed'), guest: true } }).text()).not.toContain('Cancel registration')
    expect(mount(TicketCard, { props: { ticket: ticket('cancelled') } }).text()).not.toContain('Cancel registration')
    expect(mount(TicketCard, { props: { ticket: ticket('declined') } }).text()).not.toContain('Cancel registration')
  })
})
