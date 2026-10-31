// @vitest-environment happy-dom
import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'
import FeatureCards from './FeatureCards.vue'
import { useSession } from '@/stores/session'

const router = createRouter({
  history: createMemoryHistory(),
  routes: [
    { path: '/', component: { template: '<div />' } },
    { path: '/links', component: { template: '<div />' } },
    { path: '/tickets', component: { template: '<div />' } },
    { path: '/wallpaper', component: { template: '<div />' } },
    { path: '/invites', component: { template: '<div />' } },
    { path: '/orgs', component: { template: '<div />' } },
    { path: '/manage/tix', component: { template: '<div />' } },
    { path: '/manage/frames', component: { template: '<div />' } },
    { path: '/forms', component: { template: '<div />' } },
    { path: '/orgs/modify', component: { template: '<div />' } },
  ],
})

beforeEach(async () => {
  useSession().reset()
  await router.push('/')
  await router.isReady()
})

describe('FeatureCards', () => {
  it('renders only the Rams heading and five cards for a non-member', () => {
    const wrapper = mount(FeatureCards, {
      props: { admin: false, org: false },
      global: { plugins: [router] },
    })
    expect(wrapper.find('[data-group="rams"]').exists()).toBe(true)
    expect(wrapper.find('[data-group="orgs"]').exists()).toBe(false)
    const cards = wrapper.findAll('a > [data-slot="card"]')
    expect(cards).toHaveLength(5)
    expect(wrapper.find('a[href="/links"]').exists()).toBe(true)
    expect(wrapper.find('a[href="/tickets"]').exists()).toBe(true)
    expect(wrapper.find('a[href="/wallpaper"]').exists()).toBe(true)
    expect(wrapper.find('a[href="/invites"]').exists()).toBe(true)
    expect(wrapper.find('a[href="/orgs"]').exists()).toBe(true)
    expect(wrapper.find('a[href="/manage/tix"]').exists()).toBe(false)
  })

  it('renders both headings and nine cards for a member', () => {
    const wrapper = mount(FeatureCards, {
      props: { admin: false, org: true },
      global: { plugins: [router] },
    })
    expect(wrapper.find('[data-group="rams"]').exists()).toBe(true)
    expect(wrapper.find('[data-group="orgs"]').exists()).toBe(true)
    expect(wrapper.findAll('a > [data-slot="card"]')).toHaveLength(9)
    expect(wrapper.find('a[href="/manage/tix"]').exists()).toBe(true)
    expect(wrapper.find('a[href="/orgs/modify"]').exists()).toBe(true)
  })

  it('shows the invite badge only when pending invites exist', async () => {
    const session = useSession()
    session.pendingInviteCount.value = 0
    const empty = mount(FeatureCards, {
      props: { admin: false, org: false },
      global: { plugins: [router] },
    })
    expect(empty.find('[data-slot="badge"]').exists()).toBe(false)

    session.pendingInviteCount.value = 2
    const withBadge = mount(FeatureCards, {
      props: { admin: false, org: false },
      global: { plugins: [router] },
    })
    expect(withBadge.find('[data-slot="badge"]').text()).toContain('2')
  })
})