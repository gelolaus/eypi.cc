// @vitest-environment happy-dom
import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import DpCampaignsView from './DpCampaignsView.vue'
import { clearQueryCache } from '@/lib/queryCache'
import { useToast } from '@/composables/useToast'

vi.mock('@/utils/renderLinkQr', () => ({
  renderLinkQrCanvas: vi.fn(async () => ({ toDataURL: () => 'data:image/png;base64,QR' })),
  downloadLinkQrPng: vi.fn(),
}))
const push = vi.hoisted(() => vi.fn())
vi.mock('vue-router', () => ({ useRouter: () => ({ push }) }))

beforeEach(() => {
  push.mockReset()
  const toast = useToast()
  while (toast.toasts.value.length > 0) toast.dismiss(toast.toasts.value[0].id)
  clearQueryCache()
  localStorage.clear()
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({
    status: 'ok',
    campaigns: [{ id: 'c1', slug: 'launch', title: 'Launch', description: null, downloadCount: 2, frameCount: 1 }],
  }), { status: 200, headers: { 'Content-Type': 'application/json' } })))
})
afterEach(() => vi.unstubAllGlobals())

describe('DpCampaignsView', () => {
  it('uses AppPage, no nested main, and no in-page OrgSwitcher', async () => {
    const wrapper = mount(DpCampaignsView, { global: { stubs: { RouterLink: { template: '<a><slot /></a>' } } } })
    await flushPromises()
    expect(wrapper.find('[data-app-page]').exists()).toBe(true)
    expect(wrapper.find('main').exists()).toBe(false)
    expect(wrapper.findComponent({ name: 'OrgSwitcher' }).exists()).toBe(false)
    expect(wrapper.text()).toContain('Launch')
  })

  it('shows the lifetime count including zero', async () => {
    const counts = [0, 1, 2]
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({
      status: 'ok',
      campaigns: counts.map((n) => ({ id: `c${n}`, slug: `s${n}`, title: `T${n}`, description: null, downloadCount: n, frameCount: 1 })),
    }), { status: 200, headers: { 'Content-Type': 'application/json' } })))
    const wrapper = mount(DpCampaignsView, { global: { stubs: { RouterLink: { template: '<a><slot /></a>' } } } })
    await flushPromises()
    const text = wrapper.text()
    expect(text).toContain('0 downloads')
    expect(text).toMatch(/1 download(?!s)/)
    expect(text).toContain('2 downloads')
    wrapper.unmount()
  })

  it('opens the QR dialog for the campaign link and keeps Copy link on the same url', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } })
    const wrapper = mount(DpCampaignsView, { attachTo: document.body, global: { stubs: { RouterLink: { template: '<a><slot /></a>' } } } })
    await flushPromises()
    expect(document.body.querySelector('[role="dialog"]')).toBeNull()

    const buttons = wrapper.findAll('button')
    await buttons.find((b) => b.text() === 'Copy link')!.trigger('click')
    expect(writeText).toHaveBeenCalledWith('https://eypi.cc/frames/launch')

    await buttons.find((b) => b.text() === 'QR code')!.trigger('click')
    await vi.waitFor(() => expect(document.body.querySelector('[role="dialog"]')?.textContent).toContain('https://eypi.cc/frames/launch'))
    wrapper.unmount()
    document.body.innerHTML = ''
  })

  describe('duplicate', () => {
    const stubs = { RouterLink: { template: '<a><slot /></a>' } }
    const duplicateButton = (wrapper: ReturnType<typeof mount>) => wrapper.findAll('button').find((b) => b.text() === 'Duplicate')

    function respond(duplicate: Response) {
      const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
        if (init?.method === 'POST') return duplicate
        return new Response(JSON.stringify({
          status: 'ok',
          campaigns: [{ id: 'c1', slug: 'launch', title: 'Launch', description: null, downloadCount: 2, frameCount: 1 }],
        }), { status: 200, headers: { 'Content-Type': 'application/json' } })
      })
      vi.stubGlobal('fetch', fetchMock)
      return fetchMock
    }

    it('copies the campaign, says so and opens the copy in the editor', async () => {
      const fetchMock = respond(new Response(JSON.stringify({ status: 'ok', campaign: { id: 'c2', title: 'Launch (copy)', slug: 'launch-copy' } }), { status: 201 }))
      const wrapper = mount(DpCampaignsView, { global: { stubs } })
      await flushPromises()
      await duplicateButton(wrapper)!.trigger('click')
      await flushPromises()

      expect(fetchMock.mock.calls.some(([url, init]) => String(url).endsWith('/api/dp/c1/duplicate') && init?.method === 'POST')).toBe(true)
      expect(useToast().toasts.value.map((t) => t.message)).toContain('"Launch (copy)" created.')
      expect(push).toHaveBeenCalledWith('/manage/frames/launch-copy/edit')
      wrapper.unmount()
    })

    it('shows the error and stays on the list when copying fails', async () => {
      respond(new Response(JSON.stringify({ status: 'error', message: 'Could not duplicate the campaign.' }), { status: 500 }))
      const wrapper = mount(DpCampaignsView, { global: { stubs } })
      await flushPromises()
      await duplicateButton(wrapper)!.trigger('click')
      await flushPromises()

      expect(useToast().toasts.value.map((t) => t.message)).toContain('Could not duplicate the campaign.')
      expect(push).not.toHaveBeenCalled()
      expect(duplicateButton(wrapper)!.attributes('disabled')).toBeUndefined()
      wrapper.unmount()
    })
  })

  it('shows one create action in the empty campaign list', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({
      status: 'ok',
      campaigns: [],
    }), { status: 200, headers: { 'Content-Type': 'application/json' } })))
    const wrapper = mount(DpCampaignsView, {
      global: { stubs: { RouterLink: { props: ['to'], template: '<a :href="String(to)"><slot /></a>' } } },
    })
    await flushPromises()

    const empty = wrapper.get('[data-empty-state]')
    expect(empty.text()).toContain('No campaigns yet')
    const actions = empty.findAll('a, button')
    expect(actions).toHaveLength(1)
    expect(actions[0].text()).toBe('New frame')
    expect(actions[0].attributes('href')).toBe('/manage/frames/new')
    expect(wrapper.find('[aria-busy="true"]').exists()).toBe(false)
    wrapper.unmount()
  })
})
