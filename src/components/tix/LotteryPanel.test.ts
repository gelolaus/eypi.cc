// @vitest-environment happy-dom
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import LotteryPanel from './LotteryPanel.vue'

const { confirm } = vi.hoisted(() => ({ confirm: vi.fn(async () => true) }))
vi.mock('@/composables/useDialog', () => ({ useDialog: () => ({ confirm }) }))

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

type Call = { method: string; path: string; body: Record<string, unknown> | null }
let calls: Call[]
let draw: () => Response
let wrapper: VueWrapper

const base = {
  status: 'published',
  eventDate: '2099-01-02',
  eventTime: '09:00',
  registrationOpensAt: null as string | null,
  registrationClosesAt: '2020-01-01 00:00:00' as string | null,
  waitlistEnabled: true,
  lotteryDrawnAt: null as string | null,
  questions: [
    { id: 'diet', label: 'Dietary needs', type: 'choice' as const, options: ['None', 'Vegan'] },
    { id: 'why', label: 'Why join?', type: 'text' as const },
  ],
}

beforeEach(() => {
  calls = []
  confirm.mockClear()
  confirm.mockResolvedValue(true)
  draw = () => json({ confirmed: 3, waitlisted: 2, declined: 1, seed: 'abc-123' })
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const raw = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
    const url = new URL(raw)
    const method = init?.method ?? 'GET'
    calls.push({ method, path: url.pathname, body: typeof init?.body === 'string' ? JSON.parse(init.body) : null })
    if (url.pathname === '/api/events/launch/draw') return draw()
    if (url.pathname === '/api/events/launch/attendees') {
      return json({ status: 'ok', attendees: [], counts: { pending: 0, entered: 7, waitlisted: 0, confirmed: 0, declined: 0, cancelled: 0 }, nextCursor: null })
    }
    return json({ error: { code: 'missing', message: 'missing' } }, 404)
  }))
})

afterEach(() => {
  wrapper?.unmount()
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

async function mountPanel(event: Partial<typeof base> = {}) {
  wrapper = mount(LotteryPanel, { props: { slug: 'launch', event: { ...base, ...event } } })
  await flushPromises()
}
const drawButton = () => wrapper.get('[data-draw]')

describe('LotteryPanel', () => {
  it('shows how many people entered', async () => {
    await mountPanel()
    expect(wrapper.text()).toContain('7')
  })

  it('disables Draw while registration is open and says why', async () => {
    await mountPanel({ registrationClosesAt: '2099-12-31 00:00:00' })
    expect(drawButton().attributes('disabled')).toBeDefined()
    expect(wrapper.text()).toContain('Registration is still open')
  })

  it('disables Draw for a draft event', async () => {
    await mountPanel({ status: 'draft' })
    expect(drawButton().attributes('disabled')).toBeDefined()
    expect(wrapper.text()).toContain('Publish')
  })

  it('confirms, draws, and shows the seed with the result counts', async () => {
    await mountPanel()
    expect(drawButton().attributes('disabled')).toBeUndefined()
    await drawButton().trigger('click')
    await flushPromises()
    expect(confirm).toHaveBeenCalledOnce()
    expect(JSON.stringify(confirm.mock.calls[0])).toContain("can't be undone")
    expect(calls.find((c) => c.path.endsWith('/draw'))!.body).toEqual({})
    const result = wrapper.get('[data-draw-result]').text()
    expect(result).toContain('abc-123')
    expect(result).toContain('Confirmed')
    expect(result).toContain('3')
    expect(result).toContain('Waitlisted')
    expect(result).toContain('Declined')
    expect(wrapper.emitted('drawn')).toBeTruthy()
    expect(drawButton().attributes('disabled')).toBeDefined()
  })

  it('does not draw when the owner cancels the dialog', async () => {
    confirm.mockResolvedValue(false)
    await mountPanel()
    await drawButton().trigger('click')
    await flushPromises()
    expect(calls.some((c) => c.path.endsWith('/draw'))).toBe(false)
  })

  it('sends a valid seed and a cluster question, and blocks an invalid seed', async () => {
    await mountPanel()
    await wrapper.get('input[name="seed"]').setValue('bad seed!')
    expect(drawButton().attributes('disabled')).toBeDefined()
    expect(wrapper.text()).toContain('letters, digits')
    await wrapper.get('input[name="seed"]').setValue('batch-1')
    await wrapper.get('select[name="cluster"]').setValue('diet')
    expect(Array.from(wrapper.get('select[name="cluster"]').element.querySelectorAll('option')).map((o) => o.value)).toEqual(['', 'diet'])
    await drawButton().trigger('click')
    await flushPromises()
    expect(calls.find((c) => c.path.endsWith('/draw'))!.body).toEqual({ seed: 'batch-1', clusterQuestionId: 'diet' })
  })

  it.each([
    ['already_drawn', 'already been drawn'],
    ['registration_open', 'still open'],
    ['event_cancelled', 'cancelled'],
    ['not_published', 'Publish'],
    ['not_lottery', 'lottery'],
  ])('explains the %s conflict in plain words', async (code, copy) => {
    draw = () => json({ error: { code, message: 'server text' } }, 409)
    await mountPanel()
    await drawButton().trigger('click')
    await flushPromises()
    expect(wrapper.get('[role="alert"]').text()).toContain(copy)
  })

  it('shows the server message for an unsupported quota filter', async () => {
    draw = () => json({ error: { code: 'unsupported_cluster_filter', message: 'A quota filter refers to something the draw cannot read.' } }, 422)
    await mountPanel()
    await drawButton().trigger('click')
    await flushPromises()
    expect(wrapper.get('[role="alert"]').text()).toContain('cannot read')
  })

  it('starts in the drawn state when the event was already drawn', async () => {
    await mountPanel({ lotteryDrawnAt: '2099-01-01 01:00:00' })
    expect(drawButton().attributes('disabled')).toBeDefined()
    expect(wrapper.text()).toContain('already been drawn')
  })
})
