// @vitest-environment happy-dom
import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import FormsHomeView from './FormsHomeView.vue'
import LetterOfIntentView from './generators/LetterOfIntentView.vue'
import VisitorsPassView from './generators/VisitorsPassView.vue'
import ConcessionaireView from './generators/ConcessionaireView.vue'

vi.mock('vue-router', () => ({ useRouter: () => ({ push: vi.fn() }) }))

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn(async () => new Response('missing', { status: 404 })))
})
afterEach(() => vi.unstubAllGlobals())

describe('forms mobile layout', () => {
  it.each([
    ['LetterOfIntent', LetterOfIntentView],
    ['VisitorsPass', VisitorsPassView],
    ['Concessionaire', ConcessionaireView],
  ])('%s renders inside AppPage without a nested main', (_n, view) => {
    const wrapper = mount(view)
    expect(wrapper.find('[data-app-page]').exists()).toBe(true)
    expect(wrapper.find('main').exists()).toBe(false)
    expect(wrapper.get('button[type="submit"]').attributes('data-slot')).toBe('button')
  })

  it('FormsHomeView renders inside AppPage without a nested main', async () => {
    const wrapper = mount(FormsHomeView)
    await flushPromises()
    expect(wrapper.find('[data-app-page]').exists()).toBe(true)
    expect(wrapper.find('main').exists()).toBe(false)
  })

  it.each([
    ['guest list', VisitorsPassView],
    ['signer list', LetterOfIntentView],
  ])('%s stacks as cards below md', async (_n, view) => {
    const wrapper = mount(view)
    ;(wrapper.vm as unknown as { parsedNames: string[] }).parsedNames = ['Ana Cruz', 'Ben Reyes']
    await flushPromises()
    const table = wrapper.get('table')
    const wrapClasses = table.element.parentElement!.className.split(/\s+/)
    expect(wrapClasses).not.toContain('overflow-x-auto')
    expect(table.classes()).toContain('block')
    expect(table.classes()).toContain('md:table')
    expect(table.attributes('role')).toBe('table')
    expect(wrapper.get('thead').classes()).toContain('sr-only')
    const rows = wrapper.findAll('tbody tr')
    expect(rows).toHaveLength(2)
    for (const row of rows) {
      expect(row.classes()).toContain('block')
      expect(row.classes()).toContain('md:table-row')
      expect(row.attributes('role')).toBe('row')
      const label = row.get('[data-cell-label]')
      expect(label.text()).toBe('Name')
      expect(label.classes()).toContain('md:hidden')
    }
  })
})
