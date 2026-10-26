// @vitest-environment happy-dom
import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'
import AppShell from './AppShell.vue'
import NavSidebar from './NavSidebar.vue'
import TheHeader from './TheHeader.vue'
import { useSession } from '@/stores/session'

const stub = { template: '<div />' }
const router = createRouter({
  history: createMemoryHistory(),
  routes: [
    { path: '/', component: stub },
    { path: '/login', component: stub },
    { path: '/orgs', component: stub },
    { path: '/dashboard', component: stub, meta: { requiresAuth: true } },
    { path: '/links', component: stub, meta: { requiresAuth: true } },
    { path: '/manage/tix', component: stub, meta: { requiresAuth: true } },
    { path: '/manage/frames', component: stub, meta: { requiresAuth: true } },
    { path: '/forms', component: stub, meta: { requiresAuth: true } },
    { path: '/invites', component: stub, meta: { requiresAuth: true } },
    { path: '/account', component: stub, meta: { requiresAuth: true } },
  ],
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

function signIn() {
  const session = useSession()
  session.user.value = { id: 'user-1', email: 'ada@apc.edu.ph', name: 'Ada', role: 'user' }
  session.status.value = 'ready'
  session.pendingInviteCount.value = 1
}

async function mountAt(path: string) {
  await router.push(path)
  await router.isReady()
  const wrapper = mount(AppShell, {
    attachTo: document.body,
    slots: { default: '<p id="page">Page</p>' },
    global: {
      plugins: [router],
      stubs: { TheFooter: { template: '<footer id="footer" />' } },
    },
  })
  await flushPromises()
  return wrapper
}

beforeEach(() => {
  vi.stubGlobal('matchMedia', () => media(false))
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ orgs: [] }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })))
  localStorage.clear()
  useSession().reset()
})

afterEach(() => {
  document.body.innerHTML = ''
})

describe('AppShell (signed in)', () => {
  it('uses a dvh column that splits into a row at lg', async () => {
    signIn()
    const wrapper = await mountAt('/links')
    const root = wrapper.get('[data-app-shell]')
    for (const cls of ['h-dvh', 'flex-col']) expect(root.classes()).toContain(cls)
    expect(wrapper.get('[data-shell-body]').classes()).toContain('lg:flex-row')
    wrapper.unmount()
  })

  it('scrolls a content pane that clears the tab bar below lg', async () => {
    signIn()
    const wrapper = await mountAt('/links')
    const main = wrapper.get('main#app-content')
    for (const cls of ['min-h-0', 'flex-1', 'overflow-y-auto', 'pb-[calc(4.5rem+env(safe-area-inset-bottom))]', 'lg:pb-0']) {
      expect(main.classes()).toContain(cls)
    }
    expect(main.find('#page').exists()).toBe(true)
    expect(main.classes().some((cls) => /^pt-/.test(cls))).toBe(false)
    wrapper.unmount()
  })

  it('renders the tab bar and the side rail', async () => {
    signIn()
    const wrapper = await mountAt('/links')
    expect(wrapper.find('nav[aria-label="Primary"]').exists()).toBe(true)
    expect(wrapper.find('aside.w-56').exists()).toBe(true)
    wrapper.unmount()
  })

  it('opens the navigation drawer from More', async () => {
    signIn()
    const wrapper = await mountAt('/links')
    expect(document.getElementById('site-nav-sidebar')).toBeNull()
    await wrapper.get('nav[aria-label="Primary"] button').trigger('click')
    await flushPromises()
    const dialog = document.getElementById('site-nav-sidebar')
    expect(dialog?.getAttribute('role')).toBe('dialog')
    expect(wrapper.get('nav[aria-label="Primary"] button').attributes('aria-expanded')).toBe('true')
    wrapper.unmount()
  })

  it('uses the app shell for org pages too', async () => {
    signIn()
    const wrapper = await mountAt('/orgs')
    expect(wrapper.find('[data-app-shell]').exists()).toBe(true)
    wrapper.unmount()
  })
})

describe('AppShell (public)', () => {
  it('keeps the top bar and normal document scroll', async () => {
    const wrapper = await mountAt('/')
    expect(wrapper.find('[data-app-shell]').exists()).toBe(false)
    expect(wrapper.find('nav[aria-label="Primary"]').exists()).toBe(false)
    expect(wrapper.findComponent(TheHeader).exists()).toBe(true)
    const main = wrapper.get('main#app-content')
    expect(main.classes()).not.toContain('overflow-y-auto')
    expect(main.classes().some((cls) => /^pt-/.test(cls))).toBe(false)
    expect(wrapper.find('#footer').exists()).toBe(true)
    wrapper.unmount()
  })

  it('opens the public drawer from the header menu button', async () => {
    const wrapper = await mountAt('/')
    await wrapper.get('[aria-label="Open navigation menu"]').trigger('click')
    await flushPromises()
    expect(wrapper.findComponent(NavSidebar).props('isOpen')).toBe(true)
    expect(document.querySelector('#site-nav-sidebar a[href="/orgs"]')).not.toBeNull()
    wrapper.unmount()
  })
})
