// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { Textarea } from './index'

describe('Textarea', () => {
  it('renders and emits', async () => {
    const w = mount(Textarea, { props: { modelValue: '' } })
    expect(w.attributes('data-slot')).toBe('textarea')
    expect(w.classes()).toContain('min-h-16')
    await w.setValue('hi')
    expect(w.emitted('update:modelValue')?.[0]).toEqual(['hi'])
  })
})
