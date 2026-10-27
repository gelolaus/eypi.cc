// @vitest-environment happy-dom
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import AttendeesInboxView from './AttendeesInboxView.vue'

const { confirm, toast } = vi.hoisted(() => ({
  confirm: vi.fn(async () => true),
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}))
vi.mock('@/composables/useDialog', () => ({ useDialog: () => ({ confirm }) }))
vi.mock('@/composables/useToast', () => ({ useToast: () => toast }))

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

type Call = { method: string; path: string; query: URLSearchParams; body: Record<string, unknown> | null; headers: Headers }
let calls: Call[]
let handlers: Record<string, (call: Call) => Response>
let wrapper: VueWrapper

const counts = { pending: 2, entered: 0, waitlisted: 1, confirmed: 3, declined: 0, cancelled: 1 }
const row = (id: string, first: string, status = 'pending', answers: Record<string, unknown> = {}) => ({
  id, first_name: first, last_name: 'Santos', email: `${first.toLowerCase()}@x.com`, status, source: 'self',
  answers, cluster_value: null, registered_at: '2026-10-30 01:00:00', decided_at: null, decided_by: null,
})

const questions = [
  { id: 'diet', label: 'Dietary needs', type: 'choice' as const, options: ['None', 'Vegan'] },
  { id: 'why', label: 'Why join?', type: 'text' as const },
]

beforeEach(() => {
  calls = []
  handlers = {}
  confirm.mockClear()
  confirm.mockResolvedValue(true)
  toast.success.mockClear()
  toast.error.mockClear()
  toast.info.mockClear()
  localStorage.setItem('active_org_id', 'org-1')
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const raw = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
    const url = new URL(raw)
    const call: Call = {
      method: init?.method ?? 'GET',
      path: url.pathname,
      query: url.searchParams,
      body: typeof init?.body === 'string' ? JSON.parse(init.body) : null,
      headers: new Headers(init?.headers),
    }
    calls.push(call)
    const handler = handlers[`${call.method} ${call.path}`]
    return handler ? handler(call) : json({ error: { code: 'missing', message: 'missing' } }, 404)
  }))
  handlers['GET /api/events/launch/attendees'] = () => json({
    status: 'ok',
    attendees: [row('a1', 'Ana', 'pending', { diet: 'Vegan', why: 'Curious' }), row('a2', 'Ben')],
    counts,
    nextCursor: null,
  })
})

afterEach(() => {
  wrapper?.unmount()
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

async function mountInbox(mode: 'approval' | 'lottery' | 'fcfs' = 'approval') {
  wrapper = mount(AttendeesInboxView, { props: { slug: 'launch', questions, admissionMode: mode }, attachTo: document.body })
  await flushPromises()
}

const listCalls = () => calls.filter((c) => c.path === '/api/events/launch/attendees')
const button = (label: string) => wrapper.findAll('button').find((b) => b.text() === label)
  ?? wrapper.findAll('button').find((b) => b.text().includes(label))

describe('AttendeesInboxView', () => {
  it('uses paged mode and shows a count on each status tab', async () => {
    await mountInbox()
    const first = listCalls()[0]
    expect(first.query.get('paged')).toBe('1')
    expect(first.query.get('status')).toBe('pending')
    const tabs = wrapper.findAll('[role="tab"]').map((t) => t.text())
    expect(tabs).toEqual(['Pending (2)', 'Entered (0)', 'Waitlisted (1)', 'Confirmed (3)', 'Declined (0)', 'Cancelled (1)'])
    expect(wrapper.findAll('[data-attendee-row]')).toHaveLength(2)
  })

  it('opens on the tab that matches the admission mode and refetches on tab change', async () => {
    await mountInbox('lottery')
    expect(listCalls()[0].query.get('status')).toBe('entered')
    await button('Confirmed')!.trigger('click')
    await flushPromises()
    expect(listCalls()[listCalls().length - 1].query.get('status')).toBe('confirmed')
    expect(wrapper.get('[role="tab"][aria-selected="true"]').text()).toContain('Confirmed')
  })

  it('moves between status tabs with the arrow keys and labels the tab panel', async () => {
    await mountInbox('approval')
    const tabs = wrapper.findAll('[role="tab"]')
    expect(tabs[0].attributes('tabindex')).toBe('0')
    expect(tabs[1].attributes('tabindex')).toBe('-1')
    await tabs[0].trigger('keydown', { key: 'ArrowRight' })
    await flushPromises()
    expect(wrapper.get('[role="tab"][aria-selected="true"]').text()).toContain('Entered')
    expect(listCalls()[listCalls().length - 1].query.get('status')).toBe('entered')
    expect(wrapper.get('[role="tabpanel"]').attributes('aria-labelledby')).toBe('inbox-tab-entered')
  })

  it('debounces the search box and sends q', async () => {
    await mountInbox()
    vi.useFakeTimers()
    const before = listCalls().length
    await wrapper.get('input[type="search"]').setValue('an')
    await wrapper.get('input[type="search"]').setValue('ana')
    vi.advanceTimersByTime(299)
    expect(listCalls()).toHaveLength(before)
    vi.advanceTimersByTime(2)
    vi.useRealTimers()
    await flushPromises()
    expect(listCalls()).toHaveLength(before + 1)
    expect(listCalls()[listCalls().length - 1].query.get('q')).toBe('ana')
  })

  it('loads more with the cursor and appends rows', async () => {
    handlers['GET /api/events/launch/attendees'] = (call) => call.query.get('cursor')
      ? json({ status: 'ok', attendees: [row('a3', 'Cy')], counts, nextCursor: null })
      : json({ status: 'ok', attendees: [row('a1', 'Ana')], counts, nextCursor: 'CUR1' })
    await mountInbox()
    await button('Load more')!.trigger('click')
    await flushPromises()
    expect(listCalls()[listCalls().length - 1].query.get('cursor')).toBe('CUR1')
    expect(wrapper.findAll('[data-attendee-row]')).toHaveLength(2)
    expect(button('Load more')).toBeUndefined()
  })

  it('bulk approves in requests of at most 200 ids and lists skipped rows in plain words', async () => {
    const many = Array.from({ length: 250 }, (_v, i) => row(`id${i}`, `G${i}`))
    handlers['GET /api/events/launch/attendees'] = () => json({ status: 'ok', attendees: many, counts, nextCursor: null })
    handlers['POST /api/events/launch/attendees/bulk'] = (call) => {
      const ids = call.body!.ids as string[]
      return ids.includes('id3')
        ? json({ status: 'ok', updated: ids.length - 1, skipped: [{ id: 'id3', reason: 'event_full' }] })
        : json({ status: 'ok', updated: ids.length, skipped: [] })
    }
    await mountInbox()
    await wrapper.get('input[aria-label="Select all loaded attendees"]').setValue(true)
    expect(wrapper.text()).toContain('250 selected')
    await button('Approve')!.trigger('click')
    await flushPromises()
    const bulk = calls.filter((c) => c.path.endsWith('/attendees/bulk'))
    expect(bulk.map((c) => (c.body!.ids as string[]).length)).toEqual([200, 50])
    expect(bulk.every((c) => c.body!.action === 'approve')).toBe(true)
    const summary = wrapper.get('[data-bulk-result]').text()
    expect(summary).toContain('249')
    expect(summary).toContain('G3 Santos')
    expect(summary).toContain('the event is full')
    expect(wrapper.text()).not.toContain('selected')
  })

  it('asks before declining and does nothing when the owner backs out', async () => {
    confirm.mockResolvedValue(false)
    await mountInbox()
    await wrapper.get('input[aria-label="Select Ana Santos"]').setValue(true)
    await button('Decline')!.trigger('click')
    await flushPromises()
    expect(confirm).toHaveBeenCalled()
    expect(calls.some((c) => c.path.endsWith('/bulk'))).toBe(false)
  })

  it('copies a guest link through the guest-link endpoint', async () => {
    const writeText = vi.fn(async () => undefined)
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
    handlers['POST /api/events/launch/attendees/a1/guest-link'] = () => json({ url: 'https://eypi.cc/t/TOKEN' })
    await mountInbox()
    const copy = wrapper.get('[data-attendee-row] button[aria-label="New guest link for Ana Santos"]')
    await copy.trigger('click')
    await flushPromises()
    expect(confirm).toHaveBeenCalledWith(expect.objectContaining({ title: 'Create a new guest link?', confirmLabel: 'Create new link' }))
    expect(writeText).toHaveBeenCalledWith('https://eypi.cc/t/TOKEN')
    expect(toast.success).toHaveBeenCalled()
  })

  it('does not rotate a guest link when the owner backs out', async () => {
    confirm.mockResolvedValue(false)
    await mountInbox()
    await wrapper.get('button[aria-label="New guest link for Ana Santos"]').trigger('click')
    await flushPromises()
    expect(calls.some((c) => c.path.endsWith('/guest-link'))).toBe(false)
  })

  it('offers bulk actions only where they can apply', async () => {
    await mountInbox()
    await wrapper.get('input[aria-label="Select Ana Santos"]').setValue(true)
    expect(button('Approve')).toBeTruthy()
    expect(button('Decline')).toBeTruthy()
    expect(button('Cancel registrations')).toBeTruthy()
    await button('Confirmed')!.trigger('click')
    await flushPromises()
    await wrapper.get('input[aria-label="Select Ana Santos"]').setValue(true)
    expect(button('Approve')).toBeUndefined()
    expect(button('Cancel registrations')).toBeTruthy()
    await button('Declined')!.trigger('click')
    await flushPromises()
    await wrapper.get('input[aria-label="Select Ana Santos"]').setValue(true)
    expect(wrapper.find('[aria-label="Bulk actions"]').exists()).toBe(false)
  })

  it('mentions the waitlist in the cancel dialog only when it is on', async () => {
    await mountInbox()
    await wrapper.get('input[aria-label="Select Ana Santos"]').setValue(true)
    await button('Cancel registrations')!.trigger('click')
    await flushPromises()
    expect((confirm.mock.calls as unknown as [{ body: string }][])[0][0].body).not.toContain('waitlist')
    wrapper.unmount()
    confirm.mockClear()
    wrapper = mount(AttendeesInboxView, { props: { slug: 'launch', questions, admissionMode: 'approval', waitlistEnabled: true }, attachTo: document.body })
    await flushPromises()
    await wrapper.get('input[aria-label="Select Ana Santos"]').setValue(true)
    await button('Cancel registrations')!.trigger('click')
    await flushPromises()
    expect((confirm.mock.calls as unknown as [{ body: string }][])[0][0].body).toContain('waitlist')
  })

  it('uses a generic reason for an unknown skip code', async () => {
    handlers['POST /api/events/launch/attendees/bulk'] = () => json({ status: 'ok', updated: 0, skipped: [{ id: 'a1', reason: 'weird_code' }] })
    await mountInbox()
    await wrapper.get('input[aria-label="Select Ana Santos"]').setValue(true)
    await button('Approve')!.trigger('click')
    await flushPromises()
    expect(wrapper.get('[data-bulk-result]').text()).toContain('could not be changed')
    expect(wrapper.get('[data-bulk-result]').text()).not.toContain('weird_code')
  })

  it('shows answers with question labels', async () => {
    await mountInbox()
    const toggle = wrapper.get('button[aria-label="Show answers for Ana Santos"]')
    expect(toggle.attributes('aria-expanded')).toBe('false')
    await toggle.trigger('click')
    const text = wrapper.get('[data-answers]').text()
    expect(text).toContain('Dietary needs')
    expect(text).toContain('Vegan')
    expect(text).toContain('Why join?')
    expect(text).toContain('Curious')
    expect(toggle.attributes('aria-expanded')).toBe('true')
  })

  it('exports the CSV with the active org header', async () => {
    const createObjectURL = vi.fn(() => 'blob:x')
    vi.stubGlobal('URL', Object.assign(URL, { createObjectURL, revokeObjectURL: vi.fn() }))
    handlers['GET /api/events/launch/attendees.csv'] = () => new Response('first_name\r\nAna\r\n', { headers: { 'Content-Type': 'text/csv' } })
    await mountInbox()
    await button('Export CSV')!.trigger('click')
    await flushPromises()
    const exp = calls.find((c) => c.path.endsWith('attendees.csv'))!
    expect(exp.headers.get('X-Active-Org-Id')).toBe('org-1')
    expect(createObjectURL).toHaveBeenCalled()
  })

  it('restores a cancelled attendee and reports the server reason when it refuses', async () => {
    handlers['GET /api/events/launch/attendees'] = () => json({ status: 'ok', attendees: [row('c1', 'Cat', 'cancelled')], counts, nextCursor: null })
    handlers['POST /api/events/launch/restore'] = () => json({ status: 'error', message: 'Cat cancelled their own registration.', error: { code: 'self_cancelled', message: 'Cat cancelled their own registration.' } }, 409)
    await mountInbox('fcfs')
    await button('Cancelled')!.trigger('click')
    await flushPromises()
    await button('Restore')!.trigger('click')
    await flushPromises()
    expect(calls.find((c) => c.path.endsWith('/restore'))!.body).toEqual({ attendeeId: 'c1' })
    expect(toast.error).toHaveBeenCalledWith('Cat cancelled their own registration.')
  })
})
