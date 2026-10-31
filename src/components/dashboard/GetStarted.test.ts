// @vitest-environment happy-dom
import { mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'
import GetStarted from './GetStarted.vue'
import { resetGetStartedState } from '@/composables/useGetStarted'

const router = createRouter({
  history: createMemoryHistory(),
  routes: [
    { path: '/', component: { template: '<div />' } },
    { path: '/links', component: { template: '<div />' } },
    { path: '/wallpaper', component: { template: '<div />' } },
    { path: '/invites', component: { template: '<div />' } },
  ],
})

beforeEach(async () => {
  localStorage.clear()
  resetGetStartedState()
  await router.push('/')
})

afterEach(() => {
  localStorage.clear()
})

describe('GetStarted', () => {
  it('renders progress, step links with status words, and a 44px dismiss', async () => {
    localStorage.setItem('eypi.wallpaperMade', '1')
    const wrapper = mount(GetStarted, {
      props: {
        linkCount: 0,
        pendingInvites: 1,
      },
      global: { plugins: [router] },
    })
    expect(wrapper.text()).toContain('1 of 3 done')
    const links = wrapper.findAll('a')
    expect(links).toHaveLength(3)
    expect(links[0].attributes('href')).toBe('/links')
    expect(links[1].attributes('href')).toBe('/wallpaper')
    expect(links[2].attributes('href')).toBe('/invites')
    const checks = wrapper.findAll('[aria-hidden="true"]')
    expect(checks.length).toBeGreaterThanOrEqual(3)
    expect(wrapper.text()).toMatch(/done/i)
    expect(wrapper.text()).toMatch(/to do/i)
    const dismiss = wrapper.get('button')
    expect(dismiss.text()).toMatch(/dismiss/i)
    expect(dismiss.classes().join(' ')).toMatch(/min-h-11/)
  })

  it('hides after dismiss', async () => {
    const wrapper = mount(GetStarted, {
      props: {
        linkCount: 0,
        pendingInvites: 1,
      },
      global: { plugins: [router] },
    })
    await wrapper.get('button').trigger('click')
    expect(wrapper.find('[data-get-started]').exists()).toBe(false)
    expect(localStorage.getItem('eypi.getStartedDismissed')).toBe('1')
  })

  it('renders nothing while linkCount is null', () => {
    const wrapper = mount(GetStarted, {
      props: {
        linkCount: null,
        pendingInvites: 0,
      },
      global: { plugins: [router] },
    })
    expect(wrapper.find('[data-get-started]').exists()).toBe(false)
  })
})