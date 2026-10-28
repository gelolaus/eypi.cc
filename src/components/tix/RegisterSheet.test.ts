// @vitest-environment happy-dom
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import RegisterSheet from './RegisterSheet.vue'
import type { PublicEvent } from '@/lib/tix/eventState'

vi.mock('@/lib/queryCache', () => ({ invalidate: vi.fn() }))

const event: PublicEvent = {
  slug: 'launch', name: 'Launch', eventDate: '2026-11-10', eventTime: '09:00', endTime: null, location: 'Hall',
  descriptionHtml: '', coverUrl: null, coverMeta: null, admissionMode: 'fcfs', seatsLeft: 5, waitlistEnabled: true,
  registrationOpensAt: null, registrationClosesAt: null, status: 'published',
  questions: [
    { id: 'q1', label: 'Student ID', type: 'text', required: true },
    { id: 'q2', label: 'Section', type: 'choice', options: ['A', 'B'], required: true },
    { id: 'q3', label: 'Diet', type: 'checkbox', options: ['Vegan', 'Halal'], required: false },
  ],
  org: { slug: 'o', name: 'Org' },
}

function ticket(status: string, extra: Record<string, unknown> = {}) {
  return { id: 't1', status, qrToken: null, waitlistPosition: null, answers: {}, event: { slug: 'launch' }, ...extra }
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

let wrapper: VueWrapper
const q = <T extends Element>(sel: string) => document.body.querySelector<T>(sel)
const submit = () => q<HTMLButtonElement>('button[type="submit"]')!

async function mountSheet(ev: PublicEvent = event) {
  wrapper = mount(RegisterSheet, { props: { event: ev, open: true }, attachTo: document.body, global: { stubs: { RouterLink: { props: ['to'], template: '<a :href="to"><slot /></a>' } } } })
  await flushPromises()
  return wrapper
}

async function fillRequired() {
  const text = q<HTMLInputElement>('input[type="text"]')!
  text.value = '2023-001'
  text.dispatchEvent(new Event('input'))
  const radio = q<HTMLInputElement>('input[type="radio"][value="B"]')!
  radio.click()
  await flushPromises()
}

beforeEach(() => {
  localStorage.clear()
})
afterEach(() => {
  wrapper?.unmount()
  document.body.innerHTML = ''
  vi.unstubAllGlobals()
})

describe('RegisterSheet', () => {
  it('renders each question type with labels', async () => {
    await mountSheet()
    expect(q('[role="dialog"]')).not.toBeNull()
    expect(document.body.textContent).toContain('Student ID')
    expect(q('input[type="text"]')).not.toBeNull()
    expect(document.body.querySelectorAll('input[type="radio"]').length).toBe(2)
    expect(document.body.querySelectorAll('input[type="checkbox"]').length).toBe(2)
    expect(q('fieldset legend')).not.toBeNull()
  })

  it('blocks submit until required answers exist', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    await mountSheet()
    expect(submit().disabled).toBe(true)
    await fillRequired()
    expect(submit().disabled).toBe(false)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('posts answers and shows the confirmed state with a link to tickets', async () => {
    const fetchMock = vi.fn(async () => json({ ticket: ticket('confirmed', { qrToken: 'tok' }) }, 201))
    vi.stubGlobal('fetch', fetchMock)
    await mountSheet()
    await fillRequired()
    q<HTMLInputElement>('input[type="checkbox"][value="Halal"]')!.click()
    await flushPromises()
    submit().click()
    await flushPromises()
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toContain('/api/events/launch/register')
    expect(JSON.parse(String(init.body))).toEqual({ answers: { q1: '2023-001', q2: 'B', q3: ['Halal'] } })
    expect(document.body.textContent).toContain("You're in")
    expect(q<HTMLAnchorElement>('a[href="/tickets"]')).not.toBeNull()
    expect(q('[data-register-result]')!.getAttribute('role')).toBe('status')
    const heading = q<HTMLElement>('[data-register-result] [tabindex="-1"]')!
    expect(document.activeElement).toBe(heading)
    expect(wrapper.emitted('registered')).toBeTruthy()
  })

  it.each([
    ['waitlisted', { waitlistPosition: 3 }, 'waitlist (#3)'],
    ['entered', {}, 'entered'],
    ['pending', {}, 'Request sent'],
  ])('shows the %s result', async (status, extra, text) => {
    vi.stubGlobal('fetch', vi.fn(async () => json({ ticket: ticket(status, extra) }, 201)))
    await mountSheet({ ...event, questions: [] })
    submit().click()
    await flushPromises()
    expect(document.body.textContent).toContain(text)
  })

  it('shows server field errors next to the question', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => json({ error: { code: 'invalid_answers', message: 'Check your answers and try again.', fields: { q1: 'Keep this under 1000 characters.' } } }, 422)))
    await mountSheet()
    await fillRequired()
    submit().click()
    await flushPromises()
    expect(document.body.textContent).toContain('Keep this under 1000 characters.')
    expect(q('input[type="text"]')!.getAttribute('aria-invalid')).toBe('true')
  })

  it.each([
    ['event_full', 409, 'This event is full.'],
    ['registration_closed', 409, 'Registration has closed.'],
    ['not_open_yet', 409, 'Registration has not opened yet.'],
    ['invite_only', 403, 'invite only'],
    ['registration_cancelled', 409, 'The organisers cancelled this registration.'],
  ])('maps %s to clear copy', async (code, status, text) => {
    vi.stubGlobal('fetch', vi.fn(async () => json({ error: { code, message: 'server text' } }, status)))
    await mountSheet({ ...event, questions: [] })
    submit().click()
    await flushPromises()
    expect(q('[role="alert"]')?.textContent).toContain(text)
  })

  it('closes on Escape', async () => {
    await mountSheet()
    document.body.querySelector('[role="dialog"]')!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    await flushPromises()
    expect(wrapper.emitted('update:open')?.[0]).toEqual([false])
  })
})
