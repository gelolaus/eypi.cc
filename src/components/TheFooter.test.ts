// @vitest-environment happy-dom
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import TheFooter from './TheFooter.vue'

describe('TheFooter', () => {
  it('is not a keyboard-nav section target', () => {
    const wrapper = mount(TheFooter)
    expect(wrapper.attributes()).not.toHaveProperty('data-section')
  })

  it('keeps every link row at least 44px tall', () => {
    const wrapper = mount(TheFooter, {
      global: { stubs: { RouterLink: { template: '<a><slot /></a>' } } },
    })
    const rows = wrapper.findAll('.footer-link-row')
    expect(rows.length).toBeGreaterThan(0)
    for (const row of rows) expect(row.classes()).toContain('min-h-11')
  })
})
