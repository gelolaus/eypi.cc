// @vitest-environment happy-dom
import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'
import AdminAuditView from './AdminAuditView.vue'
import AdminLayout from './AdminLayout.vue'
import AdminLinksView from './AdminLinksView.vue'
import AdminReportsView from './AdminReportsView.vue'
import AdminUsersView from './AdminUsersView.vue'
import LegalView from '../LegalView.vue'
import contact from '../ContactView.vue?raw'
import legalLayout from '@/components/LegalLayout.vue?raw'
import legalView from '../LegalView.vue?raw'
import adminAudit from './AdminAuditView.vue?raw'
import adminLayout from './AdminLayout.vue?raw'
import adminLinks from './AdminLinksView.vue?raw'
import adminReports from './AdminReportsView.vue?raw'
import adminUsers from './AdminUsersView.vue?raw'

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
    for (const b of buttons) {
      expect(b.attributes('data-slot')).toBe('button')
      expect(b.classes().join(' ')).toMatch(/h-(8|9|11|12)/)
    }
    expect(wrapper.find('[data-admin-row]').element.closest('.overflow-x-auto')).not.toBeNull()
  })

  it('links render as cards with 44px actions', async () => {
    stub({ items: [{ id: 'l1', slug: 's', originalUrl: 'https://x.y', ownerEmail: 'a@b.c', createdAt: '', disabled: false, disabledReason: null }], nextCursor: null })
    const wrapper = mount(AdminLinksView)
    await flushPromises()
    expect(wrapper.html()).not.toMatch(/min-w-\[8\d0px\]/)
    expect(wrapper.find('[data-admin-row]').exists()).toBe(true)
    expect(wrapper.find('select').classes()).toContain('h-11')
    const disable = wrapper.find('[data-admin-row] button')
    expect(disable.attributes('data-slot')).toBe('button')
    expect(disable.classes().join(' ')).toMatch(/text-destructive/)
    expect(wrapper.find('[data-admin-row]').element.closest('.overflow-x-auto')).not.toBeNull()
  })

  it('audit entries render as cards', async () => {
    stub({ items: [{ id: 'a1', actorUserId: 'x', actorEmail: 'a@b.c', action: 'user.role', targetType: 'user', targetId: 'u', meta: { a: 1 }, createdAt: '2026-06-30 17:30:00' }], nextCursor: null })
    const wrapper = mount(AdminAuditView)
    await flushPromises()
    expect(wrapper.html()).not.toMatch(/min-w-\[8\d0px\]/)
    expect(wrapper.find('[data-admin-row]').exists()).toBe(true)
    expect(wrapper.find('[data-admin-row] button').classes()).toContain('h-11')
    expect(wrapper.find('[data-admin-row]').element.closest('.overflow-x-auto')).not.toBeNull()
  })

  it('reports use Badge and Button primitives', async () => {
    stub({ items: [{ id: 'r1', linkId: 'l', slug: 's', reason: 'spam', details: null, status: 'open', resolution: null, createdAt: '', resolvedAt: null, resolvedBy: null, ownerEmail: null, linkSlug: 's', linkDisabled: true }] })
    const wrapper = mount(AdminReportsView)
    await flushPromises()
    expect(wrapper.findAll('[data-slot="badge"]').length).toBeGreaterThanOrEqual(2)
    for (const b of wrapper.findAll('[data-admin-row] button')) expect(b.attributes('data-slot')).toBe('button')
    expect(wrapper.find('nav[aria-label="Report status"]').classes()).toContain('overflow-x-auto')
  })

  it('layout has no nested main and a snapping scrollable tab nav', async () => {
    const router = createRouter({ history: createMemoryHistory(), routes: ['overview', 'users', 'links', 'reports', 'orgs', 'audit'].map((n) => ({ path: n === 'overview' ? '/' : '/' + n, name: 'admin-' + n, component: { template: '<i />' } })) })
    await router.push('/')
    const wrapper = mount(AdminLayout, { global: { plugins: [router] } })
    expect(wrapper.find('main').exists()).toBe(false)
    const nav = wrapper.find('nav[aria-label="Admin sections"]')
    expect(nav.classes()).toContain('overflow-x-auto')
    expect(nav.classes()).toContain('snap-x')
    expect(nav.findAll('a').every((a) => a.classes().includes('h-11'))).toBe(true)
  })
})

describe('legal pages', () => {
  it('legal prose is muted, readable width and keeps headings', async () => {
    const { default: router } = await import('@/router')
    await router.push('/privacy')
    await router.isReady()
    const wrapper = mount(LegalView, { global: { plugins: [router] } })
    expect(wrapper.find('.max-w-prose').exists()).toBe(true)
    expect(wrapper.find('p.text-muted-foreground').exists()).toBe(true)
    expect(wrapper.find('h1').exists()).toBe(true)
    expect(wrapper.find('h2').exists()).toBe(true)
    expect(wrapper.find('section').classes()).toContain('min-h-dvh')
  })
})

const sources = { adminAudit, adminLayout, adminLinks, adminReports, adminUsers, legalLayout, legalView, contact }

describe('admin, legal and contact restyle', () => {
  it.each(Object.entries(sources))('%s has no legacy classes, scoped @apply or hard-coded colours', (_n, src) => {
    expect(src).not.toMatch(/(?<![a-z])g-(text|muted|border|accent|primary|surface|bg)|mica|gold|tap-scale|apc-|btn-(primary|secondary|danger|gold|lg)|\bcontrol\b|field-input|dark:(bg|text|border)-(slate|gray|white)|\bslate-\d|\bgray-\d|\bred-\d|bg-white|text-white|#[0-9a-fA-F]{3,8}\b|\breveal\b|\bdelay-|text-data|text-card-title|text-section-title|@apply|@reference|<style|—/)
  })
})
