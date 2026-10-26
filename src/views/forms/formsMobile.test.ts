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
})
