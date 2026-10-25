// @vitest-environment happy-dom
import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import EventDetailView from './EventDetailView.vue'

vi.mock('vue-router', () => ({
  useRoute: () => ({ params: { id: 'launch' }, query: {} }),
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
}))

vi.mock('@/router', () => ({
  default: {
    push: vi.fn(),
    replace: vi.fn(),
    currentRoute: { value: { fullPath: '/manage/tix/launch', name: 'event-manage' } },
  },
}))

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

beforeEach(() => {
  localStorage.clear()
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const raw = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
    const url = new URL(raw)
    const method = init?.method ?? 'GET'
    if (url.pathname === '/api/events/launch' && method === 'GET') {
      return json({
        status: 'ok',
        event: {
          name: 'Launch',
          eventDate: '2026-11-01',
          eventTime: '09:00',
          location: 'Hall',
          isLead: true,
          maxAttendees: null,
          selectionLocked: true,
          attendeeCount: 1,
          passFields: ['section'],
        },
      })
    }
    if (url.pathname === '/api/events/launch/attendees') return json({ status: 'ok', attendees: [] })
    if (url.pathname === '/api/events/launch/clusters') return json({ clusters: [] })
    if (url.pathname === '/api/events/launch/csv-data') {
      return json({
        status: 'ok',
        rows: [{ id: 'row-1', rowIndex: 0, rawData: { section: 'A', phone: '0917' } }],
        columnMapping: null,
      })
    }
    if (url.pathname === '/api/events/launch' && method === 'PATCH') return json({ status: 'ok' })
    return json({ status: 'error', message: 'missing' }, 404)
  }))
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('EventDetailView pass field picker', () => {
  it('checks saved pass fields and saves the updated allowlist', async () => {
    const wrapper = mount(EventDetailView, {
      global: { stubs: { RouterLink: true } },
    })
    await flushPromises()

    const section = checkbox(wrapper, 'section')
    const phone = checkbox(wrapper, 'phone')
    expect(section).toBeTruthy()
    expect(phone).toBeTruthy()
    expect((section!.element as HTMLInputElement).checked).toBe(true)
    expect((phone!.element as HTMLInputElement).checked).toBe(false)

    await phone!.trigger('change')
    const save = wrapper.findAll('button').find((button) => button.text().includes('Save pass fields'))
    expect(save).toBeTruthy()
    await save!.trigger('click')
    await flushPromises()

    const calls = vi.mocked(fetch).mock.calls
    const patch = calls.find((call) => {
      const init = call[1] as RequestInit | undefined
      return init?.method === 'PATCH'
    })
    expect(patch).toBeTruthy()
    expect(JSON.parse(String((patch![1] as RequestInit).body))).toEqual({
      passFields: ['section', 'phone'],
    })

    wrapper.unmount()
  })
})

function checkbox(wrapper: ReturnType<typeof mount>, name: string) {
  return wrapper.findAll('label').find((label) => label.text().trim() === name)?.find('input[type="checkbox"]')
}
