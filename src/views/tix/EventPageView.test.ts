// @vitest-environment happy-dom
import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import EventPageView from './EventPageView.vue'
import { clearQueryCache } from '@/lib/queryCache'
import { useSession } from '@/stores/session'

const push = vi.fn()
vi.mock('vue-router', () => ({
  useRoute: () => ({ params: { slug: 'launch' }, fullPath: '/tix/launch', query: {} }),
  useRouter: () => ({ push, replace: vi.fn() }),
}))

// DOMPurify does not iterate happy-dom trees faithfully (it keeps <script>), so the sanitizer is
// replaced by a marker here and only checked for being in the render path.
const sanitize = vi.hoisted(() => vi.fn((html: string, ..._rest: unknown[]) => html.replace(/<script>.*<\/script>/, '').replace('<a ', '<a rel="noopener nofollow ugc" ')))
vi.mock('@/composables/useMarkdown', () => ({ sanitizeEventHtml: sanitize }))

const coverMeta = { w: 1000, h: 500, fmt: 'webp', widths: [256, 512], ph: 'data:image/webp;base64,AAAA' }

function payload(over: Record<string, unknown> = {}, ticket: unknown = null) {
  return {
    event: {
      slug: 'launch', name: 'Launch Night', eventDate: '2026-11-10', eventTime: '19:00', endTime: '21:00',
      location: 'Hall A', descriptionHtml: '<p>Hello <a href="https://x.test" target="_blank">link</a></p><script>alert(1)</script>',
      coverUrl: '/media/events/launch/cover-0a1b2c3d.png', coverMeta, admissionMode: 'fcfs', seatsLeft: 12,
      waitlistEnabled: false, registrationOpensAt: null, registrationClosesAt: null, status: 'published',
      questions: [], org: { slug: 'acm', name: 'ACM' }, ...over,
    },
    viewer: { ticket },
  }
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

function mountPage() {
  return mount(EventPageView, {
    attachTo: document.body,
    global: { stubs: { RouterLink: { props: ['to'], template: '<a :href="to"><slot /></a>' } } },
  })
}

const session = useSession()

beforeEach(() => {
  push.mockClear()
  clearQueryCache()
  session.user.value = null
  // Dates in the test are in the future relative to this clock.
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-11-01T00:00:00Z'))
})
afterEach(() => {
  document.body.innerHTML = ''
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('EventPageView', () => {
  it('shows a skeleton while loading', async () => {
    let release: (r: Response) => void = () => {}
    vi.stubGlobal('fetch', vi.fn(() => new Promise<Response>((r) => { release = r })))
    const w = mountPage()
    expect(w.find('[aria-busy="true"]').exists()).toBe(true)
    release(json(payload()))
    await flushPromises()
  })

  it('renders the event with a priority cover and a sanitized description', async () => {
    const fetchMock = vi.fn(async (_url: string) => json(payload()))
    vi.stubGlobal('fetch', fetchMock)
    const w = mountPage()
    await flushPromises()
    expect(String(fetchMock.mock.calls[0][0])).toContain('/api/events/launch/public')
    expect(w.text()).toContain('Launch Night')
    expect(w.text()).toContain('Hall A')
    expect(w.text()).toContain('12 seats left')
    const img = w.get('img')
    expect(img.attributes('fetchpriority')).toBe('high')
    expect(img.attributes('srcset')).toContain('-512.webp 512w')
    const desc = w.get('[data-event-description]')
    expect(sanitize).toHaveBeenCalledWith(expect.stringContaining('<script>'))
    expect(desc.find('script').exists()).toBe(false)
    const a = desc.get('a')
    expect(a.attributes('rel')).toBe('noopener nofollow ugc')
    expect(a.attributes('target')).toBe('_blank')
  })

  it('sends signed-out visitors to login with returnTo', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => json(payload())))
    const w = mountPage()
    await flushPromises()
    await w.get('[data-primary-action]').trigger('click')
    expect(w.get('[data-primary-action]').text()).toBe('Register')
    expect(push).toHaveBeenCalledWith({ name: 'login', query: { returnTo: '/tix/launch' } })
    expect(document.body.querySelector('[role="dialog"]')).toBeNull()
  })

  it('opens the register sheet for signed-in visitors', async () => {
    session.user.value = { id: 'u', email: 'a@x.test', name: 'A', role: 'user' }
    vi.stubGlobal('fetch', vi.fn(async () => json(payload())))
    const w = mountPage()
    await flushPromises()
    await w.get('[data-primary-action]').trigger('click')
    await flushPromises()
    expect(push).not.toHaveBeenCalled()
    expect(document.body.querySelector('[role="dialog"]')).not.toBeNull()
  })

  it('shows the ticket state and links to tickets once registered', async () => {
    session.user.value = { id: 'u', email: 'a@x.test', name: 'A', role: 'user' }
    const ticket = { id: 't', status: 'confirmed', qrToken: 'q', waitlistPosition: null, answers: {}, event: {} }
    vi.stubGlobal('fetch', vi.fn(async () => json(payload({}, ticket))))
    const w = mountPage()
    await flushPromises()
    const action = w.get('[data-primary-action]')
    expect(action.text()).toBe("You're in")
    expect(action.attributes('href')).toBe('/tickets')
  })

  it('shows an unavailable state for a missing event', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => json({ error: { code: 'not_found', message: 'Event not found.' } }, 404)))
    const w = mountPage()
    await flushPromises()
    expect(w.text()).toContain("This event isn't available")
    expect(w.find('[data-primary-action]').exists()).toBe(false)
  })

  it('shows a cancelled banner and no register action', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => json(payload({ status: 'cancelled' }))))
    const w = mountPage()
    await flushPromises()
    expect(w.get('[role="status"][data-banner]').text()).toContain('cancelled')
    expect(w.get('[data-primary-action]').text()).toBe('Registration closed')
    expect((w.get('[data-primary-action]').element as HTMLButtonElement).disabled).toBe(true)
  })

  it('shows a closed banner when the window has passed', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => json(payload({ registrationClosesAt: '2026-10-31 00:00:00' }))))
    const w = mountPage()
    await flushPromises()
    expect(w.get('[data-banner]').text()).toContain('Registration has closed')
  })
})
