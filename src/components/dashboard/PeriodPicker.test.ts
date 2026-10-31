// @vitest-environment happy-dom
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import PeriodPicker from './PeriodPicker.vue'

describe('PeriodPicker', () => {
  it('marks only the active button aria-pressed and emits the chosen value', async () => {
    const wrapper = mount(PeriodPicker, { props: { modelValue: 30 } })
    const group = wrapper.get('[role="group"]')
    expect(group.attributes('aria-label')).toBe('Period')
    const buttons = group.findAll('button')
    expect(buttons).toHaveLength(3)
    expect(buttons.map((b) => b.text())).toEqual(['7 days', '30 days', '90 days'])
    for (const b of buttons) expect(b.classes().join(' ')).toMatch(/min-h-11/)
    expect(buttons[0].attributes('aria-pressed')).toBe('false')
    expect(buttons[1].attributes('aria-pressed')).toBe('true')
    expect(buttons[2].attributes('aria-pressed')).toBe('false')
    await buttons[0].trigger('click')
    expect(wrapper.emitted('update:modelValue')).toEqual([[7]])
  })
})