// @vitest-environment happy-dom
import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import EventDetailView from './EventDetailView.vue'

const { replace, confirm } = vi.hoisted(() => ({ replace: vi.fn(), confirm: vi.fn(async () => true) }))
vi.mock('@/composables/useDialog', () => ({ useDialog: () => ({ confirm }) }))
vi.mock('vue-router', () => ({
  useRoute: () => ({ params: { id: 'launch' }, query: {} }),
  useRouter: () => ({ replace, push: vi.fn() }),
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

let eventOverrides: Record<string, unknown> = {}

beforeEach(() => {
  localStorage.clear()
  replace.mockClear()
  eventOverrides = {}
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
          ...eventOverrides,
        },
      })
    }
    if (url.pathname === '/api/events/launch/attendees' && url.searchParams.get('paged')) {
      return json({ status: 'ok', attendees: [], counts: { pending: 0, entered: 4, waitlisted: 0, confirmed: 0, declined: 0, cancelled: 0 }, nextCursor: null })
    }
    if (url.pathname === '/api/events/launch/attendees') {
      return json({
        status: 'ok',
        attendees: [{
          id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
          first_name: 'Ana',
          last_name: 'Santos',
          email: 'ana@x.com',
          status: null,
          actioned_at: '2026-10-31 20:00:00',
          cluster_value: null,
          qr_token: 'qr-ana',
        }],
      })
    }
    if (url.pathname === '/api/events/launch/clusters') return json({ clusters: [] })
    if (url.pathname === '/api/events/launch/csv-data') {
      return json({
        status: 'ok',
        rows: [{ id: 'row-1', rowIndex: 0, rawData: { section: 'A', phone: '0917' } }],
        columnMapping: null,
      })
    }
    if (url.pathname === '/api/events/launch' && method === 'PATCH') return json({ status: 'ok' })
    if (method === 'POST' && /^\/api\/events\/launch\/(publish|close|cancel)$/.test(url.pathname)) {
      const to = { publish: 'published', close: 'closed', cancel: 'cancelled' }[url.pathname.split('/').pop() as 'publish' | 'close' | 'cancel']
      return json({ status: 'ok', event: { slug: 'launch', status: to } })
    }
    if (url.pathname === '/api/events/launch' && method === 'DELETE') {
      return json({ status: 'error', message: 'This event has registrations. Cancel it instead of deleting it.', error: { code: 'has_registrations', message: 'This event has registrations. Cancel it instead of deleting it.' } }, 409)
    }
    return json({ status: 'error', message: 'missing' }, 404)
  }))
})

afterEach(() => {
  vi.unstubAllGlobals()
  confirm.mockReset()
  confirm.mockResolvedValue(true)
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

  it('offers per-attendee QR download and a ZIP download any time', async () => {
    const wrapper = mount(EventDetailView, {
      global: { stubs: { RouterLink: true } },
    })
    await flushPromises()
    await tab(wrapper, 'Attendees')

    const labels = wrapper.findAll('button').map((button) => button.text())
    expect(labels.some((label) => label.includes('Download QR'))).toBe(true)
    expect(labels.some((label) => label.includes('Download all (ZIP)'))).toBe(true)

    wrapper.unmount()
  })
})

async function tab(wrapper: ReturnType<typeof mount>, label: string) {
  await wrapper.findAll('[data-main-tab]').find((button) => button.text() === label)!.trigger('click')
  await flushPromises()
}

describe('EventDetailView tabs', () => {
  it('shows Overview, Attendees and a Door link for an import event, without a Lottery tab', async () => {
    const wrapper = mount(EventDetailView, { global: { stubs: { RouterLink: { props: ['to'], template: '<a :href="to"><slot /></a>' } } } })
    await flushPromises()
    expect(wrapper.findAll('[data-main-tab]').map((b) => b.text())).toEqual(['Overview', 'Attendees', 'Insights'])
    expect(wrapper.get('[data-door-link]').attributes('href')).toBe('/manage/tix/launch/door')
    await tab(wrapper, 'Attendees')
    expect(wrapper.findAll('button').some((b) => b.text() === 'Scanner')).toBe(true)
    expect(wrapper.find('[data-attendee-row]').exists()).toBe(true)
    wrapper.unmount()
  })

  it('uses the paged inbox for an approval event and does not send it to the selection wizard', async () => {
    eventOverrides = { admissionMode: 'approval', selectionLocked: false, status: 'published', questions: [] }
    const wrapper = mount(EventDetailView, { global: { stubs: { RouterLink: true } } })
    await flushPromises()
    expect(replace).not.toHaveBeenCalled()
    await tab(wrapper, 'Attendees')
    expect(wrapper.findAll('[role="tab"]').some((t) => t.text() === 'Pending (0)')).toBe(true)
    expect(wrapper.findAll('[role="tab"]').some((t) => t.text() === 'Entered (4)')).toBe(true)
    expect(wrapper.findAll('button').some((b) => b.text() === 'Scanner')).toBe(false)
    wrapper.unmount()
  })

  it('still sends an unfinalized import event to the selection wizard', async () => {
    eventOverrides = { selectionLocked: false }
    const wrapper = mount(EventDetailView, { global: { stubs: { RouterLink: true } } })
    await flushPromises()
    expect(replace).toHaveBeenCalledWith('/manage/tix/launch/select')
    wrapper.unmount()
  })

  it('counts only confirmed guests against capacity for a non-import event and skips the legacy list', async () => {
    eventOverrides = { admissionMode: 'approval', selectionLocked: false, status: 'published', questions: [], maxAttendees: 2, confirmedCount: 1, attendeeCount: 6 }
    const wrapper = mount(EventDetailView, { global: { stubs: { RouterLink: true } } })
    await flushPromises()
    expect(wrapper.text()).toContain('1 / 2 guests')
    const add = wrapper.findAll('button').find((b) => b.text() === 'Add guest')!
    expect(add.attributes('disabled')).toBeUndefined()
    const legacy = vi.mocked(fetch).mock.calls.filter((call) => {
      const url = new URL(String(call[0]))
      return url.pathname === '/api/events/launch/attendees' && !url.searchParams.get('paged')
    })
    expect(legacy).toHaveLength(0)
    wrapper.unmount()
  })

  it('disables Add guest once the confirmed guests fill the event', async () => {
    eventOverrides = { admissionMode: 'approval', selectionLocked: false, status: 'published', questions: [], maxAttendees: 2, confirmedCount: 2 }
    const wrapper = mount(EventDetailView, { global: { stubs: { RouterLink: true } } })
    await flushPromises()
    expect(wrapper.text()).toContain('2 / 2 guests')
    expect(wrapper.findAll('button').find((b) => b.text() === 'Add guest')!.attributes('disabled')).toBeDefined()
    wrapper.unmount()
  })

  it('shows the Lottery tab quota bars and only quota questions in the draw form', async () => {
    eventOverrides = {
      admissionMode: 'lottery', selectionLocked: false, status: 'published',
      questions: [{ id: 'diet', label: 'Dietary needs', type: 'choice', options: ['None', 'Vegan'] }],
      registrationClosesAt: '2020-01-01 00:00:00', lotteryDrawnAt: null,
    }
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url)
      if (url.pathname === '/api/events/launch/clusters') return json({ clusters: [{ id: 'c1', clusterCol: 'diet', value: 'Vegan', maxCount: 5, currentCount: 0, remainingSlots: 5 }] })
      if (url.pathname === '/api/events/launch' && (init?.method ?? 'GET') === 'GET') {
        return json({ status: 'ok', event: { name: 'Launch', eventDate: '2026-11-01', eventTime: '09:00', location: 'Hall', isLead: true, maxAttendees: null, selectionLocked: false, passFields: [], ...eventOverrides } })
      }
      if (url.pathname === '/api/events/launch/attendees') return json({ status: 'ok', attendees: [], counts: { pending: 0, entered: 1, waitlisted: 0, confirmed: 0, declined: 0, cancelled: 0 }, nextCursor: null })
      return json({ status: 'error', message: 'missing' }, 404)
    }))
    const wrapper = mount(EventDetailView, { global: { stubs: { RouterLink: true } } })
    await flushPromises()
    await tab(wrapper, 'Lottery')
    expect(wrapper.find('[data-cluster-bar]').exists() || wrapper.text().includes('Clusters')).toBe(true)
    expect(wrapper.find('select[name="cluster"]').exists()).toBe(true)
    wrapper.unmount()
  })

  it('adds a Lottery tab only for lottery events and shows the draw panel there', async () => {
    eventOverrides = {
      admissionMode: 'lottery', selectionLocked: false, status: 'published', questions: [],
      registrationClosesAt: '2020-01-01 00:00:00', waitlistEnabled: true, lotteryDrawnAt: null,
    }
    const wrapper = mount(EventDetailView, { global: { stubs: { RouterLink: true } } })
    await flushPromises()
    expect(wrapper.findAll('[data-main-tab]').map((b) => b.text())).toEqual(['Overview', 'Attendees', 'Lottery', 'Insights'])
    await tab(wrapper, 'Lottery')
    expect(wrapper.find('[data-draw]').exists()).toBe(true)
    wrapper.unmount()
  })
})

function checkbox(wrapper: ReturnType<typeof mount>, name: string) {
  return wrapper.findAll('label').find((label) => label.text().trim() === name)?.find('input[type="checkbox"]')
}

describe('EventDetailView status controls', () => {
  const posts = () => vi.mocked(fetch).mock.calls
    .filter((call) => (call[1] as RequestInit | undefined)?.method === 'POST')
    .map((call) => new URL(String(call[0])).pathname)
  const buttonText = (wrapper: ReturnType<typeof mount>, label: string) => wrapper.findAll('button').find((b) => b.text() === label)

  it('closes registration after confirming, then offers Reopen', async () => {
    eventOverrides = { admissionMode: 'fcfs', selectionLocked: false, status: 'published', questions: [] }
    const wrapper = mount(EventDetailView, { global: { stubs: { RouterLink: true } } })
    await flushPromises()
    expect(wrapper.get('[data-event-status]').text()).toBe('Published')
    await buttonText(wrapper, 'Close registration')!.trigger('click')
    await flushPromises()
    expect(confirm).toHaveBeenCalledWith(expect.objectContaining({ title: 'Close registration?' }))
    expect(posts()).toContain('/api/events/launch/close')
    expect(wrapper.get('[data-event-status]').text()).toBe('Closed')
    await buttonText(wrapper, 'Reopen registration')!.trigger('click')
    await flushPromises()
    expect(posts()).toContain('/api/events/launch/publish')
    expect(wrapper.get('[data-event-status]').text()).toBe('Published')
    wrapper.unmount()
  })

  it('does nothing when the confirm dialog is declined', async () => {
    confirm.mockResolvedValue(false)
    eventOverrides = { admissionMode: 'fcfs', selectionLocked: false, status: 'published', questions: [] }
    const wrapper = mount(EventDetailView, { global: { stubs: { RouterLink: true } } })
    await flushPromises()
    await buttonText(wrapper, 'Cancel event')!.trigger('click')
    await flushPromises()
    expect(posts()).toHaveLength(0)
    wrapper.unmount()
  })

  it('cancels the event and turns the page read-only', async () => {
    eventOverrides = { admissionMode: 'fcfs', selectionLocked: false, status: 'published', questions: [], maxAttendees: 5 }
    const wrapper = mount(EventDetailView, { global: { stubs: { RouterLink: true } } })
    await flushPromises()
    await buttonText(wrapper, 'Cancel event')!.trigger('click')
    await flushPromises()
    expect(posts()).toContain('/api/events/launch/cancel')
    expect(wrapper.get('[data-event-status]').text()).toBe('Cancelled')
    expect(buttonText(wrapper, 'Add guest')).toBeUndefined()
    expect(buttonText(wrapper, 'Close registration')).toBeUndefined()
    expect(buttonText(wrapper, 'Cancel event')).toBeUndefined()
    expect(wrapper.text()).toContain('read-only')
    wrapper.unmount()
  })

  it('publishes a draft', async () => {
    eventOverrides = { admissionMode: 'fcfs', selectionLocked: false, status: 'draft', questions: [] }
    const wrapper = mount(EventDetailView, { global: { stubs: { RouterLink: true } } })
    await flushPromises()
    await buttonText(wrapper, 'Publish')!.trigger('click')
    await flushPromises()
    expect(posts()).toContain('/api/events/launch/publish')
    expect(wrapper.get('[data-event-status]').text()).toBe('Published')
    wrapper.unmount()
  })
})

describe('EventDetailView insights tab', () => {
  async function openInsights(insights: unknown) {
    const base = vi.mocked(fetch).getMockImplementation()!
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const raw = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
      if (new URL(raw).pathname === '/api/events/launch/insights') return json(insights)
      return base(input, init)
    }))
    const wrapper = mount(EventDetailView, { global: { stubs: { RouterLink: true } } })
    await flushPromises()
    await tab(wrapper, 'Insights')
    return wrapper
  }

  it('fetches the event insights when the tab is opened', async () => {
    const wrapper = await openInsights({ byStatus: [], registrationsDaily: [], byAnswer: [], showUpRate: null, checkInCurve: [] })
    await vi.waitFor(() => {
      expect(vi.mocked(fetch).mock.calls.some(([input]) => String(input).includes('/api/events/launch/insights'))).toBe(true)
    })
    wrapper.unmount()
  })

  it('shows No data for a null show-up rate when there are registrations', async () => {
    const wrapper = await openInsights({
      byStatus: [{ status: 'pending', n: 2 }], registrationsDaily: [], byAnswer: [], showUpRate: null, checkInCurve: [],
    })
    await vi.waitFor(() => expect(wrapper.text()).toContain('Show-up rate'))
    expect(wrapper.text()).toContain('No data')
    wrapper.unmount()
  })
})
