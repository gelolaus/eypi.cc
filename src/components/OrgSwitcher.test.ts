// @vitest-environment happy-dom
import { flushPromises, mount } from '@vue/test-utils'
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
  it('shows only the CAPS slug in the rail and keeps the full name for hover and screen readers', () => {
    const wrapper = mount(OrgSwitcher, { props: { block: true, autoFetch: false } })
    const trigger = wrapper.get('button')
    expect(wrapper.get('[data-org-label]').text()).toBe('JPCS-APC')
    expect(trigger.text()).not.toContain(longName)
    expect(trigger.attributes('title')).toBe(longName)
    expect(trigger.attributes('aria-label')).toContain(longName)
    wrapper.unmount()
  })

  it('shows only the CAPS slug on menu rows, with the full name as the title', async () => {
    const wrapper = mount(OrgSwitcher, { props: { block: true, autoFetch: false }, attachTo: document.body })
    await wrapper.get('button').trigger('click')
    const menu = document.body.querySelector('[data-org-switcher-menu]')!
    expect(menu.textContent).toContain('JPCS-APC')
    expect(menu.textContent).not.toContain(longName)
    expect(menu.querySelector('button[title="' + longName + '"]')).not.toBeNull()
    wrapper.unmount()
  })

  it('hides the label visually when the rail is collapsed', () => {
    const wrapper = mount(OrgSwitcher, { props: { block: true, collapsed: true, autoFetch: false } })
    expect(wrapper.get('[data-org-label]').classes()).toContain('sr-only')
    expect(wrapper.get('button').classes()).toContain('justify-center')
    wrapper.unmount()
  })

  it('keeps the compact label hidden below sm', () => {
    const wrapper = mount(OrgSwitcher, { props: { compact: true, autoFetch: false } })
    expect(wrapper.get('[data-org-label]').classes()).toEqual(expect.arrayContaining(['hidden', 'sm:inline']))
    wrapper.unmount()
  })

  it('returns focus to the trigger when another control was focused before open', async () => {
    const wrapper = mount(OrgSwitcher, { props: { block: true, autoFetch: false }, attachTo: document.body })
    const other = document.createElement('button')
    other.type = 'button'
    other.textContent = 'Elsewhere'
    document.body.appendChild(other)
    other.focus()

    const trigger = wrapper.get('button').element as HTMLButtonElement
    // dispatchEvent does not focus the button, unlike HTMLElement.click().
    trigger.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await flushPromises()

    trigger.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await flushPromises()
    expect(document.activeElement).toBe(trigger)

    other.remove()
    wrapper.unmount()
  })
})
