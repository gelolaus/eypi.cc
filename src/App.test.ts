// @vitest-environment happy-dom
import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'

const appShellLoaded = vi.hoisted(() => vi.fn())

vi.mock('@/components/layout/AppShell.vue', async () => {
  appShellLoaded()
  const { defineComponent, h } = await import('vue')
  return {
    __esModule: true,
    default: defineComponent({
      name: 'AppShellStub',
      setup(_, { slots }) {
        return () => h('div', { 'data-app-shell-stub': '' }, slots.default?.())
      },
    }),
  }
})

import App from './App.vue'

const stub = { template: '<p id="page">Page</p>' }
const router = createRouter({
  history: createMemoryHistory(),
  routes: [
    { path: '/', component: stub, meta: { layout: 'public' } },
    { path: '/links', component: stub },
  ],
})

async function mountAt(path: string) {
  await router.push(path)
  await router.isReady()
  const wrapper = mount(App, {
    attachTo: document.body,
    global: {
      plugins: [router],
      stubs: { AppTransition: true, ToastContainer: true, DialogHost: true, PublicShell: { template: '<div data-public-shell><slot /></div>' } },
    },
  })
  await flushPromises()
  return wrapper
}

beforeEach(() => {
  appShellLoaded.mockClear()
  document.body.innerHTML = ''
})

describe('App layouts', () => {
  it('public routes render PublicShell and never import AppShell', async () => {
    const wrapper = await mountAt('/')
    expect(wrapper.find('[data-public-shell]').exists()).toBe(true)
    expect(wrapper.find('[data-app-shell-stub]').exists()).toBe(false)
    expect(appShellLoaded).not.toHaveBeenCalled()
    wrapper.unmount()
  })

  it('app routes render AppShell', async () => {
    const wrapper = await mountAt('/links')
    await vi.waitFor(() => expect(wrapper.find('[data-app-shell-stub]').exists()).toBe(true))
    expect(wrapper.find('[data-public-shell]').exists()).toBe(false)
    expect(wrapper.find('#page').exists()).toBe(true)
    expect(appShellLoaded).toHaveBeenCalled()
    wrapper.unmount()
  })
})

describe('boot skeleton', () => {
  function coldMount() {
    const coldRouter = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/', component: stub, meta: { layout: 'public' } },
        { path: '/links', component: stub },
      ],
    })
    // Hold the first navigation open, as a lazy route chunk does on a cold load.
    let release!: () => void
    const gate = new Promise<void>((resolve) => { release = resolve })
    coldRouter.beforeEach(() => gate)
    const wrapper = mount(App, {
      attachTo: document.body,
      global: {
        plugins: [coldRouter],
        stubs: { AppTransition: true, ToastContainer: true, DialogHost: true, PublicShell: { template: '<div data-public-shell><slot /></div>' } },
      },
    })
    return { coldRouter, wrapper, release }
  }

  it('shows the boot skeleton until the router is ready', async () => {
    const { wrapper } = coldMount()
    await flushPromises()
    const skeleton = wrapper.find('[data-boot-skeleton]')
    expect(skeleton.exists()).toBe(true)
    expect(skeleton.attributes('aria-busy')).toBe('true')
    expect(wrapper.find('[data-public-shell]').exists()).toBe(false)
    expect(wrapper.find('[data-app-shell-stub]').exists()).toBe(false)
    wrapper.unmount()
  })

  it('swaps the skeleton for the shell once ready', async () => {
    const { coldRouter, wrapper, release } = coldMount()
    release()
    await coldRouter.push('/')
    await coldRouter.isReady()
    await flushPromises()
    expect(wrapper.find('[data-boot-skeleton]').exists()).toBe(false)
    expect(wrapper.find('[data-public-shell]').exists()).toBe(true)
    wrapper.unmount()
  })
})

describe('lazy overlay hosts', () => {
  it('shows a toast and a dialog raised before the hosts have mounted', async () => {
    const { useToast } = await import('@/composables/useToast')
    const { useDialog } = await import('@/composables/useDialog')
    await router.push('/')
    await router.isReady()
    const wrapper = mount(App, {
      attachTo: document.body,
      global: { plugins: [router], stubs: { AppTransition: true, PublicShell: { template: '<div><slot /></div>' } } },
    })
    useToast().success('Saved early')
    const answer = useDialog().confirm({ title: 'Sure early?', body: 'Body' })
    await vi.waitFor(() => expect(document.body.textContent).toContain('Saved early'))
    await vi.waitFor(() => expect(document.body.textContent).toContain('Sure early?'))
    useDialog().abort()
    expect(await answer).toBe(false)
    wrapper.unmount()
  })
})
