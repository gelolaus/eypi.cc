// @vitest-environment happy-dom
import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'
import SiteNavSheet from './layout/SiteNavSheet.vue'
import { useNavDrawer } from '@/composables/useNavDrawer'
import MarketingHeader from './marketing/MarketingHeader.vue'
import { useSession } from '@/stores/session'

const router = createRouter({
  history: createMemoryHistory(),
  routes: [
    { path: '/', component: { template: '<div />' } },
    { path: '/dashboard', component: { template: '<div />' } },
    { path: '/links', component: { template: '<div />' } },
    { path: '/forms', component: { template: '<div />' } },
    { path: '/manage/tix', component: { template: '<div />' } },
    { path: '/manage/frames', component: { template: '<div />' } },
    { path: '/orgs', component: { template: '<div />' } },
    { path: '/invites', component: { template: '<div />' } },
    { path: '/account', component: { template: '<div />' } },
    { path: '/login', component: { template: '<div />' } },
  ],
})

function signIn(count: number) {
  const session = useSession()
  session.user.value = {
    id: 'user-1',
    email: 'ada@apc.edu.ph',
    name: 'Ada',
    role: 'user',
  }
  session.status.value = 'ready'
  session.pendingInviteCount.value = count
}

beforeEach(async () => {
  localStorage.clear()
  useSession().reset()
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ orgs: [] }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })))
  await router.push('/')
  await router.isReady()
})

describe('invite badge', () => {
  it('shows pendingInviteCount on the header menu', async () => {
    signIn(2)
    const wrapper = mount(MarketingHeader, {
      attachTo: document.body,
      global: { plugins: [router] },
    })
    await flushPromises()

    expect(wrapper.get('[aria-label="Open navigation menu, 2 pending invites"]').text()).toContain('2')
    wrapper.unmount()
  })

  it('shows pendingInviteCount on the Invites nav link', async () => {
    signIn(2)
    const wrapper = mount(SiteNavSheet, {
      attachTo: document.body,
      global: { plugins: [router] },
    })
    useNavDrawer().open()
    await flushPromises()

    const link = document.querySelector('a[href="/invites"]')
    expect(link?.textContent).toContain('Invites')
    expect(link?.textContent).toContain('2')
    useNavDrawer().close()
    wrapper.unmount()
  })

  it('omits the badge when pendingInviteCount is zero', async () => {
    signIn(0)
    const wrapper = mount(MarketingHeader, {
      attachTo: document.body,
      global: { plugins: [router] },
    })
    await flushPromises()

    expect(wrapper.find('[aria-label="Open navigation menu"]').exists()).toBe(true)
    expect(wrapper.find('[aria-label="Open navigation menu, 0 pending invites"]').exists()).toBe(false)
    wrapper.unmount()
  })
})
