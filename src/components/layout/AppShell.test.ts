// @vitest-environment happy-dom
import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'
import AppShell from './AppShell.vue'
import MarketingHeader from '@/components/marketing/MarketingHeader.vue'
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
    { path: '/admin/users', component: stub, meta: { requiresAuth: true } },
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

function signIn(invites = 1, role: 'user' | 'admin' = 'user') {
  const session = useSession()
  session.user.value = { id: 'user-1', email: 'ada@apc.edu.ph', name: 'Ada', role }
  session.status.value = 'ready'
  session.pendingInviteCount.value = invites
}

const mounted: Array<{ unmount: () => void }> = []

async function mountAt(path: string) {
  await router.push(path)
  await router.isReady()
  const wrapper = mount(AppShell, {
    attachTo: document.body,
    slots: { default: '<p id="page">Page</p>' },
    global: {
      plugins: [router],
      stubs: { MarketingFooter: { template: '<footer id="footer" />' } },
    },
  })
  await flushPromises()
  mounted.push(wrapper)
  return wrapper
}

async function openAccountMenu(wrapper: Awaited<ReturnType<typeof mountAt>>, variant: 'header' | 'sidebar' = 'header') {
  await wrapper.get(`[data-account-menu="${variant}"]`).trigger('click')
  await flushPromises()
  return document.body.querySelector<HTMLElement>('[data-slot="dropdown-menu-content"]')!
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
  for (const wrapper of mounted.splice(0)) {
    try {
      wrapper.unmount()
    } catch {
      // already unmounted by the test
    }
  }
  document.body.innerHTML = ''
})

describe('AppShell (signed in)', () => {
  it('uses a dvh column that splits into a row at lg', async () => {
    signIn()
    const wrapper = await mountAt('/links')
    const root = wrapper.get('[data-app-shell]')
    for (const cls of ['h-dvh', 'flex-col', 'bg-background']) expect(root.classes()).toContain(cls)
    expect(wrapper.get('[data-shell-body]').classes()).toContain('lg:flex-row')
    wrapper.unmount()
  })

  it('scrolls a content pane that clears the bottom tabs below lg', async () => {
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

  it('renders a wantap sidebar that is hidden below lg', async () => {
    signIn()
    const wrapper = await mountAt('/links')
    const aside = wrapper.get('aside')
    for (const cls of ['hidden', 'lg:flex', 'w-64', 'border-r', 'bg-background/95']) {
      expect(aside.classes()).toContain(cls)
    }
    const links = aside.get('nav[aria-label="App modules"]').findAll('a')
    expect(links.map((link) => link.text().replace(/\d+$/, '').trim())).toEqual([
      'Dashboard', 'Links', 'Tix', 'Frames', 'Forms', 'Orgs', 'Invites',
    ])
    wrapper.unmount()
  })

  it('collapses the sidebar to icons, labels them for assistive tech and remembers the choice', async () => {
    signIn()
    const wrapper = await mountAt('/links')
    const aside = wrapper.get('aside')
    expect(aside.classes()).toContain('w-64')
    await aside.get('button[aria-label="Collapse sidebar"]').trigger('click')
    expect(aside.classes()).toContain('w-16')
    expect(aside.classes()).not.toContain('w-64')
    expect(localStorage.getItem('eypi.rail.collapsed')).toBe('true')
    const link = aside.get('nav a[href="/links"]')
    expect(link.attributes('title')).toBe('Links')
    expect(link.get('span').classes()).toContain('sr-only')
    expect(aside.find('button[aria-label="Expand sidebar"]').exists()).toBe(true)
    wrapper.unmount()
  })

  it('starts collapsed when the choice was saved', async () => {
    localStorage.setItem('eypi.rail.collapsed', 'true')
    signIn()
    const wrapper = await mountAt('/links')
    expect(wrapper.get('aside').classes()).toContain('w-16')
    wrapper.unmount()
  })

  it('drops the account chevron when collapsed', async () => {
    signIn()
    const wrapper = await mountAt('/links')
    const footer = () => wrapper.get('aside > div:last-child')
    await wrapper.get('button[aria-label="Collapse sidebar"]').trigger('click')
    expect(footer().findAll('svg[class*="chevron"]')).toHaveLength(0)
    wrapper.unmount()
  })

  it('highlights the sidebar link for the current route', async () => {
    signIn()
    const wrapper = await mountAt('/links')
    const active = wrapper.get('aside [aria-current="page"]')
    expect(active.text()).toBe('Links')
    for (const cls of ['bg-primary/15', 'text-foreground']) expect(active.classes()).toContain(cls)
    expect(wrapper.findAll('aside [aria-current="page"]')).toHaveLength(1)
    wrapper.unmount()
  })

  it('shows at most four module links in the Primary bottom nav', async () => {
    signIn()
    const wrapper = await mountAt('/manage/tix')
    const nav = wrapper.get('nav[aria-label="Primary"]')
    for (const cls of ['fixed', 'inset-x-0', 'bottom-0', 'lg:hidden']) expect(nav.classes()).toContain(cls)
    const tabs = nav.findAll('a')
    expect(tabs.map((tab) => tab.text())).toEqual(['Dashboard', 'Links', 'Tix', 'Frames'])
    expect(nav.get('[data-tab-grid]').classes()).toEqual(expect.arrayContaining(['grid', 'h-[4.5rem]', 'grid-cols-4']))
    expect(nav.get('[aria-current="page"]').text()).toBe('Tix')
    wrapper.unmount()
  })

  it('puts a logo and the account menu in the mobile top bar', async () => {
    signIn()
    const wrapper = await mountAt('/links')
    const header = wrapper.get('header')
    for (const cls of ['sticky', 'top-0', 'h-14', 'lg:hidden', 'border-b']) expect(header.classes()).toContain(cls)
    expect(header.find('a[aria-label="Eypi"]').exists()).toBe(true)
    expect(header.find('[data-account-menu="header"]').exists()).toBe(true)
    wrapper.unmount()
  })

  it('opens the account menu with the overflow modules and sign out', async () => {
    signIn(2)
    const wrapper = await mountAt('/links')
    expect(document.body.querySelector('[data-slot="dropdown-menu-content"]')).toBeNull()
    const menu = await openAccountMenu(wrapper)
    const text = menu.textContent ?? ''
    for (const label of ['Forms', 'Orgs', 'Invites', 'Account', 'Sign out']) expect(text).toContain(label)
    expect(text).not.toContain('Dashboard')
    wrapper.unmount()
  })

  it('shows the pending invite count on the Invites entry and labels the trigger', async () => {
    signIn(2)
    const wrapper = await mountAt('/links')
    expect(wrapper.get('[data-account-menu="header"]').attributes('aria-label')).toBe('Ada account menu, 2 pending invites')
    const menu = await openAccountMenu(wrapper)
    const invites = menu.querySelector<HTMLElement>('a[href="/invites"]')!
    const badge = invites.querySelector('[data-slot="badge"]')!
    expect(badge.textContent?.trim()).toBe('2')
    expect(badge.getAttribute('aria-label')).toBe('2 pending invites')
    wrapper.unmount()
  })

  it('omits the invite badge when nothing is pending', async () => {
    signIn(0)
    const wrapper = await mountAt('/links')
    expect(wrapper.get('[data-account-menu="header"]').attributes('aria-label')).toBe('Ada account menu')
    const menu = await openAccountMenu(wrapper)
    expect(menu.querySelector('[data-slot="badge"]')).toBeNull()
    wrapper.unmount()
  })

  it('puts Admin in the account menu for admins only', async () => {
    signIn(0, 'admin')
    const wrapper = await mountAt('/admin/users')
    expect(wrapper.find('aside nav a[href="/admin/users"]').exists()).toBe(false)
    const menu = await openAccountMenu(wrapper, 'sidebar')
    const admin = menu.querySelector<HTMLElement>('a[href="/admin/users"]')!
    expect(admin.textContent).toContain('Admin')
    expect(admin.getAttribute('aria-current')).toBe('page')
    wrapper.unmount()
  })

  it('hides Admin from regular users', async () => {
    signIn(0)
    const wrapper = await mountAt('/links')
    const menu = await openAccountMenu(wrapper, 'sidebar')
    expect(menu.textContent).not.toContain('Admin')
    wrapper.unmount()
  })

  it('lists Account, Contact, Privacy, Terms and Sign out in the sidebar menu', async () => {
    signIn()
    const wrapper = await mountAt('/links')
    const menu = await openAccountMenu(wrapper, 'sidebar')
    const items = Array.from(menu.querySelectorAll('[data-slot="dropdown-menu-item"]')).map((el) => el.textContent?.trim())
    expect(items).toEqual(['Account', 'Contact', 'Privacy', 'Terms', 'Sign out'])
    wrapper.unmount()
  })

  it('signs out from the menu and returns to the login page', async () => {
    signIn(0)
    const wrapper = await mountAt('/links')
    const menu = await openAccountMenu(wrapper)
    const item = Array.from(menu.querySelectorAll<HTMLElement>('[data-slot="dropdown-menu-item"]'))
      .find((el) => el.textContent?.includes('Sign out'))!
    item.click()
    // logout lazy-imports a module, so give it more than one microtask turn
    await vi.waitFor(() => expect(router.currentRoute.value.path).toBe('/login'))
    expect(useSession().user.value).toBeNull()
    wrapper.unmount()
  })

  it('also offers sign out from the sidebar account menu', async () => {
    signIn()
    const wrapper = await mountAt('/links')
    const menu = await openAccountMenu(wrapper, 'sidebar')
    expect(menu.textContent).toContain('Sign out')
    wrapper.unmount()
  })

  it('restores the pane position on back and resets it on push', async () => {
    signIn()
    const wrapper = await mountAt('/links')
    const pane = wrapper.get('main#app-content').element as HTMLElement
    const scrollTo = vi.fn((options: ScrollToOptions) => {
      pane.scrollTop = options.top ?? 0
    })
    pane.scrollTo = scrollTo as unknown as typeof pane.scrollTo

    pane.scrollTop = 640
    await router.push('/manage/tix')
    await flushPromises()
    expect(scrollTo).toHaveBeenLastCalledWith({ top: 0, behavior: 'smooth' })

    router.back()
    await flushPromises()
    expect(scrollTo).toHaveBeenLastCalledWith({ top: 640, behavior: 'auto' })
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
    expect(wrapper.find('aside').exists()).toBe(false)
    expect(wrapper.findComponent(MarketingHeader).exists()).toBe(true)
    const main = wrapper.get('main#app-content')
    expect(main.classes()).not.toContain('overflow-y-auto')
    expect(main.classes().some((cls) => /^pt-/.test(cls))).toBe(false)
    expect(wrapper.find('#footer').exists()).toBe(true)
    wrapper.unmount()
  })

  it('opens the public menu sheet from the header menu button', async () => {
    const wrapper = await mountAt('/')
    expect(document.getElementById('site-nav-sidebar')).toBeNull()
    await wrapper.get('[aria-label="Open navigation menu"]').trigger('click')
    await flushPromises()
    const sheet = document.getElementById('site-nav-sidebar')!
    expect(sheet.getAttribute('role')).toBe('dialog')
    expect(sheet.querySelector('a[href="/orgs"]')).not.toBeNull()
    wrapper.unmount()
  })
})
