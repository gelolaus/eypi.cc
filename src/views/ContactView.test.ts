// @vitest-environment happy-dom
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import ContactView from './ContactView.vue'

describe('ContactView', () => {
  it('uses sentence case for headings and the date label', () => {
    const wrapper = mount(ContactView)
    const headings = wrapper.findAll('h2').map(h => h.text())
    expect(headings).toEqual(['General support', 'Build with Eypi', 'What to include'])
    expect(wrapper.text()).toContain('Last updated:')
    expect(wrapper.text()).not.toContain('Last Updated')
  })
})
