// @vitest-environment happy-dom
import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'
import SideRail from './SideRail.vue'
import { navItems } from '@/config/nav'

const stub = { template: '<div />' }
const router = createRouter({
  history: createMemoryHistory(),
  routes: ['/', '/dashboard', '/links', '/manage/tix', '/manage/frames', '/forms', '/orgs', '/invites', '/account', '/admin/users'].map(
    (path) => ({ path, component: stub }),
  ),
})

vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ orgs: [] }), {
  status: 200,
  headers: { 'Content-Type': 'application/json' },
})))

async function mountAt(path: string, inviteCount = 0) {
  await router.push(path)
  await router.isReady()
  return mount(SideRail, {
    props: { items: navItems({ authenticated: true, admin: true }), inviteCount },
    global: { plugins: [router] },
  })
}

describe('SideRail', () => {
  it('is hidden below lg and 14rem wide from lg', async () => {
    const wrapper = await mountAt('/dashboard')
    const aside = wrapper.get('aside')
    for (const cls of ['hidden', 'lg:flex', 'w-56']) expect(aside.classes()).toContain(cls)
  })

  it('lists every app item with rounded-xl rows', async () => {
    const wrapper = await mountAt('/dashboard')
    const links = wrapper.get('nav[aria-label="App modules"]').findAll('a')
    expect(links.map((link) => link.text())).toEqual([
      'Dashboard', 'Links', 'Tix', 'Frames', 'Forms', 'Orgs', 'Invites', 'Account', 'Admin',
    ])
    for (const cls of ['rounded-xl', 'px-3', 'py-2.5']) expect(links[0].classes()).toContain(cls)
  })

  it('highlights the active item', async () => {
    const wrapper = await mountAt('/links')
    const active = wrapper.get('[aria-current="page"]')
    expect(active.text()).toBe('Links')
    expect(active.classes()).toContain('bg-primary/15')
  })

  it('shows the invite badge and emits logout', async () => {
    const wrapper = await mountAt('/dashboard', 3)
    const invites = wrapper.get('a[href="/invites"]')
    expect(invites.text()).toContain('3')
    await wrapper.get('[data-rail-logout]').trigger('click')
    expect(wrapper.emitted('logout')).toHaveLength(1)
  })

  it('has no theme toggle', async () => {
    const wrapper = await mountAt('/dashboard')
    expect(wrapper.find('[aria-label="Toggle dark mode"]').exists()).toBe(false)
  })
})
