// @vitest-environment happy-dom
import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'
import NavSidebar from './NavSidebar.vue'
import ScrollTop from './ScrollTop.vue'
import TheHeader from './TheHeader.vue'
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

  it('shows the org switcher only in the app shell', async () => {
    useSession().user.value = { id: 'u', email: 'ada@apc.edu.ph', name: 'Ada', role: 'user' }
    const app = mount(TheHeader, { props: { appShell: true }, global: { plugins: [router] } })
    expect(app.find('[data-header-orgs]').exists()).toBe(true)
    expect(app.find('[aria-label^="Open navigation menu"]').exists()).toBe(false)
    expect(app.get('header').classes()).toContain('lg:hidden')
    app.unmount()
  })
})

describe('NavSidebar drawer', () => {
  function open() {
    return mount(NavSidebar, {
      attachTo: document.body,
      props: { isOpen: true, isAuthenticated: false, userName: 'Guest', userEmail: '', orgs: [], activeOrg: null },
      global: { plugins: [router] },
    })
  }

  it('fits the dynamic viewport and has a 44px close button', () => {
    const wrapper = open()
    const panel = document.getElementById('site-nav-sidebar')!
    expect(panel.classList.contains('max-h-dvh')).toBe(true)
    const close = panel.querySelector('[aria-label="Close navigation"]')!
    expect(close.classList.contains('size-11')).toBe(true)
    wrapper.unmount()
  })

  it('shows items immediately without a staggered fade', () => {
    const wrapper = open()
    const panel = document.getElementById('site-nav-sidebar')!
    expect(panel.querySelectorAll('.nav-sidebar-item')).toHaveLength(0)
    for (const link of Array.from(panel.querySelectorAll('a'))) {
      expect((link as HTMLElement).style.transitionDelay).toBe('')
    }
    wrapper.unmount()
  })
})

describe('ScrollTop', () => {
  it('clears the tab bar and safe area when the shell has one', async () => {
    const wrapper = mount(ScrollTop, { props: { withTabBar: true }, attachTo: document.body })
    window.scrollY = 400
    window.dispatchEvent(new Event('scroll'))
    await flushPromises()
    expect(wrapper.get('button').classes()).toContain('scroll-top-btn--tabbar')
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
