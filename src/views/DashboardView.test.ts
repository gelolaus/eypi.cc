// @vitest-environment happy-dom
import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'
import DashboardView from './DashboardView.vue'
import { useSession } from '@/stores/session'

const router = createRouter({
  history: createMemoryHistory(),
  routes: [
    { path: '/', component: DashboardView },
    { path: '/invites', component: { template: '<div />' } },
    { path: '/links', component: { template: '<div />' } },
    { path: '/forms', component: { template: '<div />' } },
    { path: '/manage/tix', component: { template: '<div />' } },
    { path: '/manage/frames', component: { template: '<div />' } },
    { path: '/orgs', component: { template: '<div />' } },
  ],
})

function mountDashboard(count: number) {
  const session = useSession()
  session.user.value = {
    id: 'user-1',
    email: 'ada@apc.edu.ph',
    name: 'Ada',
    role: 'user',
  }
  session.pendingInviteCount.value = count
  return mount(DashboardView, {
    global: { plugins: [router] },
  })
}

beforeEach(async () => {
  useSession().reset()
  await router.push('/')
  await router.isReady()
})

describe('DashboardView invite banner', () => {
  it('links to the inbox when one invite is pending', () => {
    const wrapper = mountDashboard(1)

    expect(wrapper.text()).toContain('You have 1 pending org invite.')
    const link = wrapper.get('a[href="/invites"]')
    expect(link.text()).toBe('Review invites')
  })

  it('pluralizes the banner when several invites are pending', () => {
    const wrapper = mountDashboard(2)

    expect(wrapper.text()).toContain('You have 2 pending org invites.')
    expect(wrapper.get('a[href="/invites"]').text()).toBe('Review invites')
  })

  it('hides the banner when nothing is pending', () => {
    const wrapper = mountDashboard(0)

    expect(wrapper.text()).not.toContain('pending org invite')
    expect(wrapper.find('a[href="/invites"]').exists()).toBe(false)
  })
})
