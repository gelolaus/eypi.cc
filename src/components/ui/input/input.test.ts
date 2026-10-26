// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { Input } from './index'

describe('Input', () => {
  it('renders classes and slot data', () => {
    const w = mount(Input)
    expect(w.attributes('data-slot')).toBe('input')
    expect(w.classes()).toEqual(expect.arrayContaining(['h-11', 'rounded-xl', 'border-input']))
  })
  it('emits update:modelValue', async () => {
    const w = mount(Input, { props: { modelValue: '' } })
    await w.setValue('abc')
    expect(w.emitted('update:modelValue')?.[0]).toEqual(['abc'])
  })
  it('keeps aria-invalid', () => {
    expect(mount(Input, { attrs: { 'aria-invalid': 'true' } }).attributes('aria-invalid')).toBe('true')
  })
})
