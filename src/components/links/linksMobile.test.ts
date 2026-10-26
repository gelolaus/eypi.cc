// @vitest-environment happy-dom
import { readFileSync } from 'node:fs'
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

describe('LinkRow card', () => {
  const wrapper = mount(LinkRow, { props: { link, selected: false } })

  it('renders as a Card row that stacks below md and lines up from md', () => {
    expect(wrapper.attributes('data-slot')).toBe('card')
    const root = wrapper.classes()
    expect(root).toContain('md:flex-row')
    expect(root).toContain('min-w-0')
  })

  it('shows the slug in the mono font and truncates the slug and destination', () => {
    const slug = wrapper.get('span.font-mono')
    expect(slug.text()).toBe('eypi.cc/alpha')
    expect(slug.classes()).toContain('truncate')
    expect(slug.classes()).toContain('min-w-0')
    expect(wrapper.find('p.truncate').exists()).toBe(true)
  })

  it('gives the checkbox a 44px hit area', () => {
    const label = wrapper.get('label[data-select-hit]')
    expect(label.classes()).toContain('size-11')
    expect(label.find('input[type="checkbox"]').exists()).toBe(true)
  })

  it('renders every action as an icon Button with an aria-label, never smaller than size-8', () => {
    const names = ['Copy link', 'Analytics', 'Edit', 'Disable alpha', 'Delete']
    for (const name of names) {
      const button = wrapper.get(`button[aria-label="${name}"]`)
      expect(button.attributes('data-slot')).toBe('button')
      expect(button.classes().some((c) => /^size-(8|9|11|12)$/.test(c))).toBe(true)
      expect(button.text()).toBe('')
    }
    for (const name of ['Copy link', 'Analytics', 'Edit']) {
      expect(wrapper.get(`button[aria-label="${name}"]`).classes()).toContain('size-11')
    }
  })

  it('lets the action group wrap at 375px', () => {
    expect(wrapper.get('[data-row-actions]').classes()).toContain('flex-wrap')
  })
})

describe('LinkList layout', () => {
  it('has no fixed 640px minimum width', () => {
    const wrapper = mount(LinkList, {
      props: { items: [link], selectedIds: [], loading: false, hasMore: false, filtered: false },
    })
    expect(wrapper.html()).not.toContain('min-w-[640px]')
  })

  it('renders each link as a Card row', () => {
    const wrapper = mount(LinkList, {
      props: { items: [link], selectedIds: [], loading: false, hasMore: false, filtered: false },
    })
    expect(wrapper.findAll('[data-slot="card"]')).toHaveLength(1)
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

describe('Links module legacy styles', () => {
  const files = [
    'src/views/links/LinksView.vue',
    'src/views/DashboardView.vue',
    'src/components/links/LinkList.vue',
    'src/components/links/LinkRow.vue',
    'src/components/links/LinkFilters.vue',
    'src/components/links/LinkEditorPanel.vue',
    'src/components/links/LinkAdvancedFields.vue',
    'src/components/links/QrDesigner.vue',
    'src/components/AnalyticsPanel.vue',
  ]
  it('no longer use the retired g-*, mica, gold, apc, tap-scale classes or hard-coded hex', () => {
    for (const file of files) {
      const text = readFileSync(file, 'utf8')
      expect(text, file).not.toMatch(
        /\b(?:bg|text|border|ring|accent|from|to|via)-g-|mica|btn-gold|btn-secondary|section-card|eypi-gold|tap-scale|\bapc\b|"control |text-section-title|text-card-title|text-data/,
      )
      expect(text, file).not.toMatch(/#[0-9A-Fa-f]{6}\b/)
    }
  })
})
