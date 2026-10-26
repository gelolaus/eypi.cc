// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'
import BrandLogo from './BrandLogo.vue'

const router = createRouter({
  history: createMemoryHistory(),
  routes: [{ path: '/', component: { template: '<div />' } }],
})
const global = { plugins: [router] }

describe('BrandLogo', () => {
  it('renders the wordmark by default with a decorative mark', () => {
    const w = mount(BrandLogo, { global })
    expect(w.text()).toContain('eypi.cc')
    expect(w.get('img').attributes('alt')).toBe('')
    expect(w.get('img').classes()).toContain('size-8')
  })
  it('hides the wordmark with markOnly and labels the element', () => {
    const w = mount(BrandLogo, { props: { markOnly: true, size: 'sm' }, global })
    expect(w.text()).toBe('')
    expect(w.attributes('aria-label')).toBe('eypi.cc')
    expect(w.get('img').classes()).toContain('size-5')
  })
  it('renders a labelled router-link when to is set', () => {
    const w = mount(BrandLogo, { props: { to: '/', size: 'lg' }, global })
    expect(w.element.tagName).toBe('A')
    expect(w.attributes('aria-label')).toBe('eypi.cc')
    expect(w.attributes('href')).toBe('/')
    expect(w.get('img').classes()).toContain('size-14')
  })
})
