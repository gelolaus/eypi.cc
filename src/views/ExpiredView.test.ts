// @vitest-environment happy-dom
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import ExpiredView from './ExpiredView.vue'

describe('ExpiredView', () => {
  it('says the link has expired', () => {
    const wrapper = mount(ExpiredView, {
      global: {
        stubs: { RouterLink: { template: '<a><slot /></a>' } },
      },
    })

    expect(wrapper.get('h1').text()).toBe('This link has expired')
  })
})
