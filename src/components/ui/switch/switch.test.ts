// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { Switch } from './index'

describe('Switch', () => {
  it('renders an unchecked switch with wantap classes', () => {
    const w = mount(Switch, { attachTo: document.body })
    const sw = w.get('[role="switch"]')
    expect(sw.attributes('data-slot')).toBe('switch')
    expect(sw.attributes('data-size')).toBe('default')
    expect(sw.attributes('data-state')).toBe('unchecked')
    expect(sw.classes()).toContain('rounded-full')
    expect(w.find('[data-slot="switch-thumb"]').exists()).toBe(true)
    w.unmount()
  })

  it('toggles and updates v-model on click', async () => {
    const w = mount(Switch, { props: { modelValue: false }, attachTo: document.body })
    await w.get('[role="switch"]').trigger('click')
    expect(w.emitted('update:modelValue')?.[0]).toEqual([true])
    await w.setProps({ modelValue: true })
    expect(w.get('[role="switch"]').attributes('data-state')).toBe('checked')
    expect(w.get('[role="switch"]').attributes('aria-checked')).toBe('true')
    w.unmount()
  })

  it('toggles from the keyboard (Enter; Space is a native button click that happy-dom does not synthesise)', async () => {
    const w = mount(Switch, { props: { modelValue: false }, attachTo: document.body })
    await w.get('[role="switch"]').trigger('keydown', { key: 'Enter' })
    expect(w.emitted('update:modelValue')?.[0]).toEqual([true])
    w.unmount()
  })

  it('does not toggle when disabled', async () => {
    const w = mount(Switch, { props: { disabled: true }, attachTo: document.body })
    await w.get('[role="switch"]').trigger('click')
    expect(w.emitted('update:modelValue')).toBeUndefined()
    w.unmount()
  })
})
