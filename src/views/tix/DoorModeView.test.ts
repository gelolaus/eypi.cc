// @vitest-environment happy-dom
import 'fake-indexeddb/auto'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent } from 'vue'
import { wipeDoorStores } from '@/lib/tix/doorStore'
import DoorModeView from './DoorModeView.vue'

vi.mock('vue-router', () => ({
  useRoute: () => ({ params: { id: 'launch' }, query: {} }),
}))
vi.mock('@/router', () => ({ default: { push: vi.fn(), currentRoute: { value: { fullPath: '/' } } } }))

const ScannerStub = defineComponent({
  name: 'ScannerPanel',
  props: { slug: { type: String, default: '' }, emitOnly: Boolean },
  emits: ['scan'],
  template: '<button data-scan-stub @click="$emit(\'scan\', \'tok-ana\')">scan</button>',
})

const roster = [
  { id: 'a1', qrToken: 'tok-ana', firstName: 'Ana', lastName: 'Reyes', status: 'confirmed', checkedIn: false },
  { id: 'b2', qrToken: 'tok-ben', firstName: 'Ben', lastName: 'Cruz', status: 'confirmed', checkedIn: true },
]

function json(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' }, ...init })
}

let syncBodies: { items: { id: string; attendeeId: string }[] }[] = []
let syncResponder: (items: { id: string }[]) => Response
let liveHeaders: (string | null)[] = []
let rosterFails = false
let wrappers: VueWrapper[] = []

async function settle() {
  for (let i = 0; i < 6; i += 1) {
    await flushPromises()
    await new Promise((resolve) => setTimeout(resolve, 0))
  }
}

function setOnline(value: boolean) {
  Object.defineProperty(navigator, 'onLine', { configurable: true, value })
}

async function mountView() {
  const wrapper = mount(DoorModeView, { global: { stubs: { ScannerPanel: ScannerStub, RouterLink: true } } })
  wrappers.push(wrapper)
  await settle()
  return wrapper
}

beforeEach(async () => {
  await wipeDoorStores('all')
  localStorage.clear()
  vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] })
  syncBodies = []
  liveHeaders = []
  rosterFails = false
  syncResponder = (items) => json({ results: items.map((i) => ({ id: i.id, ok: true })) })
  setOnline(true)
  Object.defineProperty(navigator, 'vibrate', { configurable: true, value: vi.fn() })
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url)
    if (url.pathname === '/api/events/launch/roster') {
      if (rosterFails) throw new TypeError('offline')
      return json({ attendees: roster, generatedAt: '2026-11-01T09:00:00Z' })
    }
    if (url.pathname === '/api/events/launch/checkins/sync') {
      const body = JSON.parse(String(init?.body)) as { items: { id: string; attendeeId: string }[] }
      syncBodies.push(body)
      return syncResponder(body.items)
    }
    if (url.pathname === '/api/events/launch/live') {
      const sent = new Headers(init?.headers).get('If-None-Match')
      liveHeaders.push(sent)
      if (sent === 'W/"2-1-1"') return new Response(null, { status: 304 })
      return json({ confirmed: 2, checkedIn: 1, last10min: 1 }, { headers: { 'Content-Type': 'application/json', ETag: 'W/"2-1-1"' } })
    }
    return json({}, { status: 404 })
  }))
})

afterEach(() => {
  wrappers.forEach((w) => w.unmount())
  wrappers = []
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('DoorModeView', () => {
  it('downloads the roster and shows counters', async () => {
    const wrapper = await mountView()
    expect(wrapper.get('[data-door-counters]').text()).toContain('1 of 2 checked in')
  })

  it('answers a scan with text, a colour class and a vibration pattern', async () => {
    const wrapper = await mountView()
    await wrapper.get('[data-scan-stub]').trigger('click')
    await settle()
    const card = wrapper.get('[data-door-result]')
    expect(card.attributes('data-result')).toBe('ok')
    expect(card.text()).toContain('Checked in')
    expect(card.text()).toContain('Ana Reyes')
    expect(card.classes().join(' ')).toContain('bg-emerald')
    expect(navigator.vibrate).toHaveBeenLastCalledWith(60)
    expect(wrapper.get('[data-door-result-region]').attributes('aria-live')).toBe('assertive')

    // the same code again inside 5 s keeps the same answer and queues nothing new
    await wrapper.get('[data-scan-stub]').trigger('click')
    await settle()
    expect(syncBodies.flatMap((b) => b.items)).toHaveLength(1)
  })

  it('shows unknown codes in words and a long vibration', async () => {
    const wrapper = await mountView()
    wrapper.findComponent(ScannerStub).vm.$emit('scan', 'who-is-this')
    await settle()
    expect(wrapper.get('[data-door-result]').text()).toContain('Not on the guest list')
    expect(wrapper.get('[data-door-result]').classes().join(' ')).toContain('bg-destructive')
    expect(navigator.vibrate).toHaveBeenLastCalledWith(400)
  })

  it('queues offline scans, shows the banner, and syncs when back online', async () => {
    const wrapper = await mountView()
    setOnline(false)
    window.dispatchEvent(new Event('offline'))
    await settle()
    await wrapper.get('[data-scan-stub]').trigger('click')
    await settle()
    expect(wrapper.get('[data-door-banner]').text()).toBe('Offline — 1 check-in waiting to sync')

    vi.advanceTimersByTime(10_000)
    await settle()
    expect(syncBodies).toHaveLength(0)

    setOnline(true)
    window.dispatchEvent(new Event('online'))
    await settle()
    expect(syncBodies).toHaveLength(1)
    expect(syncBodies[0].items[0]).toMatchObject({ attendeeId: 'a1', action: 'checked_in' })
    expect(wrapper.find('[data-door-banner]').exists()).toBe(false)
  })

  it('retries every 5 seconds after a failure with a growing pause', async () => {
    const wrapper = await mountView()
    syncResponder = () => json({}, { status: 500 })
    await wrapper.get('[data-scan-stub]').trigger('click')
    await settle()
    expect(syncBodies).toHaveLength(1)
    expect(wrapper.get('[data-door-banner]').text()).toContain('1 check-in waiting to sync')

    // backoff is 10 s after the first failure, so the 5 s tick does nothing
    vi.advanceTimersByTime(5000)
    await settle()
    expect(syncBodies).toHaveLength(1)
  })

  it('tells the door about conflicts from the server', async () => {
    const wrapper = await mountView()
    syncResponder = (items) => json({ results: items.map((i) => ({ id: i.id, ok: false, code: 'already_checked_in' })) })
    await wrapper.get('[data-scan-stub]').trigger('click')
    await settle()
    expect(wrapper.get('[data-door-conflicts]').text()).toContain('Ana Reyes: Already checked in on another device')
    await wrapper.get('[data-door-conflicts] button').trigger('click')
    expect(wrapper.find('[data-door-conflicts]').exists()).toBe(false)
  })

  it('polls /live with If-None-Match and keeps the numbers on 304', async () => {
    const wrapper = await mountView()
    expect(liveHeaders).toEqual([null])
    expect(wrapper.get('[data-door-counters]').text()).toContain('1 in the last 10 min')
    vi.advanceTimersByTime(10_000)
    await settle()
    expect(liveHeaders).toEqual([null, 'W/"2-1-1"'])
    expect(wrapper.get('[data-door-counters]').text()).toContain('1 of 2 checked in')
  })

  it('does not poll while the tab is hidden', async () => {
    await mountView()
    Object.defineProperty(document, 'hidden', { configurable: true, value: true })
    vi.advanceTimersByTime(30_000)
    await settle()
    expect(liveHeaders).toHaveLength(1)
    Object.defineProperty(document, 'hidden', { configurable: true, value: false })
  })

  it('works from the saved guest list when the roster can not be downloaded', async () => {
    const first = await mountView()
    first.unmount()
    wrappers = []
    rosterFails = true
    const wrapper = await mountView()
    expect(wrapper.get('[data-door-notice]').text()).toContain('saved on this device')
    await wrapper.get('[data-scan-stub]').trigger('click')
    await settle()
    expect(wrapper.get('[data-door-result]').attributes('data-result')).toBe('ok')
  })

  it('asks for a first download when nothing is saved', async () => {
    rosterFails = true
    const wrapper = await mountView()
    expect(wrapper.text()).toContain('Connect once to download the guest list')
    expect(wrapper.find('[data-scan-stub]').exists()).toBe(false)
  })

  it('checks in by name', async () => {
    const wrapper = await mountView()
    await wrapper.get('#door-search').setValue('rey')
    const button = wrapper.get('li button')
    expect(button.text()).toBe('Check in')
    await button.trigger('click')
    await settle()
    expect(wrapper.get('[data-door-result]').text()).toContain('Ana Reyes')
  })

  it('warns when the device can not save check-ins and syncs at once', async () => {
    const wrapper = await mountView()
    const spy = vi.spyOn(IDBDatabase.prototype, 'transaction').mockImplementation(() => { throw new Error('quota') })
    await wrapper.get('[data-scan-stub]').trigger('click')
    await settle()
    spy.mockRestore()
    expect(wrapper.get('[data-door-save-warning]').text()).toBe("This device can't save check-ins — keep this tab open until they sync")
    expect(syncBodies).toHaveLength(1)
  })

  it('still opens when IndexedDB is refused, with the same warning', async () => {
    const spy = vi.spyOn(indexedDB, 'open').mockImplementation(() => { throw new Error('denied') })
    const wrapper = await mountView()
    spy.mockRestore()
    expect(wrapper.find('[data-scan-stub]').exists()).toBe(true) // the roster came from the network
    expect(wrapper.find('[data-door-save-warning]').exists()).toBe(true)
  })

  it('isolates a 400 batch one item at a time', async () => {
    const wrapper = await mountView()
    setOnline(false)
    window.dispatchEvent(new Event('offline'))
    wrapper.findComponent(ScannerStub).vm.$emit('scan', 'tok-ana')
    await settle()
    syncResponder = () => json({ error: { code: 'invalid_items' } }, { status: 400 })
    setOnline(true)
    window.dispatchEvent(new Event('online'))
    await settle()
    expect(wrapper.get('[data-door-conflicts]').text()).toContain('Could not sync — check this guest manually')
    expect(wrapper.find('[data-door-banner]').exists()).toBe(false)
  })

  it('stops syncing when access is gone', async () => {
    const wrapper = await mountView()
    syncResponder = () => json({}, { status: 403 })
    await wrapper.get('[data-scan-stub]').trigger('click')
    await settle()
    expect(wrapper.get('[data-door-sync-stopped]').text()).toBe('Sync stopped — you no longer have access to this event')
    vi.advanceTimersByTime(30_000)
    await settle()
    expect(syncBodies).toHaveLength(1)
  })

  it('says so after five failed syncs in a row', async () => {
    const wrapper = await mountView()
    syncResponder = () => json({}, { status: 500 })
    await wrapper.get('[data-scan-stub]').trigger('click')
    await settle()
    const realNow = Date.now
    let clock = realNow()
    vi.spyOn(Date, 'now').mockImplementation(() => clock)
    for (let i = 0; i < 6; i += 1) {
      clock += 120_000
      vi.advanceTimersByTime(5000)
      await settle()
    }
    expect(wrapper.get('[data-door-sync-stuck]').text()).toContain('Sync keeps failing')
    vi.mocked(Date.now).mockRestore()
  })

  it('treats a reply that settles nothing as a failure instead of looping', async () => {
    const wrapper = await mountView()
    syncResponder = () => json({ results: [] })
    await wrapper.get('[data-scan-stub]').trigger('click')
    await settle()
    expect(syncBodies).toHaveLength(1)
    expect(wrapper.get('[data-door-banner]').text()).toContain('1 check-in waiting')
  })

  it('adds waiting check-ins to the live count', async () => {
    const wrapper = await mountView()
    syncResponder = () => json({}, { status: 500 })
    await wrapper.get('[data-scan-stub]').trigger('click')
    await settle()
    expect(wrapper.get('[data-door-counters]').text()).toContain('2 of 2 checked in')
  })

  it('stops its timers when it goes away', async () => {
    const wrapper = await mountView()
    expect(vi.getTimerCount()).toBeGreaterThan(0)
    wrapper.unmount()
    wrappers = []
    expect(vi.getTimerCount()).toBe(0)
  })
})
