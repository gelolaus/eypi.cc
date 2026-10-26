// @vitest-environment happy-dom
import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'
import AdminAuditView from './AdminAuditView.vue'
import AdminLayout from './AdminLayout.vue'
import AdminLinksView from './AdminLinksView.vue'
import AdminUsersView from './AdminUsersView.vue'

vi.mock('@/composables/useDialog', () => ({
  useDialog: () => ({ confirm: vi.fn(async () => true), info: vi.fn() }),
}))

function stub(body: unknown) {
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })))
}

afterEach(() => vi.unstubAllGlobals())

describe('admin mobile layout', () => {
  it('users render as cards without a fixed min width', async () => {
    stub({ items: [{ id: 'u1', email: 'a@b.c', name: 'A', role: 'user', disabled: false, createdAt: '2026-06-30 17:30:00' }], nextCursor: null })
    const wrapper = mount(AdminUsersView)
    await flushPromises()
    expect(wrapper.html()).not.toMatch(/min-w-\[8\d0px\]/)
    expect(wrapper.find('[data-admin-row]').exists()).toBe(true)
    const buttons = wrapper.findAll('[data-admin-row] button')
    expect(buttons.length).toBeGreaterThan(0)
    for (const b of buttons) expect(b.classes().join(' ')).toMatch(/btn-|min-h-11/)
  })

  it('links render as cards with 44px actions', async () => {
    stub({ items: [{ id: 'l1', slug: 's', originalUrl: 'https://x.y', ownerEmail: 'a@b.c', createdAt: '', disabled: false, disabledReason: null }], nextCursor: null })
    const wrapper = mount(AdminLinksView)
    await flushPromises()
    expect(wrapper.html()).not.toMatch(/min-w-\[8\d0px\]/)
    expect(wrapper.find('[data-admin-row]').exists()).toBe(true)
    expect(wrapper.find('select').classes()).toContain('control')
    expect(wrapper.find('[data-admin-row] button').classes().join(' ')).toMatch(/btn-danger/)
  })

  it('audit entries render as cards', async () => {
    stub({ items: [{ id: 'a1', actorUserId: 'x', actorEmail: 'a@b.c', action: 'user.role', targetType: 'user', targetId: 'u', meta: { a: 1 }, createdAt: '2026-06-30 17:30:00' }], nextCursor: null })
    const wrapper = mount(AdminAuditView)
    await flushPromises()
    expect(wrapper.html()).not.toMatch(/min-w-\[8\d0px\]/)
    expect(wrapper.find('[data-admin-row]').exists()).toBe(true)
    expect(wrapper.find('[data-admin-row] button').classes()).toContain('min-h-11')
  })

  it('layout has no nested main and a snapping scrollable tab nav', async () => {
    const router = createRouter({ history: createMemoryHistory(), routes: ['users', 'links', 'reports', 'orgs', 'audit'].map((n) => ({ path: n === 'users' ? '/' : `/${n}`, name: `admin-${n}`, component: { template: '<i />' } })) })
    await router.push('/')
    const wrapper = mount(AdminLayout, { global: { plugins: [router] } })
    expect(wrapper.find('main').exists()).toBe(false)
    const nav = wrapper.find('nav[aria-label="Admin sections"]')
    expect(nav.classes()).toContain('overflow-x-auto')
    expect(nav.classes()).toContain('snap-x')
    expect(nav.findAll('a').every((a) => a.classes().includes('min-h-11'))).toBe(true)
  })
})
