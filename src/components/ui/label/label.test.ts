// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { Label } from './index'

describe('Label', () => {
  it('renders a label with slot data', () => {
    const w = mount(Label, { attrs: { for: 'x' }, slots: { default: 'Name' } })
    expect(w.element.tagName).toBe('LABEL')
    expect(w.attributes('data-slot')).toBe('label')
    expect(w.classes()).toContain('font-medium')
    expect(w.text()).toBe('Name')
  })
})
