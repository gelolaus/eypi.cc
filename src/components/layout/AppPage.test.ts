// @vitest-environment happy-dom
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import AppPage from './AppPage.vue'

describe('AppPage', () => {
  it('renders the title as an h1 inside the wantap page container', () => {
    const wrapper = mount(AppPage, { props: { title: 'Links' }, slots: { default: '<p id="body">Body</p>' } })
    expect(wrapper.get('h1').text()).toBe('Links')
    const container = wrapper.get('[data-app-page]')
    for (const cls of ['mx-auto', 'w-full', 'max-w-6xl', 'px-4', 'py-6', 'sm:px-6', 'lg:px-8', 'space-y-6']) {
      expect(container.classes()).toContain(cls)
    }
    expect(wrapper.find('#body').exists()).toBe(true)
  })

  it('shows an optional description from a prop or slot', () => {
    const fromProp = mount(AppPage, { props: { title: 'Links', description: 'Short links you own.' } })
    expect(fromProp.text()).toContain('Short links you own.')

    const fromSlot = mount(AppPage, { props: { title: 'Links' }, slots: { description: 'Slot line' } })
    expect(fromSlot.text()).toContain('Slot line')

    expect(mount(AppPage, { props: { title: 'Links' } }).find('p').exists()).toBe(false)
  })
})
