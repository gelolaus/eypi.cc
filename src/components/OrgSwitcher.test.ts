// @vitest-environment happy-dom
import { mount } from '@vue/test-utils'
import { ref } from 'vue'
import { describe, expect, it, vi } from 'vitest'
import OrgSwitcher from './OrgSwitcher.vue'
import { orgSlugLabel, type OrgListItem } from '@/types/orgs'

const longName = 'A'.repeat(90)

const org: OrgListItem = {
  org_id: 'jpcs-apc',
  org_name: longName,
  logo_url: null,
  owner_id: 'u1',
  is_owner: 1,
  created_at: '2026-01-01',
}

const orgs = ref<OrgListItem[]>([org])
const activeOrg = ref<OrgListItem | null>(org)

vi.mock('@/composables/useActiveOrg', () => ({
  useActiveOrg: () => ({ orgs, activeOrg, fetchOrgs: vi.fn(), selectOrg: vi.fn() }),
}))

describe('orgSlugLabel', () => {
  it('uppercases the slug and keeps hyphens', () => {
    expect(orgSlugLabel({ org_id: 'jpcs-apc' })).toBe('JPCS-APC')
  })
})

describe('OrgSwitcher label', () => {
  it('shows the full name wrapped and the CAPS slug in the rail', () => {
    const wrapper = mount(OrgSwitcher, { props: { block: true, autoFetch: false } })
    const trigger = wrapper.get('button')
    expect(trigger.text()).toContain(longName)
    expect(trigger.text()).toContain('JPCS-APC')
    expect(trigger.attributes('title')).toBe(longName)
    const name = wrapper.get('[data-org-name]')
    expect(name.classes()).toContain('line-clamp-2')
    expect(name.classes()).toContain('break-words')
    expect(name.classes()).not.toContain('truncate')
    wrapper.unmount()
  })

  it('shows name and CAPS slug on menu rows', async () => {
    const wrapper = mount(OrgSwitcher, { props: { block: true, autoFetch: false }, attachTo: document.body })
    await wrapper.get('button').trigger('click')
    const menu = document.body.querySelector('[data-org-switcher-menu]')
    expect(menu?.textContent).toContain(longName)
    expect(menu?.textContent).toContain('JPCS-APC')
    wrapper.unmount()
  })

  it('keeps the compact label hidden below sm', () => {
    const wrapper = mount(OrgSwitcher, { props: { compact: true, autoFetch: false } })
    expect(wrapper.get('[data-org-label]').classes()).toEqual(expect.arrayContaining(['hidden', 'sm:inline']))
    wrapper.unmount()
  })
})
