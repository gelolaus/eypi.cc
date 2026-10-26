// @vitest-environment happy-dom
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import MapColumnsStep from './MapColumnsStep.vue'

describe('MapColumnsStep', () => {
  it('uses 44px, 16px role selects and no tiny text', () => {
    const wrapper = mount(MapColumnsStep, {
      props: { columnHeaders: ['Email', 'Name'], mapError: '', getColRole: () => 'criteria', setColRole: () => {} },
    })
    const selects = wrapper.findAll('select')
    expect(selects).toHaveLength(2)
    for (const s of selects) expect(s.classes()).toContain('control')
    expect(wrapper.html()).not.toContain('py-1.5 font-mono text-xs')
  })
})
