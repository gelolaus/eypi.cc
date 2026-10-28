// @vitest-environment happy-dom
import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'
import PublicShell from './PublicShell.vue'
import { useSession } from '@/stores/session'

const stub = { template: '<div />' }
const router = createRouter({
  history: createMemoryHistory(),
  routes: [
    { path: '/', component: stub },
    { path: '/login', component: stub },
    { path: '/dashboard', component: stub },
    { path: '/orgs', name: 'org-catalog', component: stub },
    { path: '/privacy', component: stub },
  ],
})

function headerLink(wrapper: ReturnType<typeof mount>, text: string) {
  return wrapper.findAll('header a').find((a) => a.text() === text)
}

const mounted: Array<{ unmount: () => void }> = []

async function mountShell() {
  await router.push('/')
  await router.isReady()
  const wrapper = mount(PublicShell, {
    attachTo: document.body,
    slots: { default: '<p id="page">Page</p>' },
    global: { plugins: [router] },
  })
  await flushPromises()
  mounted.push(wrapper)
  return wrapper
}

beforeEach(() => {
  useSession().reset()
})

afterEach(() => {
  for (const wrapper of mounted.splice(0)) wrapper.unmount()
  document.body.innerHTML = ''
})

describe('PublicShell', () => {
  it('renders the brand header, the slot in main#app-content and the footer', async () => {
    const wrapper = await mountShell()
    expect(wrapper.find('header a[aria-label="Eypi"]').exists()).toBe(true)
    expect(wrapper.get('main#app-content').find('#page').exists()).toBe(true)
    expect(wrapper.find('footer#footer').exists()).toBe(true)
  })

  it('shows a neutral placeholder, not Sign in, until the session resolves', async () => {
    const session = useSession()
    session.status.value = 'loading'
    const wrapper = await mountShell()
    expect(wrapper.find('[data-header-account-placeholder]').exists()).toBe(true)
    expect(headerLink(wrapper, 'Sign in')).toBeUndefined()
    expect(headerLink(wrapper, 'Dashboard')).toBeUndefined()
  })

  it('swaps the placeholder for Dashboard when a signed-in session resolves', async () => {
    const session = useSession()
    session.status.value = 'loading'
    const wrapper = await mountShell()
    session.user.value = { id: 'u1', email: 'ada@apc.edu.ph', name: 'Ada', role: 'user' }
    session.status.value = 'ready'
    await flushPromises()
    expect(wrapper.find('[data-header-account-placeholder]').exists()).toBe(false)
    expect(headerLink(wrapper, 'Dashboard')?.attributes('href')).toBe('/dashboard')
    expect(headerLink(wrapper, 'Sign in')).toBeUndefined()
  })

  it('shows Sign in once the session resolves signed out', async () => {
    const session = useSession()
    session.status.value = 'ready'
    const wrapper = await mountShell()
    expect(wrapper.find('[data-header-account-placeholder]').exists()).toBe(false)
    expect(headerLink(wrapper, 'Sign in')?.attributes('href')).toBe('/login')
    expect(headerLink(wrapper, 'Dashboard')).toBeUndefined()
  })

  it('falls back to Sign in when the session load failed and settled with no user', async () => {
    const session = useSession()
    session.status.value = 'idle'
    const wrapper = await mountShell()
    expect(wrapper.find('[data-header-account-placeholder]').exists()).toBe(true)
    session.settled.value = true
    await flushPromises()
    expect(wrapper.find('[data-header-account-placeholder]').exists()).toBe(false)
    expect(headerLink(wrapper, 'Sign in')?.attributes('href')).toBe('/login')
  })

  it('keeps an Orgs link next to the auth button, hidden on narrow screens', async () => {
    const session = useSession()
    session.status.value = 'ready'
    const wrapper = await mountShell()
    const orgs = headerLink(wrapper, 'Orgs')
    expect(orgs?.attributes('href')).toBe('/orgs')
    expect(orgs?.classes()).toContain('hidden')
    expect(orgs?.classes()).toContain('sm:flex')
  })
})
