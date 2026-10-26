// @vitest-environment happy-dom
import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'
import OrgCatalogView from './OrgCatalogView.vue'
import OrgManagementView from '@/views/settings/OrgManagementView.vue'
import OrgSwitcher from '@/components/OrgSwitcher.vue'
import { useActiveOrg } from '@/composables/useActiveOrg'

const stub = { template: '<div />' }
const router = createRouter({
  history: createMemoryHistory(),
  routes: [
    { path: '/', component: stub },
    { path: '/orgs/:slug', component: stub },
    { path: '/admin/orgs/new', component: stub },
    { path: '/admin/orgs/:orgId', name: 'admin-orgs-edit', component: stub },
  ],
})

function json(body: unknown) {
  return new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } })
}

beforeEach(() => {
  localStorage.clear()
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
    const path = new URL(String(input), 'http://localhost').pathname
    if (path === '/api/orgs/admin') {
      return json({ orgs: [{ org_id: 'jpcs', org_name: 'JPCS', owner_email: 'a@b.c', is_public_catalog: 1, created_at: '' }] })
    }
    if (path === '/api/orgs/public') {
      return json({ orgs: [{ slug: 'jpcs', name: 'JPCS', tagline: null, logoUrl: null, orgType: null }] })
    }
    return json({ orgs: [] })
  }))
})

afterEach(() => {
  vi.unstubAllGlobals()
  document.body.innerHTML = ''
})

describe('orgs mobile layout', () => {
  it('OrgCatalogView uses AppPage', async () => {
    const wrapper = mount(OrgCatalogView, { global: { plugins: [router] } })
    await flushPromises()
    expect(wrapper.find('[data-app-page]').exists()).toBe(true)
    expect(wrapper.find('main').exists()).toBe(false)
    expect(wrapper.text()).toContain('JPCS')
  })

  it('OrgManagementView renders cards below md with a 44px edit action and no min-width wrapper', async () => {
    const wrapper = mount(OrgManagementView, { global: { plugins: [router] } })
    await flushPromises()
    const row = wrapper.get('[data-org-row]')
    expect(row.classes()).toContain('rounded-2xl')
    expect(wrapper.html()).not.toMatch(/min-w-\[\d+px\]/)
    expect(row.get('a').classes()).toContain('btn-secondary')
  })

  it('OrgSwitcher opens a bottom sheet on mobile that is not clipped on the left', async () => {
    vi.stubGlobal('matchMedia', () => ({
      matches: true, media: '', addEventListener() {}, removeEventListener() {},
    }))
    const { orgs, activeOrg } = useActiveOrg()
    orgs.value = [{ org_id: 'jpcs', org_name: 'JPCS', logo_url: null, owner_id: 'o', is_owner: 1, created_at: '' }]
    activeOrg.value = orgs.value[0]
    const wrapper = mount(OrgSwitcher, { props: { autoFetch: false }, attachTo: document.body, global: { plugins: [router] } })
    await wrapper.get('button[aria-expanded]').trigger('click')
    const menu = document.body.querySelector('[data-org-switcher-menu]')
    expect(menu).toBeTruthy()
    expect(menu!.className).toContain('inset-x-0')
    expect(menu!.className).toContain('bottom-0')
    expect(menu!.className).toContain('rounded-t-3xl')
    expect(menu!.getAttribute('role')).toBe('dialog')
    expect(menu!.getAttribute('aria-modal')).toBe('true')
    const trigger = wrapper.get('button[aria-expanded]')
    expect(trigger.attributes('aria-haspopup')).toBe('dialog')
    expect(trigger.attributes('aria-controls')).toBe(menu!.id)
    document.body.querySelector<HTMLButtonElement>('[data-org-switcher-backdrop]')!.click()
    await flushPromises()
    expect(document.body.querySelector('[data-org-switcher-menu]')).toBeNull()
    expect(document.activeElement).toBe(trigger.element)

    await trigger.trigger('click')
    expect(document.body.querySelector('[data-org-switcher-menu]')).toBeTruthy()
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    await flushPromises()
    expect(document.body.querySelector('[data-org-switcher-menu]')).toBeNull()
    expect(document.activeElement).toBe(trigger.element)
    wrapper.unmount()
  })
})
