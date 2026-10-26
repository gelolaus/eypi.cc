// @vitest-environment happy-dom
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import FeatureStrip from './FeatureStrip.vue'

describe('FeatureStrip', () => {
  const wrapper = mount(FeatureStrip, {
    global: { stubs: { RouterLink: { props: ['to'], template: '<a :href="to"><slot /></a>' } } },
  })

  it('is the #features target with one h2 and no h1', () => {
    expect(wrapper.attributes('id')).toBe('features')
    expect(wrapper.findAll('h1')).toHaveLength(0)
    expect(wrapper.findAll('h2')).toHaveLength(1)
  })

  it('names the five tools', () => {
    const names = wrapper.findAll('h3').map((h) => h.text())
    expect(names).toEqual(['Links', 'Forms', 'Tix', 'Frames', 'Orgs'])
  })

  it('has no em dashes', () => {
    expect(wrapper.text()).not.toContain('—')
  })
})
