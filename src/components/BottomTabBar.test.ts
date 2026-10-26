// @vitest-environment happy-dom
import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'
import BottomTabBar from './BottomTabBar.vue'
import { navItems } from '@/config/nav'

const stub = { template: '<div />' }
const router = createRouter({
  history: createMemoryHistory(),
  routes: ['/', '/dashboard', '/links', '/manage/tix', '/manage/tix/:id', '/manage/frames', '/forms', '/orgs', '/invites', '/account'].map(
    (path) => ({ path, component: stub }),
  ),
})

const items = navItems({ authenticated: true, admin: false })

async function mountAt(path: string, props: Record<string, unknown> = {}) {
  await router.push(path)
  await router.isReady()
  return mount(BottomTabBar, {
    props: { items, moreOpen: false, inviteCount: 0, ...props },
    global: { plugins: [router] },
  })
}

beforeEach(async () => {
  await router.push('/')
})

describe('BottomTabBar', () => {
  it('renders a Primary nav with four tabs and More', async () => {
    const wrapper = await mountAt('/dashboard')
    const nav = wrapper.get('nav[aria-label="Primary"]')
    expect(nav.classes()).toContain('lg:hidden')
    expect(nav.classes()).toContain('safe-bottom')

    const tabs = nav.findAll('a')
    expect(tabs.map((tab) => tab.text())).toEqual(['Dashboard', 'Links', 'Tix', 'Frames'])
    const more = nav.get('button')
    expect(more.text()).toContain('More')
    expect(more.attributes('aria-controls')).toBe('site-nav-sidebar')
    expect(more.attributes('aria-expanded')).toBe('false')
  })

  it('uses a 4.5rem grid so every target is at least 44px tall', async () => {
    const wrapper = await mountAt('/dashboard')
    const grid = wrapper.get('[data-tab-grid]')
    expect(grid.classes()).toContain('grid')
    expect(grid.classes()).toContain('h-[4.5rem]')
    expect(grid.classes()).toContain('grid-cols-5')
  })

  it('marks the active tab with aria-current', async () => {
    const wrapper = await mountAt('/manage/tix/abc')
    const current = wrapper.findAll('[aria-current="page"]')
    expect(current).toHaveLength(1)
    expect(current[0].text()).toBe('Tix')
  })

  it('emits more when More is pressed', async () => {
    const wrapper = await mountAt('/dashboard')
    await wrapper.get('button').trigger('click')
    expect(wrapper.emitted('more')).toHaveLength(1)
  })

  it('marks More as current on pages that only live in the drawer', async () => {
    const wrapper = await mountAt('/invites')
    expect(wrapper.get('button').attributes('aria-current')).toBe('page')
    expect(wrapper.findAll('a[aria-current="page"]')).toHaveLength(0)
  })

  it('shows the pending invite badge on More', async () => {
    const wrapper = await mountAt('/dashboard', { inviteCount: 2 })
    const more = wrapper.get('button')
    expect(more.attributes('aria-label')).toBe('More, 2 pending invites')
    expect(more.text()).toContain('2')

    const none = await mountAt('/dashboard', { inviteCount: 0 })
    expect(none.get('button').attributes('aria-label')).toBe('More')
  })
})
