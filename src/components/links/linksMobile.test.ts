// @vitest-environment happy-dom
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import LinkFilters from './LinkFilters.vue'
import LinkList from './LinkList.vue'
import LinkRow from './LinkRow.vue'
import type { LinkListItem } from '@/composables/useLinks'

const link: LinkListItem = {
  id: 'link-1',
  slug: 'alpha',
  url: 'https://example.com/a/very/long/path',
  clicks: 3,
  createdAt: '2026-10-01T00:00:00.000Z',
  expiresAt: null,
  disabledAt: null,
  disabledReason: null,
  protected: true,
  hasLogo: false,
}

describe('LinkRow mobile card', () => {
  const wrapper = mount(LinkRow, { props: { link, selected: false } })

  it('renders as a card below md and a table row from md', () => {
    const root = wrapper.classes()
    expect(root).toContain('rounded-2xl')
    expect(root).toContain('border')
    expect(root).toContain('md:flex-row')
    expect(root).toContain('md:rounded-none')
  })

  it('shows the slug in the mono font and truncates the destination', () => {
    expect(wrapper.get('span.font-mono').text()).toBe('eypi.cc/alpha')
    expect(wrapper.find('p.truncate').exists()).toBe(true)
  })

  it('gives the checkbox a 44px hit area', () => {
    const label = wrapper.get('label[data-select-hit]')
    expect(label.classes()).toContain('size-11')
    expect(label.find('input[type="checkbox"]').exists()).toBe(true)
  })

  it('makes every action at least 44px', () => {
    const buttons = wrapper.findAll('button')
    expect(buttons.length).toBeGreaterThanOrEqual(4)
    for (const button of buttons) expect(button.classes()).toContain('min-h-11')
  })
})

describe('LinkList layout', () => {
  it('has no fixed 640px minimum width', () => {
    const wrapper = mount(LinkList, {
      props: { items: [link], selectedIds: [], loading: false, hasMore: false, filtered: false },
    })
    expect(wrapper.html()).not.toContain('min-w-[640px]')
  })
})

describe('LinkFilters', () => {
  it('uses 44px controls', () => {
    const wrapper = mount(LinkFilters, { props: { query: '', sort: 'new', status: 'all' } })
    expect(wrapper.get('#link-search').classes()).toContain('h-11')
    expect(wrapper.get('#link-sort').classes()).toContain('h-11')
    expect(wrapper.get('#link-status').classes()).toContain('h-11')
  })
})
