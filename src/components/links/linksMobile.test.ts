// @vitest-environment happy-dom
import { readFileSync } from 'node:fs'
import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it } from 'vitest'
import { nextTick } from 'vue'
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

describe('LinkRow actions menu below md', () => {
  const mounted: Array<{ unmount: () => void }> = []

  afterEach(() => {
    while (mounted.length) mounted.pop()!.unmount()
    document.body.innerHTML = ''
  })

  function mountRow(overrides: Partial<LinkListItem> = {}) {
    const wrapper = mount(LinkRow, {
      props: { link: { ...link, ...overrides }, selected: false },
      attachTo: document.body,
    })
    mounted.push(wrapper)
    return wrapper
  }

  async function openMenu(wrapper: ReturnType<typeof mountRow>) {
    await wrapper.get('button[aria-label="More actions for alpha"]').trigger('click')
    await nextTick()
    return [...document.body.querySelectorAll<HTMLElement>('[data-slot="dropdown-menu-item"]')]
  }

  const hiddenBelowMd = (el: Element) => el.classList.contains('hidden')

  it('shows three visible actions and a More actions menu below md', () => {
    const wrapper = mountRow()
    const buttons = wrapper.findAll('[data-row-actions] button')
    const visible = buttons.filter((b) => !hiddenBelowMd(b.element) && !b.classes().includes('md:hidden'))
    expect(visible.map((b) => b.attributes('aria-label'))).toEqual(['Copy link', 'Analytics', 'Edit'])
    const trigger = wrapper.get('button[aria-label="More actions for alpha"]')
    expect(trigger.classes()).toContain('size-11')
    expect(trigger.classes()).toContain('md:hidden')
    expect(trigger.attributes('aria-haspopup')).toBe('menu')
  })

  it('keeps all five actions as buttons from md', () => {
    const wrapper = mountRow()
    for (const name of ['Disable alpha', 'Delete']) {
      const button = wrapper.get(`button[aria-label="${name}"]`)
      expect(button.classes()).toEqual(expect.arrayContaining(['hidden', 'md:inline-flex']))
    }
  })

  it('menu offers Disable and Delete', async () => {
    const wrapper = mountRow()
    const items = await openMenu(wrapper)
    expect(items.map((i) => i.textContent?.trim())).toEqual(['Disable', 'Delete'])
    for (const item of items) expect(item.className).toContain('min-h-11')
    expect(items[1].getAttribute('data-variant')).toBe('destructive')
  })

  it('menu items emit disable and delete', async () => {
    const wrapper = mountRow()
    let items = await openMenu(wrapper)
    items[0].click()
    await nextTick()
    expect(wrapper.emitted('disable')).toHaveLength(1)
    items = await openMenu(wrapper)
    items[1].click()
    await nextTick()
    expect(wrapper.emitted('delete')).toHaveLength(1)
  })

  it('menu offers Enable for a user-disabled link', async () => {
    const wrapper = mountRow({ disabledAt: '2026-10-02T00:00:00.000Z', disabledReason: 'user' })
    const items = await openMenu(wrapper)
    expect(items.map((i) => i.textContent?.trim())).toEqual(['Enable', 'Delete'])
    items[0].click()
    await nextTick()
    expect(wrapper.emitted('enable')).toHaveLength(1)
  })

  it('moderator-locked link has no Enable or Disable item', async () => {
    for (const disabledReason of ['admin', 'abuse'] as const) {
      const wrapper = mountRow({ disabledAt: '2026-10-02T00:00:00.000Z', disabledReason })
      const items = await openMenu(wrapper)
      expect(items.map((i) => i.textContent?.trim())).toEqual(['Delete'])
      expect(wrapper.find('button[aria-label^="Enable"], button[aria-label^="Disable"]').exists()).toBe(false)
      wrapper.unmount()
      mounted.pop()
      document.body.innerHTML = ''
    }
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
