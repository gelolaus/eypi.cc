// @vitest-environment happy-dom
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import TheFooter from './TheFooter.vue'

describe('TheFooter', () => {
  it('is not a keyboard-nav section target', () => {
    const wrapper = mount(TheFooter)
    expect(wrapper.attributes()).not.toHaveProperty('data-section')
  })
})
