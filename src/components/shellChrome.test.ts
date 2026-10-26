// @vitest-environment happy-dom
import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'
import SiteNavSheet from './layout/SiteNavSheet.vue'
import ScrollTop from './ScrollTop.vue'
import TheHeader from './TheHeader.vue'
import { useNavDrawer } from '@/composables/useNavDrawer'
import { useScrollContainer } from '@/composables/useScrollContainer'
import { useSession } from '@/stores/session'

const stub = { template: '<div />' }
const router = createRouter({
  history: createMemoryHistory(),
  routes: ['/', '/dashboard', '/orgs', '/login'].map((path) => ({ path, component: stub })),
})

function media(matches: boolean) {
  return {
    matches,
    media: '',
    onchange: null,
    addEventListener() {},
    removeEventListener() {},
    addListener() {},
    removeListener() {},
    dispatchEvent() {
      return false
    },
  }
}

beforeEach(async () => {
  vi.stubGlobal('matchMedia', () => media(false))
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ orgs: [] }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })))
  localStorage.clear()
  useSession().reset()
  await router.push('/')
  await router.isReady()
})

afterEach(() => {
  useScrollContainer().container.value = null
  document.body.innerHTML = ''
})

describe('TheHeader top bar', () => {
  it('is a sticky h-14 bar that does not hide on scroll', async () => {
    const wrapper = mount(TheHeader, { global: { plugins: [router] } })
    const header = wrapper.get('header')
    for (const cls of ['sticky', 'top-0', 'h-14']) expect(header.classes()).toContain(cls)

    window.scrollY = 400
    window.dispatchEvent(new Event('scroll'))
    await flushPromises()
    expect(header.classes().join(' ')).not.toMatch(/hidden|pill-nav/)
    wrapper.unmount()
  })

  it('offers the menu button and no org switcher on public pages', async () => {
    const wrapper = mount(TheHeader, { global: { plugins: [router] } })
    expect(wrapper.find('[data-header-orgs]').exists()).toBe(false)
    expect(wrapper.find('[aria-label^="Open navigation menu"]').exists()).toBe(true)
    expect(wrapper.get('header').classes()).not.toContain('lg:hidden')
    wrapper.unmount()
  })
})

describe('SiteNavSheet', () => {
  async function open() {
    const wrapper = mount({ components: { SiteNavSheet }, template: '<SiteNavSheet />' }, {
      attachTo: document.body,
      global: { plugins: [router] },
    })
    useNavDrawer().open()
    await flushPromises()
    return wrapper
  }

  afterEach(() => useNavDrawer().close())

  it('fits the dynamic viewport and has a 44px close button', async () => {
    const wrapper = await open()
    const panel = document.getElementById('site-nav-sidebar')!
    expect(panel.classList.contains('max-h-dvh')).toBe(true)
    expect(panel.getAttribute('role')).toBe('dialog')
    const close = panel.querySelector('[data-slot="dialog-close"]')!
    expect(close.textContent).toContain('Close')
    wrapper.unmount()
  })

  it('closes on Escape', async () => {
    const wrapper = await open()
    document.getElementById('site-nav-sidebar')!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    await flushPromises()
    expect(useNavDrawer().isOpen.value).toBe(false)
    wrapper.unmount()
  })
})

describe('ScrollTop', () => {
  it('clears the tab bar and safe area when the shell has one', async () => {
    const wrapper = mount(ScrollTop, { props: { withTabBar: true }, attachTo: document.body })
    window.scrollY = 400
    window.dispatchEvent(new Event('scroll'))
    await flushPromises()
    expect(wrapper.get('button').classes()).toContain('bottom-[calc(5.5rem+env(safe-area-inset-bottom))]')
    window.scrollY = 0
    wrapper.unmount()
  })

  it('follows the app content pane instead of the window', async () => {
    const pane = document.createElement('div')
    const scrollTo = vi.fn()
    pane.scrollTo = scrollTo as unknown as typeof pane.scrollTo
    document.body.appendChild(pane)
    useScrollContainer().container.value = pane

    const wrapper = mount(ScrollTop, { attachTo: document.body })
    await flushPromises()
    pane.scrollTop = 400
    pane.dispatchEvent(new Event('scroll'))
    await flushPromises()
    await wrapper.get('button').trigger('click')
    expect(scrollTo).toHaveBeenCalledWith({ top: 0, behavior: 'smooth' })
    wrapper.unmount()
  })
})
